import type { FormatOption } from "../formats"
import type { PlaylistInfo } from "../ytdlp"

interface PlaylistFormatScreenProps {
  playlist: PlaylistInfo
  formats: FormatOption[]
  onSelect: (format: FormatOption) => void
}

const MAX_VISIBLE_ITEMS = 6

export function PlaylistFormatScreen({ playlist, formats, onSelect }: PlaylistFormatScreenProps) {
  const visibleItems = Math.min(formats.length, MAX_VISIBLE_ITEMS)
  const listHeight = visibleItems * 2 + 2

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
        title="Playlist"
        style={{ border: true, width: 70, flexDirection: "column", padding: 1 }}
      >
        <text>{playlist.title}</text>
        <text fg="#888888">{playlist.entries.length} videos</text>
      </box>
      <box title="Select format/quality (applies to all)" style={{ border: true, width: 70, height: listHeight }}>
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
