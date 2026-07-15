import type { FormatOption } from "../features/format/formats"
import type { PlaylistItemState } from "../features/playlist/types"
import type { DownloadProgress, PlaylistEntry, PlaylistInfo, VideoInfo } from "../shared/services/ytdlp"

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

export type { Screen, PlaylistItemState }
