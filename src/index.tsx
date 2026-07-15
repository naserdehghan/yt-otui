import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { checkYtDlpInstalled } from "./shared/services/ytdlp"
import { App } from "./app/App"

if (!checkYtDlpInstalled()) {
  console.error("yt-dlp not found on PATH.")
  console.error("Install it first, e.g.: brew install yt-dlp")
  process.exit(1)
}

const renderer = await createCliRenderer({ exitOnCtrlC: true })
createRoot(renderer).render(<App />)
