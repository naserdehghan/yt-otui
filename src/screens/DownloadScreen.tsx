import { ProgressBar } from "../components/ProgressBar"
import type { DownloadProgress } from "../ytdlp"

interface DownloadScreenProps {
  title: string
  progress: DownloadProgress
}

export function DownloadScreen({ title, progress }: DownloadScreenProps) {
  const percent = parseFloat(progress.percent.replace("%", "").trim()) || 0

  return (
    <box
      style={{
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <text>Downloading: {title}</text>
      <ProgressBar percent={percent} width={44} />
      <text fg="#888888">
        {progress.speed || "..."} · ETA {progress.eta || "?"}
      </text>
    </box>
  )
}
