import { ProgressBar } from "../download"
import type { PlaylistItemState } from "./types"

interface PlaylistDownloadScreenProps {
  playlistTitle: string
  items: PlaylistItemState[]
  activeIndex: number
}

const MAX_VISIBLE_ITEMS = 8

const STATUS_ICON: Record<PlaylistItemState["status"], string> = {
  pending: "○",
  downloading: "▶",
  done: "✓",
  error: "✗",
}

const STATUS_COLOR: Record<PlaylistItemState["status"], string> = {
  pending: "#888888",
  downloading: "#FFCC00",
  done: "#00FF00",
  error: "#FF5555",
}

export function PlaylistDownloadScreen({ playlistTitle, items, activeIndex }: PlaylistDownloadScreenProps) {
  const doneCount = items.filter((i) => i.status === "done" || i.status === "error").length
  const active = items[activeIndex]
  const percent = active?.progress
    ? Number.parseFloat(active.progress.percent.replace("%", "").trim()) || 0
    : 0

  const windowStart = Math.max(
    0,
    Math.min(activeIndex - Math.floor(MAX_VISIBLE_ITEMS / 2), items.length - MAX_VISIBLE_ITEMS),
  )
  const visible = items.slice(windowStart, windowStart + MAX_VISIBLE_ITEMS)

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
      <text>{playlistTitle}</text>
      <text fg="#888888">
        {doneCount} / {items.length} complete
      </text>
      <box title="Videos" style={{ border: true, width: 70, flexDirection: "column", padding: 1 }}>
        {visible.map((item, i) => {
          const index = windowStart + i
          return (
            <text key={index} fg={STATUS_COLOR[item.status]}>
              {STATUS_ICON[item.status]} {item.title}
            </text>
          )
        })}
      </box>
      {active && active.status === "downloading" ? (
        <>
          <ProgressBar percent={percent} width={44} />
          <text fg="#888888">
            {active.progress?.speed || "..."} · ETA {active.progress?.eta || "?"}
          </text>
        </>
      ) : null}
    </box>
  )
}
