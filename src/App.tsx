import { useCallback, useState } from "react"
import { useKeyboard, useRenderer } from "@opentui/react"
import { join } from "node:path"
import { UrlScreen } from "./screens/UrlScreen"
import { LoadingScreen } from "./screens/LoadingScreen"
import { FormatScreen } from "./screens/FormatScreen"
import { DownloadScreen } from "./screens/DownloadScreen"
import { DoneScreen } from "./screens/DoneScreen"
import { PlaylistChoiceScreen } from "./screens/PlaylistChoiceScreen"
import { PlaylistFormatScreen } from "./screens/PlaylistFormatScreen"
import { PlaylistDownloadScreen } from "./screens/PlaylistDownloadScreen"
import { PlaylistDoneScreen } from "./screens/PlaylistDoneScreen"
import { SettingsModal } from "./components/SettingsModal"
import { curateFormats, defaultFormatOptions, type FormatOption } from "./formats"
import {
  downloadPlaylist,
  downloadVideo,
  fetchInfo,
  parseYouTubeUrl,
  sanitizeFilename,
  type DownloadProgress,
  type PlaylistEntry,
  type PlaylistInfo,
  type VideoInfo,
} from "./ytdlp"
import { loadConfig, resolveDownloadDir, saveConfig, type AppConfig } from "./config"

export interface PlaylistItemState {
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

export function App() {
  const renderer = useRenderer()
  const [screen, setScreen] = useState<Screen>({ name: "url", error: null })
  const [config, setConfig] = useState<AppConfig>(() => loadConfig())
  const [settingsOpen, setSettingsOpen] = useState(false)

  const quit = useCallback(() => {
    renderer.destroy()
    process.exit(0)
  }, [renderer])

  const goToVideoFormats = useCallback(async (url: string) => {
    setScreen({ name: "loading", message: "Fetching video info..." })
    try {
      const info = (await fetchInfo(url, { noPlaylist: true })) as VideoInfo
      const formats = curateFormats(info)
      setScreen({ name: "formats", url, info, formats })
    } catch (err) {
      setScreen({ name: "url", error: err instanceof Error ? err.message : String(err) })
    }
  }, [])

  const goToPlaylistFormats = useCallback(async (url: string) => {
    setScreen({ name: "loading", message: "Fetching playlist info..." })
    try {
      const info = (await fetchInfo(url)) as PlaylistInfo
      setScreen({ name: "playlist-formats", playlist: info, formats: defaultFormatOptions() })
    } catch (err) {
      setScreen({ name: "url", error: err instanceof Error ? err.message : String(err) })
    }
  }, [])

  const handleUrlSubmit = useCallback(
    async (url: string) => {
      const { videoId, listId } = parseYouTubeUrl(url)
      if (videoId && listId) {
        setScreen({ name: "playlist-choice", url })
        return
      }

      setScreen({ name: "loading", message: "Fetching info..." })
      try {
        const info = await fetchInfo(url)
        if ("entries" in info) {
          setScreen({ name: "playlist-formats", playlist: info, formats: defaultFormatOptions() })
        } else {
          const formats = curateFormats(info)
          setScreen({ name: "formats", url, info, formats })
        }
      } catch (err) {
        setScreen({ name: "url", error: err instanceof Error ? err.message : String(err) })
      }
    },
    [],
  )

  const handlePlaylistChoice = useCallback(
    (url: string, mode: "video" | "playlist") => {
      if (mode === "video") {
        void goToVideoFormats(url)
      } else {
        void goToPlaylistFormats(url)
      }
    },
    [goToVideoFormats, goToPlaylistFormats],
  )

  const handleFormatSelect = useCallback(
    async (url: string, info: VideoInfo, format: FormatOption) => {
      setScreen({
        name: "downloading",
        title: info.title,
        progress: { percent: "0%", speed: "", eta: "" },
      })
      try {
        const downloadDir = resolveDownloadDir(config)
        const result = await downloadVideo(url, format.args, downloadDir, (progress) => {
          setScreen((prev) =>
            prev.name === "downloading" ? { ...prev, progress } : prev,
          )
        })
        setScreen({ name: "done", filePath: result.filePath, fileSize: result.fileSize })
      } catch (err) {
        setScreen({
          name: "url",
          error: err instanceof Error ? err.message : String(err),
        })
      }
    },
    [config],
  )

  const handlePlaylistFormatSelect = useCallback(
    async (playlist: PlaylistInfo, format: FormatOption) => {
      const baseDir = resolveDownloadDir(config)
      const downloadDir = join(baseDir, sanitizeFilename(playlist.title))
      const items: PlaylistItemState[] = playlist.entries.map((e) => ({
        title: e.title,
        status: "pending",
      }))

      setScreen({
        name: "playlist-downloading",
        playlistTitle: playlist.title,
        entries: playlist.entries,
        items,
        activeIndex: 0,
      })

      await downloadPlaylist(playlist.entries, format.args, downloadDir, (index, update) => {
        setScreen((prev) => {
          if (prev.name !== "playlist-downloading") return prev
          const nextItems = prev.items.slice()
          const current = nextItems[index]
          if (!current) return prev
          nextItems[index] = {
            ...current,
            status: update.status,
            progress: update.progress ?? current.progress,
            filePath: update.result?.filePath ?? current.filePath,
            fileSize: update.result?.fileSize ?? current.fileSize,
            error: update.error ?? current.error,
          }
          return { ...prev, items: nextItems, activeIndex: index }
        })
      })

      setScreen((prev) =>
        prev.name === "playlist-downloading"
          ? { name: "playlist-done", playlistTitle: prev.playlistTitle, items: prev.items }
          : prev,
      )
    },
    [config],
  )

  const handleSettingsSave = useCallback((next: AppConfig) => {
    setConfig(next)
    saveConfig(next)
  }, [])

  useKeyboard((key) => {
    // Ctrl+Shift+/ collapses to the same control byte as Ctrl+_ outside the
    // Kitty keyboard protocol, so shift can't be required — most terminals
    // never set key.shift for this combo even though the user pressed it.
    if (key.ctrl && (key.name === "/" || key.name === "_")) {
      setSettingsOpen((prev) => !prev)
      return
    }
    if (settingsOpen) return
    if (key.name === "escape") {
      if (screen.name === "url") quit()
      if (screen.name === "formats") setScreen({ name: "url", error: null })
      if (screen.name === "playlist-choice") setScreen({ name: "url", error: null })
      if (screen.name === "playlist-formats") setScreen({ name: "url", error: null })
      if (screen.name === "done") quit()
      if (screen.name === "playlist-done") quit()
    }
    if (key.name === "q" && screen.name === "done") quit()
    if (key.name === "q" && screen.name === "playlist-done") quit()
    if (key.name === "n" && screen.name === "done") setScreen({ name: "url", error: null })
    if (key.name === "n" && screen.name === "playlist-done") setScreen({ name: "url", error: null })
  })

  const renderScreen = () => {
    switch (screen.name) {
      case "url":
        return <UrlScreen onSubmit={handleUrlSubmit} errorMessage={screen.error} />
      case "loading":
        return <LoadingScreen message={screen.message} />
      case "playlist-choice":
        return (
          <PlaylistChoiceScreen onChoose={(mode) => handlePlaylistChoice(screen.url, mode)} />
        )
      case "formats":
        return (
          <FormatScreen
            info={screen.info}
            formats={screen.formats}
            onSelect={(format) => handleFormatSelect(screen.url, screen.info, format)}
          />
        )
      case "playlist-formats":
        return (
          <PlaylistFormatScreen
            playlist={screen.playlist}
            formats={screen.formats}
            onSelect={(format) => handlePlaylistFormatSelect(screen.playlist, format)}
          />
        )
      case "downloading":
        return <DownloadScreen title={screen.title} progress={screen.progress} />
      case "done":
        return <DoneScreen filePath={screen.filePath} fileSize={screen.fileSize} />
      case "playlist-downloading":
        return (
          <PlaylistDownloadScreen
            playlistTitle={screen.playlistTitle}
            items={screen.items}
            activeIndex={screen.activeIndex}
          />
        )
      case "playlist-done":
        return <PlaylistDoneScreen playlistTitle={screen.playlistTitle} items={screen.items} />
    }
  }

  return (
    <box style={{ width: "100%", height: "100%", position: "relative" }}>
      {renderScreen()}
      <text
        fg="#555555"
        style={{ position: "absolute", bottom: 0, right: 1 }}
      >
        ctrl+shift+/ settings
      </text>
      {settingsOpen ? (
        <SettingsModal config={config} onSave={handleSettingsSave} onClose={() => setSettingsOpen(false)} />
      ) : null}
    </box>
  )
}
