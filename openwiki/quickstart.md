# yt-otui Quickstart

**yt-otui** is a terminal user interface (TUI) YouTube downloader built with [OpenTUI](https://opentui.com) (React bindings) and Bun. It wraps `yt-dlp` in an interactive terminal app: paste a URL, pick a quality tier, watch the download progress, and get the file path — all without leaving the terminal.

## Quick Start

```bash
# Prerequisites
bun install             # install OpenTUI + React dependencies
brew install yt-dlp     # or your package manager's equivalent

# Run
bun start               # starts src/index.tsx
```

The app opens to a URL input screen. Paste a YouTube URL, press Enter, select a format, and the download begins.

## Repository Layout

```
yt-otui/
├── src/
│   ├── index.tsx              # Entrypoint: yt-dlp check, renderer init, render <App />
│   ├── App.tsx                # Root component: state machine (9 screen variants), config state, settings modal
│   ├── config.ts              # AppConfig type, config persistence (~/.config/yt-otui/config.json), download dir resolution
│   ├── ytdlp.ts               # yt-dlp wrapper: types, fetchInfo, downloadVideo, downloadPlaylist
│   ├── formats.ts             # Format curation: raw yt-dlp formats → user-facing options
│   ├── screens/
│   │   ├── UrlScreen.tsx               # URL input with error display
│   │   ├── LoadingScreen.tsx           # Spinner while fetching video info
│   │   ├── FormatScreen.tsx            # Quality/format picker (select list)
│   │   ├── DownloadScreen.tsx          # Progress bar + speed/ETA
│   │   ├── DoneScreen.tsx              # File path + size confirmation
│   │   ├── PlaylistChoiceScreen.tsx    # "Video or playlist?" decision (when URL has both v & list)
│   │   ├── PlaylistFormatScreen.tsx    # Format picker that applies to all entries
│   │   ├── PlaylistDownloadScreen.tsx  # Per-video progress with scrollable entry list
│   │   └── PlaylistDoneScreen.tsx      # Summary: succeeded/failed per entry
│   └── components/
│       ├── ProgressBar.tsx    # Reusable filled-bar component
│       └── SettingsModal.tsx  # Settings overlay: download directory mode selector
├── .github/workflows/
│   └── openwiki-update.yml    # Scheduled OpenWiki doc regeneration
├── .agents/skills/opentui/    # OpenTUI agent skill (SKILL.md + reference docs)
├── package.json               # Bun project config, entry: src/index.tsx
├── tsconfig.json              # TypeScript + JSX config for OpenTUI React
├── AGENTS.md                  # OpenWiki agent instructions
├── CLAUDE.md                  # OpenWiki agent instructions (duplicate)
├── skills-lock.json           # Lockfile for agent skills
└── openwiki/
    ├── INSTRUCTIONS.md        # OpenWiki brief (user-authored)
    ├── quickstart.md          # THIS FILE
    └── architecture/
        └── overview.md        # Architecture deep-dive
```

## Key Concepts

### Screen State Machine

The app has two parallel flows: a **single-video path** (5 screens) and a **playlist path** (4 screens). The router in `App.tsx` selects the path at URL-submit time based on the parsed URL.

```
Single video (default):
URL ──▶ Loading ──▶ Format Selection ──▶ Downloading ──▶ Done
 │                                                       │
 └──────────────── (error/back) ◀───────────────────────┘

Playlist:
URL ──▶ Playlist Choice ──▶ Playlist Format ──▶ Playlist Downloading ──▶ Playlist Done
 │          │      │                                                    │
 │          │ video│                                                    │
 │          ▼      ▼                                                    │
 │      Single-video path                                              │
 └──(detected automatically)────────────────────────────────────────────┘
```

When a URL contains both a `videoId` and `listId` (e.g. `youtube.com/watch?v=...&list=...`), the **Playlist Choice** screen asks whether to download just that one video or the full playlist. URLs that resolve entirely to a playlist (no single-video fallback, e.g. `youtube.com/playlist?list=...`) skip directly to playlist format selection.

State is modeled as a discriminated union (`Screen` type) in `App.tsx`. Each screen maps to one React component. The URL, Playlist Choice, and Format screens can return to earlier states on error or user action.

### Format Curation (`formats.ts`)

Raw yt-dlp format lists are curated into consistent user-facing options:

| Option | Format Args | Notes |
|---|---|---|
| **Best available** | `bestvideo+bestaudio/best` | Highest quality, any container |
| **2160p–360p MP4** | `bestvideo[height<=n][ext=mp4]+bestaudio[ext=m4a]/...` | Tiered MP4 quality (skips tiers above source max) |
| **Audio only (M4A)** | `bestaudio[ext=m4a]/bestaudio` + `-x --audio-format m4a` | Extracts best audio track |

Tiers are tried in descending order: 2160, 1440, 1080, 720, 480, 360. Tiers above the video's max height are skipped.

### yt-dlp Integration (`ytdlp.ts`)

All yt-dlp calls are made via `Bun.spawn` with stdout/stderr pipes:

- **`checkYtDlpInstalled()`** — uses `Bun.which("yt-dlp")` to verify the CLI exists on PATH
- **`fetchInfo(url, opts?)`** — runs `yt-dlp -J --flat-playlist <url>` (with `--no-playlist` when `opts.noPlaylist` is true), parses JSON output. Returns `VideoInfo` for single videos or `PlaylistInfo` (with `entries[]`) when the JSON includes an `entries` array. Throws on non-zero exit with last 5 stderr lines.
- **`parseYouTubeUrl(url)`** — extracts `videoId` and `listId` from a YouTube URL to detect playlist association before fetching.
- **`downloadVideo(url, formatArgs, downloadDir, onProgress)`** — runs yt-dlp with `--newline` + a custom `--progress-template`, parses `PROG|...` lines for real-time progress, detects final path from `[Merger]` / `[download] / `[ExtractAudio]` output lines. The download directory is resolved from config via `resolveDownloadDir(config)` in `App.tsx`.
- **`downloadPlaylist(entries, formatArgs, downloadDir, onItemUpdate)`** — iterates playlist entries, calling `downloadVideo` for each and reporting per-item status (downloading/done/error) via the callback. All entries share the same format args and download directory.

### Keyboard Navigation

| Key | Context | Action |
|---|---|---|
| Esc | URL screen | Quit |
| Esc | Format / Playlist Choice / Playlist Format screen | Back to URL |
| Esc | Done / Playlist Done screen | Quit |
| q | Done / Playlist Done screen | Quit |
| n | Done / Playlist Done screen | New download (reset to URL) |
| Ctrl+Shift+/ | Any | Toggle settings modal (download directory) |
| Enter | URL screen | Submit URL |
| Enter | Format / Playlist Format screen | Select highlighted format |
| Enter | Playlist Choice screen | Confirm choice (video or playlist) |

## Operations / Runbook

- **yt-dlp not found:** The app exits immediately at startup with a message directing the user to install it (`brew install yt-dlp`).
- **Invalid URL / fetch failure:** Error message displayed on the URL screen. The user can retry.
- **Download failure:** Returns to URL screen with the error message. Check yt-dlp version (`yt-dlp --version`) and network connectivity.
- **Config file:** Settings are persisted at `~/.config/yt-otui/config.json`. Delete this file to reset to defaults.
- **Force quit:** If the app hangs, Ctrl+C kills it (handled by `createCliRenderer({ exitOnCtrlC: true })`).
- **Typecheck:** Run `bun run typecheck` (which runs `tsc --noEmit`) to verify type correctness.

## Documentation Sections

- [Architecture Overview](/openwiki/architecture/overview.md) — state machine, component tree, data flow, design decisions

## Testing Guidance

This project has no formal test suite. Practical verification approaches:

1. **Type check:** `bunx tsc --noEmit` (or `bun run typecheck`) — catches type/JSX errors.
2. **Startup smoke test:** `timeout 3 bun run src/index.tsx` — the app should start and wait for input. Exit code 124 (killed by timeout) indicates success; exit code 1 means yt-dlp is missing or a crash occurred.
3. **Manual flow:** Run the app, enter a real YouTube short URL, select a format, verify the file appears in `~/Downloads/`.
4. **Format curation:** The `curateFormats()` function can be exercised by importing `formats.ts` into a small test script with mock yt-dlp JSON output.

## Integration Points

| Dependency | Role | Config |
|---|---|---|
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Video info extraction and download (spawned as subprocess) | Must be on `$PATH` |
| [OpenTUI](https://opentui.com) | Terminal rendering framework (`@opentui/core` + `@opentui/react`) | tsconfig JSX import source `@opentui/react` |
| [Bun](https://bun.sh) | JavaScript runtime, package manager, bundler | `bun.lock`, `package.json` scripts |

## Change Guidance for Future Agents

- **Adding a screen:** Define the new shape in the `Screen` union type in `App.tsx`, add the component under `src/screens/`, and add a `case` in the switch statement.
- **Modifying format options:** Edit `src/formats.ts` — update the `TIERS` array or add entries to the curated list. For playlist downloads, `defaultFormatOptions()` returns all tiers without per-video filtering; single-video filtering stays in `curateFormats()`.
- **Changing download output:** Edit `src/config.ts` — the `resolveDownloadDir()` function and config schema define download modes. The settings modal (`src/components/SettingsModal.tsx`) lets users pick the mode at runtime. Playlist downloads create a subfolder named after the playlist title under the configured directory.
- **Keyboard shortcuts:** Edit the `useKeyboard` hook in `App.tsx`.
- **Playlist behavior:** The URL router in `handleUrlSubmit` first calls `parseYouTubeUrl()` to detect playlist association, then `fetchInfo()` to decide if the response is a playlist. Adding support for other platforms' playlists would require updating `fetchInfo` (it already handles generic `entries` arrays) and the `parseYouTubeUrl` regex.
- **OpenTUI version bumps:** Check `@opentui/core` and `@opentui/react` in `package.json`. The `tsconfig.json` JSX configuration is OpenTUI-specific.

## Backlog

These areas exist but are not yet covered in depth in these docs:

| Area | Source anchor | Reason deferred |
|---|---|---|
| **Git history** | No `.git` directory in this checkout | No commit history to analyze. If git is initialized later, inspect the log for decisions around screen state machine design and yt-dlp argument handling. |
