import type { FormatOption } from "../formats"
import type { VideoInfo } from "../ytdlp"

interface FormatScreenProps {
  info: VideoInfo
  formats: FormatOption[]
  onSelect: (format: FormatOption) => void
}

const MAX_VISIBLE_ITEMS = 6

export function FormatScreen({ info, formats, onSelect }: FormatScreenProps) {
  const visibleItems = Math.min(formats.length, MAX_VISIBLE_ITEMS)
  const listHeight = visibleItems * 2 + 2 // 2 rows/item (name+description) + border

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
      <box
        title="Video"
        style={{ border: true, width: 70, flexDirection: "column", padding: 1 }}
      >
        <text>{info.title}</text>
        {info.uploader ? <text fg="#888888">{info.uploader}</text> : null}
        <text fg="#888888">
          {info.duration_string ?? "?"}
          {typeof info.view_count === "number" ? ` · ${info.view_count.toLocaleString()} views` : ""}
        </text>
      </box>
      <box title="Select format/quality" style={{ border: true, width: 70, height: listHeight }}>
        <select
          focused
          style={{ width: "100%", height: "100%" }}
          options={formats.map((f) => ({ name: f.label, description: f.description }))}
          onSelect={(index) => {
            const format = formats[index]
            if (format) onSelect(format)
          }}
        />
      </box>
      <text fg="#888888">Enter to download · Esc to go back</text>
    </box>
  )
}
