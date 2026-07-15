import { useCallback, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { UrlScreen } from "./screens/UrlScreen"
import { LoadingScreen } from "./screens/LoadingScreen"
import { FormatScreen } from "./screens/FormatScreen"
import { DownloadScreen } from "./screens/DownloadScreen"
import { DoneScreen } from "./screens/DoneScreen"
import { SettingsModal } from "./components/SettingsModal"
import { curateFormats, type FormatOption } from "./formats"
import { downloadVideo, fetchVideoInfo, type DownloadProgress, type VideoInfo } from "./ytdlp"
import { loadConfig, resolveDownloadDir, saveConfig, type AppConfig } from "./config"

type Screen =
  | { name: "url"; error: string | null }
  | { name: "loading"; message: string }
  | { name: "formats"; url: string; info: VideoInfo; formats: FormatOption[] }
  | { name: "downloading"; title: string; progress: DownloadProgress }
  | { name: "done"; filePath: string; fileSize: number }

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: "url", error: null })
  const [config, setConfig] = useState<AppConfig>(() => loadConfig())
  const [settingsOpen, setSettingsOpen] = useState(false)

  const handleUrlSubmit = useCallback(async (url: string) => {
    setScreen({ name: "loading", message: "Fetching video info..." })
    try {
      const info = await fetchVideoInfo(url)
      const formats = curateFormats(info)
      setScreen({ name: "formats", url, info, formats })
    } catch (err) {
      setScreen({ name: "url", error: err instanceof Error ? err.message : String(err) })
    }
  }, [])

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
      if (screen.name === "url") process.exit(0)
      if (screen.name === "formats") setScreen({ name: "url", error: null })
      if (screen.name === "done") process.exit(0)
    }
    if (key.name === "q" && screen.name === "done") process.exit(0)
    if (key.name === "n" && screen.name === "done") setScreen({ name: "url", error: null })
  })

  const renderScreen = () => {
    switch (screen.name) {
      case "url":
        return <UrlScreen onSubmit={handleUrlSubmit} errorMessage={screen.error} />
      case "loading":
        return <LoadingScreen message={screen.message} />
      case "formats":
        return (
          <FormatScreen
            info={screen.info}
            formats={screen.formats}
            onSelect={(format) => handleFormatSelect(screen.url, screen.info, format)}
          />
        )
      case "downloading":
        return <DownloadScreen title={screen.title} progress={screen.progress} />
      case "done":
        return <DoneScreen filePath={screen.filePath} fileSize={screen.fileSize} />
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
