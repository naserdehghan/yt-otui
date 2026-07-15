import { useState } from "react"

interface UrlScreenProps {
  onSubmit: (url: string) => void
  errorMessage?: string | null
}

export function UrlScreen({ onSubmit, errorMessage }: UrlScreenProps) {
  const [value, setValue] = useState("")

  return (
    <box
      style={{
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <text fg="#FF0000">yt-otui</text>
      <text>Paste a YouTube URL and press Enter</text>
      <box
        title="YouTube URL"
        style={{ border: true, width: 60, height: 3, marginTop: 1 }}
      >
        <input
          focused
          placeholder="https://www.youtube.com/watch?v=..."
          value={value}
          onInput={setValue}
          onSubmit={
            // Input's runtime "enter" event always passes a string; the type
            // is over-intersected with Textarea's SubmitEvent signature in
            // @opentui/react's declarations.
            (((v: string) => {
              if (v.trim().length > 0) onSubmit(v.trim())
            }) as any)
          }
        />
      </box>
      {errorMessage ? (
        <text fg="#FF5555" style={{ marginTop: 1 }}>
          {errorMessage}
        </text>
      ) : null}
      <text fg="#888888" style={{ marginTop: 1 }}>
        Esc to quit
      </text>
    </box>
  )
}
