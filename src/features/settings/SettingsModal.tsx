import { useState } from "react"
import { useKeyboard } from "@opentui/react"
import type { AppConfig, CookieBrowser, DownloadDirMode } from "./config"
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

const COOKIE_OPTIONS: { browser: CookieBrowser; name: string; description: string }[] = [
  { browser: "none", name: "None", description: "Do not send cookies" },
  { browser: "brave", name: "Brave", description: "Read cookies from Brave" },
  { browser: "chrome", name: "Chrome", description: "Read cookies from Chrome" },
  { browser: "chromium", name: "Chromium", description: "Read cookies from Chromium" },
  { browser: "edge", name: "Edge", description: "Read cookies from Edge" },
  { browser: "firefox", name: "Firefox", description: "Read cookies from Firefox" },
  { browser: "opera", name: "Opera", description: "Read cookies from Opera" },
  { browser: "safari", name: "Safari", description: "Read cookies from Safari" },
  { browser: "vivaldi", name: "Vivaldi", description: "Read cookies from Vivaldi" },
  { browser: "whale", name: "Whale", description: "Read cookies from Whale" },
]

type Section = "list" | "downloadDir" | "cookies"

export function SettingsModal({ config, onSave, onClose }: SettingsModalProps) {
  const [mode, setMode] = useState<DownloadDirMode>(config.downloadDirMode)
  const [customDir, setCustomDir] = useState(config.customDownloadDir)
  const [cookieBrowser, setCookieBrowser] = useState<CookieBrowser>(config.cookiesFromBrowser)
  const [section, setSection] = useState<Section>("list")
  const [focusInput, setFocusInput] = useState(false)
  const [listIndex, setListIndex] = useState(0)

  const commit = (overrides: Partial<AppConfig>) => {
    onSave({
      downloadDirMode: overrides.downloadDirMode ?? mode,
      customDownloadDir: overrides.customDownloadDir ?? customDir,
      cookiesFromBrowser: overrides.cookiesFromBrowser ?? cookieBrowser,
    })
  }

  const rows = [
    { label: "Download directory", value: resolveDownloadDir({ downloadDirMode: mode, customDownloadDir: customDir }) },
    { label: "Browser cookies", value: COOKIE_OPTIONS.find((o) => o.browser === cookieBrowser)?.name ?? "None" },
  ]

  useKeyboard((key) => {
    if (section === "list") {
      if (key.name === "up" || key.name === "k") {
        setListIndex((i) => Math.max(0, i - 1))
      } else if (key.name === "down" || key.name === "j") {
        setListIndex((i) => Math.min(rows.length - 1, i + 1))
      } else if (key.name === "return" || key.name === "linefeed") {
        setSection(listIndex === 0 ? "downloadDir" : "cookies")
      } else if (key.name === "escape") {
        onClose()
      }
      return
    }

    if (key.name === "escape") {
      if (section === "downloadDir" && focusInput) {
        setFocusInput(false)
      } else {
        setSection("list")
      }
    }
  })

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
        {section === "list" ? (
          <>
            <box style={{ flexDirection: "column", width: "100%" }}>
              {rows.map((row, index) => (
                <box
                  key={row.label}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    width: "100%",
                    paddingLeft: 1,
                    paddingRight: 1,
                    backgroundColor: index === listIndex ? "#333333" : undefined,
                  }}
                >
                  <text fg={index === listIndex ? "#FFFFFF" : "#CCCCCC"}>{row.label}</text>
                  <text fg="#888888">{row.value}</text>
                </box>
              ))}
            </box>
            <text fg="#888888">↑/↓ select · Enter to change · Esc to close</text>
          </>
        ) : null}

        {section === "downloadDir" ? (
          <>
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
                    commit({ downloadDirMode: next.mode })
                    setSection("list")
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
                      commit({ downloadDirMode: "input", customDownloadDir: v })
                      setFocusInput(false)
                      setSection("list")
                    }) as any)
                  }
                />
              </box>
            ) : null}
            <text fg="#888888">Resolved: {resolveDownloadDir({ downloadDirMode: mode, customDownloadDir: customDir })}</text>
            <text fg="#888888">
              {focusInput ? "Enter to save path · Esc to go back" : "Enter/arrows to choose · Esc to go back"}
            </text>
          </>
        ) : null}

        {section === "cookies" ? (
          <>
            <text fg="#888888">Browser cookies (for age/login-restricted videos)</text>
            <box style={{ border: true, width: "100%", height: 5 }}>
              <select
                focused
                style={{ width: "100%", height: "100%" }}
                options={COOKIE_OPTIONS.map((o) => ({ name: o.name, description: o.description }))}
                selectedIndex={COOKIE_OPTIONS.findIndex((o) => o.browser === cookieBrowser)}
                onSelect={(index) => {
                  const next = COOKIE_OPTIONS[index]
                  if (!next) return
                  setCookieBrowser(next.browser)
                  commit({ cookiesFromBrowser: next.browser })
                  setSection("list")
                }}
              />
            </box>
            <text fg="#888888">Enter/arrows to choose · Esc to go back</text>
          </>
        ) : null}
      </box>
    </box>
  )
}
