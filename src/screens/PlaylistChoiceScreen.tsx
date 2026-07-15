interface PlaylistChoiceScreenProps {
  onChoose: (mode: "video" | "playlist") => void
}

export function PlaylistChoiceScreen({ onChoose }: PlaylistChoiceScreenProps) {
  const options = [
    { name: "Just this video", description: "Download only the linked video" },
    { name: "Whole playlist", description: "Download every video in the playlist" },
  ]

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
      <text>This link is part of a playlist</text>
      <box title="What do you want to download?" style={{ border: true, width: 60, height: 6 }}>
        <select
          focused
          style={{ width: "100%", height: "100%" }}
          options={options}
          onSelect={(index) => onChoose(index === 0 ? "video" : "playlist")}
        />
      </box>
      <text fg="#888888">Esc to go back</text>
    </box>
  )
}
