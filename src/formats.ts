import type { RawFormat, VideoInfo } from "./ytdlp"

export interface FormatOption {
  label: string
  description: string
  args: string[]
}

const TIERS = [2160, 1440, 1080, 720, 480, 360]

function formatBytes(bytes: number | null | undefined): string | null {
  if (!bytes) return null
  const mb = bytes / (1024 * 1024)
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`
  return `${mb.toFixed(1)} MB`
}

function bestSizeForHeight(formats: RawFormat[], height: number): string | null {
  const candidates = formats.filter(
    (f) => f.vcodec && f.vcodec !== "none" && f.height === height,
  )
  for (const f of candidates) {
    const size = formatBytes(f.filesize ?? f.filesize_approx)
    if (size) return size
  }
  return null
}

export function curateFormats(info: VideoInfo): FormatOption[] {
  const heights = new Set<number>()
  for (const f of info.formats) {
    if (f.vcodec && f.vcodec !== "none" && f.height) heights.add(f.height)
  }

  const options: FormatOption[] = [
    {
      label: "Best available",
      description: "Highest quality video + audio",
      args: ["-f", "bestvideo+bestaudio/best"],
    },
  ]

  const maxHeight = heights.size > 0 ? Math.max(...heights) : 0
  for (const tier of TIERS) {
    if (tier > maxHeight) continue
    const size = bestSizeForHeight(info.formats, tier)
    options.push({
      label: `${tier}p MP4`,
      description: size ? `~${size}` : "Video + audio, MP4",
      args: [
        "-f",
        `bestvideo[height<=${tier}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${tier}]`,
      ],
    })
  }

  options.push({
    label: "Audio only (M4A)",
    description: "Extract best audio track",
    args: ["-f", "bestaudio[ext=m4a]/bestaudio", "-x", "--audio-format", "m4a"],
  })

  return options
}

/**
 * Format tiers for playlist downloads, where per-video format lists aren't
 * fetched (flat playlist entries carry no `formats`). Same args as
 * curateFormats, no size estimates and no filtering by a known max height.
 */
export function defaultFormatOptions(): FormatOption[] {
  const options: FormatOption[] = [
    {
      label: "Best available",
      description: "Highest quality video + audio",
      args: ["-f", "bestvideo+bestaudio/best"],
    },
  ]

  for (const tier of TIERS) {
    options.push({
      label: `${tier}p MP4`,
      description: "Video + audio, MP4",
      args: [
        "-f",
        `bestvideo[height<=${tier}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${tier}]`,
      ],
    })
  }

  options.push({
    label: "Audio only (M4A)",
    description: "Extract best audio track",
    args: ["-f", "bestaudio[ext=m4a]/bestaudio", "-x", "--audio-format", "m4a"],
  })

  return options
}
