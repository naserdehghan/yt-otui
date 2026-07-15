# Architecture Overview

yt-otui is a single-page React TUI application rendered by OpenTUI. The architecture follows a simple state-machine pattern: the root `App` component owns a `Screen` union state and renders exactly one child screen at a time.

## State Machine

```
                    ┌──────────────────────────────────────────────┐
                    │                                              │
                    ▼                                              │
 ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌────────────┐   ┌──────┐
 │  URL    │──▶│ Loading  │──▶│  Format  │──▶│Downloading │──▶│ Done │
 │ Screen  │   │  Screen  │   │  Screen  │   │  Screen    │   │Screen│
 └─────────┘   └──────────┘   └──────────┘   └────────────┘   └──────┘
      ▲                                                    │
      │                                                    │
      └────────────────── (error/back) ◀───────────────────┘
```

The `Screen` type in `App.tsx` is a **discriminated union**:

```typescript
type Screen =
  | { name: "url"; error: string | null }
  | { name: "loading"; message: string }
  | { name: "formats"; url: string; info: VideoInfo; formats: FormatOption[] }
  | { name: "downloading"; title: string; progress: DownloadProgress }
  | { name: "done"; filePath: string; fileSize: number }
```

Each `name` discriminant maps to a switch-case in the render function and to one screen component under `src/screens/`. Transitions are triggered by callbacks passed as props to each screen component.

In addition to the screen state, `<App>` manages an `AppConfig` state (loaded from `~/.config/yt-otui/config.json`) and a `settingsOpen` boolean that controls the settings modal overlay.

## Component Tree

```
createRoot(renderer)
└── <App>                          [src/App.tsx]
    ├── <UrlScreen>                [src/screens/UrlScreen.tsx]
    │   └── <input> (focused)
    ├── <LoadingScreen>            [src/screens/LoadingScreen.tsx]
    │   └── <text> "Fetching video info..."
    ├── <FormatScreen>             [src/screens/FormatScreen.tsx]
    │   ├── <box> "Video" (title, uploader, duration, views)
    │   └── <select> (format options)
    ├── <DownloadScreen>           [src/screens/DownloadScreen.tsx]
    │   ├── <text> title
    │   ├── <ProgressBar>          [src/components/ProgressBar.tsx]
    │   └── <text> speed · ETA
    └── <DoneScreen>               [src/screens/DoneScreen.tsx]
        └── <box> "File" (path, size)
    └── <SettingsModal>            [src/components/SettingsModal.tsx]
        └── (overlay, shown on Ctrl+Shift+/)
```

All screen components are direct children of `<App>` — there is no router or navigation stack. Only one screen is rendered at a time due to the switch-case in the render function.

## Data Flow

```
User URL ──▶ UrlScreen ──▶ App.handleUrlSubmit()
                              │
                              ▼
                    ytdlp.fetchVideoInfo(url)
                       spawn("yt-dlp", ["-J", "--no-playlist", url])
                       stdout → JSON.parse → VideoInfo
                              │
                              ▼
                    formats.curateFormats(info)
                       filter by vcodec, height
                       map to quality tiers (2160p → 360p + audio)
                              │
                              ▼
                    FormatScreen ──▶ App.handleFormatSelect(url, info, format)
                                        │
                                        ▼
                              config.resolveDownloadDir(config)
                                        │
                                        ▼
                              ytdlp.downloadVideo(url, args, downloadDir, onProgress)
                                spawn("yt-dlp", [...formatArgs])
                                parse "PROG|..." lines from stdout
                                callback: setScreen({ name: "downloading", progress })
                                        │
                                        ▼
                              ytdlp returns { filePath, fileSize }
                                        │
                                        ▼
                              DoneScreen
```

### Key Design Decisions

**1. Subprocess-based yt-dlp integration** (`src/ytdlp.ts`)
The app does not use yt-dlp as a library — it spawns it as a subprocess via `Bun.spawn()`. This means:
- The yt-dlp binary must be pre-installed (checked at startup).
- Format data flows as JSON from stdout (`-J` flag).
- Download progress is parsed from custom `--progress-template` lines prefixed with `PROG|`.
- File paths are extracted from yt-dlp's own stdout messages (`[Merger]`, `[download] Destination:`, `[ExtractAudio] Destination:`).

The download directory is no longer hardcoded: `downloadVideo()` accepts a `downloadDir` parameter, resolved by `resolveDownloadDir(config)` in `src/config.ts`. The user can choose between `~/Downloads`, the current working directory, or a custom path via the settings modal.

**2. Format curation is separate from raw data** (`src/formats.ts`)
Raw yt-dlp format lists can be 20–50 entries. The curation layer reduces this to a predictable set of options:
- One "Best available" catch-all.
- One entry per available quality tier up to the source's max height.
- One "Audio only" entry.
This separation makes the format selection UI stable and independent of yt-dlp's format output structure.

**3. OpenTUI with React bindings**
The app uses `@opentui/react`, which provides standard React JSX and hooks (`useState`, `useCallback`, `useKeyboard`). The JSX transform is configured in `tsconfig.json` with `"jsx": "react-jsx"` and `"jsxImportSource": "@opentui/react"`.

Rendering is handled by:
```typescript
const renderer = await createCliRenderer({ exitOnCtrlC: true })
createRoot(renderer).render(<App />)
```

**4. No bundling step**
Bun runs TypeScript directly. The `start` script is simply `bun run src/index.tsx`. There is no build step for development — changes take effect on next run.

## Keyboard Architecture

Keyboard handling is centralized in `App.tsx` via OpenTUI's `useKeyboard` hook:

```typescript
useKeyboard((key) => {
  if (key.ctrl && (key.name === "/" || key.name === "_")) { /* toggle settings */ }
  if (key.name === "escape") { /* screen-dependent action */ }
  if (key.name === "q" && screen.name === "done") quit()
  if (key.name === "n" && screen.name === "done") /* reset */ }
})
```

`Ctrl+Shift+/` (or `Ctrl+_` in terminals without the Kitty keyboard protocol) toggles the settings modal. When the modal is open, keyboard events are blocked from reaching the screen-level handlers. Focused inputs (`UrlScreen`'s `<input>`, `FormatScreen`'s `<select>`) receive key events first via OpenTUI's focus system.

The `quit()` function calls `renderer.destroy()` before `process.exit(0)` to properly restore terminal state and prevent rendering artifacts. This was introduced (commit `b7734f0`) after noticing that an unclean exit could leave the terminal in a broken state.

## Error Handling Strategy

| Layer | Mechanism | User-Facing Behavior |
|---|---|---|
| yt-dlp not installed | `checkYtDlpInstalled()` at startup | Process exits with install instructions |
| URL fetch failure | try/catch in `handleUrlSubmit` | Error message on `UrlScreen` |
| Download failure | try/catch in `handleFormatSelect` | Returns to `UrlScreen` with error message |
| yt-dlp non-zero exit | `throw new Error(tail)` with last 5 stderr lines | Error surfaces through try/catch |

The error messages are the last 5 lines of yt-dlp's stderr, which typically contain the most useful diagnostic information.

## Dependencies

| Package | Version | Role |
|---|---|---|
| `@opentui/core` | ^0.4.3 | Terminal renderer, layout engine (Yoga flexbox), renderable primitives |
| `@opentui/react` | ^0.4.3 | React bindings for OpenTUI (JSX → renderable tree) |
| `react` | ^19.2.7 | UI component model |
| `bun-types` | ^1.3.14 | Bun runtime type definitions |
| `typescript` | ^7.0.2 | Type checking |
| `yt-dlp` | (external) | Video/audio extraction and download |

Note: TypeScript ^7.0.2 tracks the Bun-bundled version — this is expected and not a mistake.
