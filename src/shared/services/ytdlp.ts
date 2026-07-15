import { join } from "node:path"

export interface RawFormat {
  format_id: string
  ext: string
  vcodec?: string
  acodec?: string
  height?: number
  filesize?: number | null
  filesize_approx?: number | null
}

export interface VideoInfo {
  title: string
  uploader?: string
  duration_string?: string
  view_count?: number
  upload_date?: string
  formats: RawFormat[]
}

export interface PlaylistEntry {
  id: string
  title: string
  url: string
}

export interface PlaylistInfo {
  title: string
  entries: PlaylistEntry[]
}

export interface DownloadProgress {
  percent: string
  speed: string
  eta: string
}

export interface DownloadResult {
  filePath: string
  fileSize: number
}

export function checkYtDlpInstalled(): boolean {
  return Bun.which("yt-dlp") !== null
}

function cookieArgs(cookiesFromBrowser?: string): string[] {
  return cookiesFromBrowser && cookiesFromBrowser !== "none"
    ? ["--cookies-from-browser", cookiesFromBrowser]
    : []
}

export function parseYouTubeUrl(url: string): { videoId: string | null; listId: string | null } {
  try {
    const parsed = new URL(url)
    const listId = parsed.searchParams.get("list")
    let videoId = parsed.searchParams.get("v")
    if (!videoId && parsed.hostname.includes("youtu.be")) {
      videoId = parsed.pathname.slice(1) || null
    }
    return { videoId, listId }
  } catch {
    return { videoId: null, listId: null }
  }
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, "_").trim() || "playlist"
}

function isPlaylistInfo(data: unknown): data is { title?: string; entries: unknown[] } {
  return (
    typeof data === "object" &&
    data !== null &&
    Array.isArray((data as { entries?: unknown }).entries)
  )
}

export async function fetchInfo(
  url: string,
  opts?: { noPlaylist?: boolean; cookiesFromBrowser?: string },
): Promise<VideoInfo | PlaylistInfo> {
  const args = ["yt-dlp", "-J", "--flat-playlist"]
  if (opts?.noPlaylist) args.push("--no-playlist")
  args.push(...cookieArgs(opts?.cookiesFromBrowser))
  args.push(url)

  const proc = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "pipe",
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])

  if (exitCode !== 0) {
    const tail = stderr.trim().split("\n").slice(-5).join("\n")
    throw new Error(tail || `yt-dlp exited with code ${exitCode}`)
  }

  const data = JSON.parse(stdout)

  if (isPlaylistInfo(data)) {
    const entries: PlaylistEntry[] = (data.entries as Record<string, unknown>[])
      .filter((e) => typeof e.id === "string")
      .map((e) => ({
        id: e.id as string,
        title: (e.title as string) ?? (e.id as string),
        url:
          (e.webpage_url as string) ??
          (typeof e.url === "string" && e.url.startsWith("http") ? (e.url as string) : null) ??
          `https://www.youtube.com/watch?v=${e.id}`,
      }))
    return { title: data.title ?? "Playlist", entries }
  }

  return data as VideoInfo
}

export async function downloadVideo(
  url: string,
  formatArgs: string[],
  downloadDir: string,
  onProgress: (progress: DownloadProgress) => void,
  cookiesFromBrowser?: string,
): Promise<DownloadResult> {
  const outputTemplate = join(downloadDir, "%(title)s.%(ext)s")

  const proc = Bun.spawn(
    [
      "yt-dlp",
      ...formatArgs,
      "--no-playlist",
      "--newline",
      "--progress-template",
      "PROG|%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s",
      ...cookieArgs(cookiesFromBrowser),
      "-o",
      outputTemplate,
      url,
    ],
    { stdout: "pipe", stderr: "pipe" },
  )

  let finalPath: string | null = null
  let destinationPath: string | null = null
  const stderrLines: string[] = []

  const readLines = async (stream: ReadableStream<Uint8Array>, isStderr: boolean) => {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        if (isStderr) {
          stderrLines.push(line)
          continue
        }
        if (line.startsWith("PROG|")) {
          const [, percent, speed, eta] = line.split("|")
          onProgress({ percent: percent ?? "", speed: speed ?? "", eta: eta ?? "" })
        } else if (line.startsWith("[Merger] Merging formats into")) {
          const match = line.match(/"(.+)"/)
          if (match) finalPath = match[1]
        } else if (line.startsWith("[download] Destination:")) {
          destinationPath = line.replace("[download] Destination:", "").trim()
        } else if (line.startsWith("[ExtractAudio] Destination:")) {
          destinationPath = line.replace("[ExtractAudio] Destination:", "").trim()
        }
      }
    }
  }

  await Promise.all([readLines(proc.stdout, false), readLines(proc.stderr, true), proc.exited])

  const exitCode = proc.exitCode
  if (exitCode !== 0) {
    const tail = stderrLines.filter(Boolean).slice(-5).join("\n")
    throw new Error(tail || `yt-dlp exited with code ${exitCode}`)
  }

  const filePath = finalPath ?? destinationPath
  if (!filePath) {
    throw new Error("Could not determine downloaded file path")
  }

  const file = Bun.file(filePath)
  const fileSize = (await file.exists()) ? file.size : 0

  return { filePath, fileSize }
}

export interface PlaylistItemUpdate {
  status: "downloading" | "done" | "error"
  progress?: DownloadProgress
  result?: DownloadResult
  error?: string
}

export async function downloadPlaylist(
  entries: PlaylistEntry[],
  formatArgs: string[],
  downloadDir: string,
  onItemUpdate: (index: number, update: PlaylistItemUpdate) => void,
  cookiesFromBrowser?: string,
): Promise<void> {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!
    onItemUpdate(i, { status: "downloading" })
    try {
      const result = await downloadVideo(
        entry.url,
        formatArgs,
        downloadDir,
        (progress) => {
          onItemUpdate(i, { status: "downloading", progress })
        },
        cookiesFromBrowser,
      )
      onItemUpdate(i, { status: "done", result })
    } catch (err) {
      onItemUpdate(i, {
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}
