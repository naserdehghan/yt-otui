interface DoneScreenProps {
  filePath: string
  fileSize: number
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`
  return `${mb.toFixed(1)} MB`
}

export function DoneScreen({ filePath, fileSize }: DoneScreenProps) {
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
      <text fg="#00FF00">Download complete</text>
      <box title="File" style={{ border: true, width: 70, flexDirection: "column", padding: 1 }}>
        <text>{filePath}</text>
        <text fg="#888888">{formatBytes(fileSize)}</text>
      </box>
      <text fg="#888888">n = new download · q / Esc = quit</text>
    </box>
  )
}
