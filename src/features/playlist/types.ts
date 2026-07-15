import type { DownloadProgress } from "../../shared/services/ytdlp"

export interface PlaylistItemState {
  title: string
  status: "pending" | "downloading" | "done" | "error"
  progress?: DownloadProgress
  filePath?: string
  fileSize?: number
  error?: string
}
