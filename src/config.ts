import { homedir } from "node:os"
import { join } from "node:path"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"

export type DownloadDirMode = "os" | "cwd" | "input"

export interface AppConfig {
  downloadDirMode: DownloadDirMode
  customDownloadDir: string
}

const CONFIG_DIR = join(homedir(), ".config", "yt-otui")
const CONFIG_PATH = join(CONFIG_DIR, "config.json")

const DEFAULT_CONFIG: AppConfig = {
  downloadDirMode: "os",
  customDownloadDir: "",
}

export function loadConfig(): AppConfig {
  try {
    const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as Partial<AppConfig>
    return {
      downloadDirMode: raw.downloadDirMode ?? DEFAULT_CONFIG.downloadDirMode,
      customDownloadDir: raw.customDownloadDir ?? DEFAULT_CONFIG.customDownloadDir,
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveConfig(config: AppConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
}

export function resolveDownloadDir(config: AppConfig): string {
  switch (config.downloadDirMode) {
    case "cwd":
      return process.cwd()
    case "input":
      return config.customDownloadDir.trim() || join(homedir(), "Downloads")
    case "os":
    default:
      return join(homedir(), "Downloads")
  }
}
