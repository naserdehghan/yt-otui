import { useCallback, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { UrlScreen } from "./screens/UrlScreen"
import { LoadingScreen } from "./screens/LoadingScreen"
import { FormatScreen } from "./screens/FormatScreen"
import { DownloadScreen } from "./screens/DownloadScreen"
import { DoneScreen } from "./screens/DoneScreen"
import { curateFormats, type FormatOption } from "./formats"
import { downloadVideo, fetchVideoInfo, type DownloadProgress, type VideoInfo } from "./ytdlp"

type Screen =
  | { name: "url"; error: string | null }
  | { name: "loading"; message: string }
  | { name: "formats"; url: string; info: VideoInfo; formats: FormatOption[] }
  | { name: "downloading"; title: string; progress: DownloadProgress }
  | { name: "done"; filePath: string; fileSize: number }

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: "url", error: null })

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
        const result = await downloadVideo(url, format.args, (progress) => {
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
    [],
  )

  useKeyboard((key) => {
    if (key.name === "escape") {
      if (screen.name === "url") process.exit(0)
      if (screen.name === "formats") setScreen({ name: "url", error: null })
      if (screen.name === "done") process.exit(0)
    }
    if (key.name === "q" && screen.name === "done") process.exit(0)
    if (key.name === "n" && screen.name === "done") setScreen({ name: "url", error: null })
  })

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
