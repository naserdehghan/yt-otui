import { formatBytes } from "../../shared/utils/formatBytes"
import type { PlaylistItemState } from "./types"

interface PlaylistDoneScreenProps {
  playlistTitle: string
  items: PlaylistItemState[]
}

const MAX_VISIBLE_ITEMS = 8

export function PlaylistDoneScreen({ playlistTitle, items }: PlaylistDoneScreenProps) {
  const succeeded = items.filter((i) => i.status === "done").length
  const failed = items.filter((i) => i.status === "error").length
  const visible = items.slice(0, MAX_VISIBLE_ITEMS)

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
      <text fg={failed > 0 ? "#FFCC00" : "#00FF00"}>
        {playlistTitle} — {succeeded} succeeded{failed > 0 ? `, ${failed} failed` : ""}
      </text>
      <box title="Results" style={{ border: true, width: 70, flexDirection: "column", padding: 1 }}>
        {visible.map((item, index) => (
          <text key={index} fg={item.status === "error" ? "#FF5555" : "#888888"}>
            {item.status === "error" ? "✗" : "✓"} {item.title}
            {item.status === "error" ? ` — ${item.error}` : item.filePath ? ` — ${formatBytes(item.fileSize ?? 0)}` : ""}
          </text>
        ))}
        {items.length > MAX_VISIBLE_ITEMS ? (
          <text fg="#555555">...and {items.length - MAX_VISIBLE_ITEMS} more</text>
        ) : null}
      </box>
      <text fg="#888888">n = new download · q / Esc = quit</text>
    </box>
  )
}
