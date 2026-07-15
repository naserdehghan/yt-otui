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
│   ├── App.tsx                # Root component: state machine (5 screens)
│   ├── ytdlp.ts               # yt-dlp wrapper: types, fetchVideoInfo, downloadVideo
│   ├── formats.ts             # Format curation: raw yt-dlp formats → user-facing options
│   ├── screens/
│   │   ├── UrlScreen.tsx      # URL input with error display
│   │   ├── LoadingScreen.tsx  # Spinner while fetching video info
│   │   ├── FormatScreen.tsx   # Quality/format picker (select list)
│   │   ├── DownloadScreen.tsx # Progress bar + speed/ETA
│   │   └── DoneScreen.tsx     # File path + size confirmation
│   └── components/
│       └── ProgressBar.tsx    # Reusable filled-bar component
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

The app is a linear state machine with five screens:

```
URL → Loading → Format Selection → Downloading → Done
 │                                                  │
 └── (error/back) ←─────────────────────────────────┘
```

State is modeled as a discriminated union (`Screen` type) in `App.tsx`. Each screen maps to one React component. The URL and Format screens can return to earlier states on error or user action.

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
- **`fetchVideoInfo(url)`** — runs `yt-dlp -J --no-playlist <url>`, parses JSON output. Throws on non-zero exit with last 5 stderr lines
- **`downloadVideo(url, formatArgs, onProgress)`** — runs yt-dlp with `--newline` + a custom `--progress-template`, parses `PROG|...` lines for real-time progress, detects final path from `[Merger]` / `[download] / [ExtractAudio]` output lines. Downloads to `~/Downloads/`

### Keyboard Navigation

| Key | Context | Action |
|---|---|---|
| Esc | URL screen | Quit |
| Esc | Format screen | Back to URL |
| Esc | Done screen | Quit |
| q | Done screen | Quit |
| n | Done screen | New download (reset to URL) |
| Enter | URL screen | Submit URL |
| Enter | Format screen | Select highlighted format |

## Operations / Runbook

- **yt-dlp not found:** The app exits immediately at startup with a message directing the user to install it (`brew install yt-dlp`).
- **Invalid URL / fetch failure:** Error message displayed on the URL screen. The user can retry.
- **Download failure:** Returns to URL screen with the error message. Check yt-dlp version (`yt-dlp --version`) and network connectivity.
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
- **Modifying format options:** Edit `src/formats.ts` — update the `TIERS` array or add entries to the curated list.
- **Changing download output:** Edit the `DOWNLOAD_DIR` constant and/or `outputTemplate` in `src/ytdlp.ts`.
- **Keyboard shortcuts:** Edit the `useKeyboard` hook in `App.tsx`.
- **OpenTUI version bumps:** Check `@opentui/core` and `@opentui/react` in `package.json`. The `tsconfig.json` JSX configuration is OpenTUI-specific.

## Backlog

These areas exist but are not yet covered in depth in these docs:

| Area | Source anchor | Reason deferred |
|---|---|---|
| **Configurability** | Download directory hardcoded at `src/ytdlp.ts` line 34 | Not yet implemented. No settings UI or CLI flags exist. |
| **Playlist support** | `--no-playlist` flag in `src/ytdlp.ts` lines 41, 71 | Explicitly disabled; playlist handling would require a significantly different flow. |
| **Git history** | No `.git` directory in this checkout | No commit history to analyze. If git is initialized later, inspect the log for decisions around screen state machine design and yt-dlp argument handling. |
