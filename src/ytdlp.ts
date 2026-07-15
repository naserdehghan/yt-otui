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

export async function fetchVideoInfo(url: string): Promise<VideoInfo> {
  const proc = Bun.spawn(["yt-dlp", "-J", "--no-playlist", url], {
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

  return JSON.parse(stdout) as VideoInfo
}

export async function downloadVideo(
  url: string,
  formatArgs: string[],
  downloadDir: string,
  onProgress: (progress: DownloadProgress) => void,
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
