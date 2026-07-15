import { useState } from "react"
import { useKeyboard } from "@opentui/react"
import type { AppConfig, DownloadDirMode } from "./config"
import { resolveDownloadDir } from "./config"

interface SettingsModalProps {
  config: AppConfig
  onSave: (config: AppConfig) => void
  onClose: () => void
}

const MODE_OPTIONS: { mode: DownloadDirMode; name: string; description: string }[] = [
  { mode: "os", name: "OS Download Directory", description: "~/Downloads" },
  { mode: "cwd", name: "Current Directory", description: "Directory the app was launched from" },
  { mode: "input", name: "Input Directory", description: "Type a custom path" },
]

export function SettingsModal({ config, onSave, onClose }: SettingsModalProps) {
  const [mode, setMode] = useState<DownloadDirMode>(config.downloadDirMode)
  const [customDir, setCustomDir] = useState(config.customDownloadDir)
  const [focusInput, setFocusInput] = useState(mode === "input")

  useKeyboard((key) => {
    if (key.name === "escape") {
      if (focusInput) setFocusInput(false)
      else onClose()
    }
  })

  const commit = (nextMode: DownloadDirMode, nextCustomDir: string) => {
    onSave({ downloadDirMode: nextMode, customDownloadDir: nextCustomDir })
  }

  return (
    <box
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 100,
      }}
    >
      <box
        title="Settings"
        style={{
          border: true,
          width: 60,
          flexDirection: "column",
          padding: 1,
          gap: 1,
          backgroundColor: "#000000",
        }}
      >
        <text fg="#888888">Download directory</text>
        <box style={{ border: true, width: "100%", height: 5 }}>
          <select
            focused={!focusInput}
            style={{ width: "100%", height: "100%" }}
            options={MODE_OPTIONS.map((o) => ({ name: o.name, description: o.description }))}
            selectedIndex={MODE_OPTIONS.findIndex((o) => o.mode === mode)}
            onSelect={(index) => {
              const next = MODE_OPTIONS[index]
              if (!next) return
              setMode(next.mode)
              if (next.mode === "input") {
                setFocusInput(true)
              } else {
                setFocusInput(false)
                commit(next.mode, customDir)
              }
            }}
          />
        </box>
        {mode === "input" ? (
          <box title="Path" style={{ border: true, width: "100%", height: 3 }}>
            <input
              focused={focusInput}
              placeholder="/path/to/downloads"
              value={customDir}
              onInput={setCustomDir}
              onSubmit={
                (((v: string) => {
                  setCustomDir(v)
                  commit("input", v)
                  setFocusInput(false)
                }) as any)
              }
            />
          </box>
        ) : null}
        <text fg="#888888">Resolved: {resolveDownloadDir({ downloadDirMode: mode, customDownloadDir: customDir })}</text>
        <text fg="#888888">
          {focusInput
            ? "Enter to save path · Esc to go back"
            : mode === "input"
              ? "Enter to edit path · Esc to close"
              : "Enter/arrows to choose · Esc to close"}
        </text>
      </box>
    </box>
  )
}
