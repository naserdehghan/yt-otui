# Architecture Overview

yt-otui is a single-page React TUI application rendered by OpenTUI. The architecture follows a simple state-machine pattern: the root `App` component owns a `Screen` union state and renders exactly one child screen at a time.

## State Machine

The screen routing has two parallel flows selected at URL-submit time:

```
Single-video path (default):
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

Playlist path (URL with `list` param or resolves to entries):
                                      ┌──────────────────┐
                                      │ Playlist Choice  │── video ──▶ (single-video path)
                                      │     Screen       │
                                      └──────────────────┘
                                             │ playlist
                                             ▼
                              ┌──────────────────────┐
                              │   Playlist Format    │
                              │       Screen         │
                              └──────────────────────┘
                                             │
                                             ▼
                              ┌──────────────────────┐
                              │ Playlist Downloading │
                              │       Screen         │
                              └──────────────────────┘
                                             │
                                             ▼
                              ┌──────────────────────┐
                              │   Playlist Done      │
                              │       Screen         │
                              └──────────────────────┘
```

The `Screen` type (defined in `src/app/types.ts`) is a **discriminated union** with 9 variants:

```typescript
type PlaylistItemState = {
  title: string
  status: "pending" | "downloading" | "done" | "error"
  progress?: DownloadProgress
  filePath?: string
  fileSize?: number
  error?: string
}

type Screen =
  | { name: "url"; error: string | null }
  | { name: "loading"; message: string }
  | { name: "playlist-choice"; url: string }
  | { name: "formats"; url: string; info: VideoInfo; formats: FormatOption[] }
  | { name: "playlist-formats"; playlist: PlaylistInfo; formats: FormatOption[] }
  | { name: "downloading"; title: string; progress: DownloadProgress }
  | { name: "done"; filePath: string; fileSize: number }
  | { name: "playlist-downloading"; playlistTitle: string; entries: PlaylistEntry[]; items: PlaylistItemState[]; activeIndex: number }
  | { name: "playlist-done"; playlistTitle: string; items: PlaylistItemState[] }
```

Each `name` discriminant maps to a switch-case in the render function and to one screen component under `src/features/*/`. Transitions are triggered by callbacks passed as props to each screen component.

In addition to the screen state, `<App>` manages an `AppConfig` state (loaded from `~/.config/yt-otui/config.json`) and a `settingsOpen` boolean that controls the settings modal overlay.

## Component Tree

```
createRoot(renderer)
└── <App>                          [src/app/App.tsx]
    ├── <UrlScreen>                [src/features/url/UrlScreen.tsx]
    │   └── <input> (focused)
    ├── <LoadingScreen>            [src/features/loading/LoadingScreen.tsx]
    │   └── <text> "Fetching video info..."
    ├── <FormatScreen>             [src/features/format/FormatScreen.tsx]
    │   ├── <box> "Video" (title, uploader, duration, views)
    │   └── <select> (format options)
    ├── <DownloadScreen>           [src/features/download/DownloadScreen.tsx]
    │   ├── <text> title
    │   ├── <ProgressBar>          [src/features/download/ProgressBar.tsx]
    │   └── <text> speed · ETA
    ├── <DoneScreen>               [src/features/done/DoneScreen.tsx]
    │   └── <box> "File" (path, size)
    ├── <PlaylistChoiceScreen>     [src/features/playlist/PlaylistChoiceScreen.tsx]
    │   └── <select> (video or playlist)
    ├── <PlaylistFormatScreen>     [src/features/playlist/PlaylistFormatScreen.tsx]
    │   ├── <box> "Playlist" (title, video count)
    │   └── <select> (format options applied to all entries)
    ├── <PlaylistDownloadScreen>   [src/features/playlist/PlaylistDownloadScreen.tsx]
    │   ├── <text> playlist title
    │   ├── <box> "Videos" (scrollable entry list with status icons)
    │   ├── <ProgressBar>          [src/features/download/ProgressBar.tsx]
    │   └── <text> speed · ETA (active entry)
    ├── <PlaylistDoneScreen>       [src/features/playlist/PlaylistDoneScreen.tsx]
    │   └── <box> "Results" (succeeded/failed per entry)
    └── <SettingsModal>            [src/features/settings/SettingsModal.tsx]
        └── (overlay, shown on Ctrl+Shift+/) — two config sections: download directory mode and browser cookie selection
```

All screen components are direct children of `<App>` — there is no router or navigation stack. Only one screen is rendered at a time due to the switch-case in the render function.

## Data Flow

```
User URL ──▶ UrlScreen ──▶ App.handleUrlSubmit()
                              │
                    ┌─────────┴──────────┐
                    ▼                    ▼
          parseYouTubeUrl(url)    fetchInfo(url)
          ├─ videoId + listId?       ├─ "entries" in result? ──▶ PlaylistInfo path
          │  ──▶ PlaylistChoice      └─ single video ──▶ VideoInfo path
          │      Screen
          │      ├─ "video"
          │      └─ "playlist"
          ▼
    fetchInfo(url, { noPlaylist: true })
       spawn("yt-dlp", ["-J", "--flat-playlist", "--no-playlist", url])
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
                spawn("yt-dlp", [...formatArgs, "--no-playlist", ...])
                parse "PROG|..." lines from stdout
                callback: setScreen({ name: "downloading", progress })
                        │
                        ▼
              ytdlp returns { filePath, fileSize }
                        │
                        ▼
              DoneScreen

Playlist path (--- or from PlaylistChoice "playlist" ──▶)

    fetchInfo(url)
       spawn("yt-dlp", ["-J", "--flat-playlist", url])
       stdout → JSON.parse → PlaylistInfo (entries[])
              │
              ▼
    PlaylistFormatScreen ──▶ handlePlaylistFormatSelect(playlist, format)
                                │
                                ▼
                      config.resolveDownloadDir(config)
                                │
                                ▼
                      join(baseDir, sanitizeFilename(playlist.title))
                                │
                                ▼
                      ytdlp.downloadPlaylist(entries, args, dir, onItemUpdate)
                        for each entry:
                          downloadVideo(entry.url, args, dir, onProgress)
                          callback: setScreen({ items[nextIndex] })
                                │
                                ▼
                      PlaylistDoneScreen
```

### Key Design Decisions

**1. Subprocess-based yt-dlp integration** (`src/shared/services/ytdlp.ts`)
The app does not use yt-dlp as a library — it spawns it as a subprocess via `Bun.spawn()`. This means:
- The yt-dlp binary must be pre-installed (checked at startup).
- Format data flows as JSON from stdout (`-J` flag). The `fetchInfo()` function is unified for both single videos and playlists: it passes `--flat-playlist` by default and inspects the JSON for an `entries` array. Single-video fetches use `{ noPlaylist: true }` to add `--no-playlist`.
- Download progress is parsed from custom `--progress-template` lines prefixed with `PROG|`.
- File paths are extracted from yt-dlp's own stdout messages (`[Merger]`, `[download] Destination:`, `[ExtractAudio] Destination:`).
- Playlist downloads iterate sequentially: `downloadPlaylist()` calls `downloadVideo()` for each entry, reporting per-item status via callback. Each entry is a full subprocess invocation, so playlist downloads of N videos spawn N yt-dlp processes.

The download directory is no longer hardcoded: `downloadVideo()` accepts a `downloadDir` parameter, resolved by `resolveDownloadDir(config)` in `src/features/settings/config.ts`. The user can choose between `~/Downloads`, the current working directory, or a custom path via the settings modal.

The app also supports browser cookies via yt-dlp's `--cookies-from-browser` flag for age-restricted downloads. `fetchInfo()`, `downloadVideo()`, and `downloadPlaylist()` all accept an optional `cookiesFromBrowser` parameter. When set (e.g. `"chrome"`, `"firefox"`), the `cookieArgs()` helper adds the flag to the yt-dlp subprocess arguments. The browser source is configurable through the settings modal alongside the download directory, and persisted in `config.json`.

**2. Format curation is separate from raw data** (`src/features/format/formats.ts`)
Raw yt-dlp format lists can be 20–50 entries. The curation layer reduces this to a predictable set of options:
- One "Best available" catch-all.
- One entry per available quality tier up to the source's max height.
- One "Audio only" entry.
This separation makes the format selection UI stable and independent of yt-dlp's format output structure.

For playlists, `defaultFormatOptions()` returns the same tier list without per-video height filtering (playlist entries fetched via `--flat-playlist` don't carry individual format lists). The format choice applies uniformly to all videos in the playlist.

**3. OpenTUI with React bindings**
The app uses `@opentui/react`, which provides standard React JSX and hooks (`useState`, `useCallback`, `useKeyboard`). The JSX transform is configured in `tsconfig.json` with `"jsx": "react-jsx"` and `"jsxImportSource": "@opentui/react"`.

Rendering is handled by:
```typescript
const renderer = await createCliRenderer({ exitOnCtrlC: true })
createRoot(renderer).render(<App />)
```

**4. Bundling and compilation**

Bun runs TypeScript directly for development (`bun start` runs `src/index.tsx` with no build step — changes take effect on next run). For production use:

- **`bun run build`** bundles `./src/index.tsx` to `./dist/index.js` (targeting Bun, externalizing `@opentui/core`).
- **`bun run compile`** creates a standalone binary `yt-otui` via `bun build --compile`.
- **`bun run preview`** runs the built bundle from `./dist/index.js`.

## Keyboard Architecture

Keyboard handling is centralized in `src/app/App.tsx` via OpenTUI's `useKeyboard` hook:

```typescript
useKeyboard((key) => {
  if (key.ctrl && (key.name === "/" || key.name === "_")) { /* toggle settings */ }
  if (key.name === "escape") {
    /* url/playlist-choice/playlist-formats → back, done/playlist-done → quit */
  }
  if (key.name === "q" && (screen.name === "done" || screen.name === "playlist-done")) quit()
  if (key.name === "n" && (screen.name === "done" || screen.name === "playlist-done")) /* reset */
})
```

`Ctrl+Shift+/` (or `Ctrl+_` in terminals without the Kitty keyboard protocol) toggles the settings modal. The modal has two configurable sections (download directory and browser cookies) navigable via arrow keys. When the modal is open, keyboard events are blocked from reaching the screen-level handlers. Focused inputs (`UrlScreen`'s `<input>`, `FormatScreen`'s `<select>`) receive key events first via OpenTUI's focus system.

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
.4.3 | React bindings for OpenTUI (JSX → renderable tree) |
| `react` | ^19.2.7 | UI component model |
| `bun-types` | ^1.3.14 | Bun runtime type definitions |
| `typescript` | ^7.0.2 | Type checking |
| `yt-dlp` | (external) | Video/audio extraction and download |

Note: TypeScript ^7.0.2 tracks the Bun-bundled version — this is expected and not a mistake.
