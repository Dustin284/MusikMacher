/**
 * LRC (Lyric) file parser and formatter.
 * Handles the standard LRC format: [mm:ss.xx]text
 */

export interface LrcLine {
  time: number  // seconds
  text: string
}

/**
 * Parse an LRC string into an array of timed lines.
 * Supports formats: [mm:ss.xx], [mm:ss.xxx], [mm:ss]
 * Also handles multiple timestamps per line: [00:01.00][00:02.00]text
 */
export function parseLRC(text: string): LrcLine[] {
  const lines: LrcLine[] = []
  const rawLines = text.split('\n')

  // Pattern matches [mm:ss.xx] or [mm:ss.xxx] or [mm:ss]
  const timeRegex = /\[(\d{1,3}):(\d{2})(?:\.(\d{2,3}))?\]/g

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim()
    if (!trimmed) continue

    // Skip metadata tags like [ar:Artist], [ti:Title], etc.
    if (/^\[[a-z]{2}:/.test(trimmed)) continue

    // Extract all timestamps from the line
    const timestamps: number[] = []
    let match: RegExpExecArray | null
    let lastIndex = 0

    timeRegex.lastIndex = 0
    while ((match = timeRegex.exec(trimmed)) !== null) {
      const minutes = parseInt(match[1], 10)
      const seconds = parseInt(match[2], 10)
      let centiseconds = 0
      if (match[3]) {
        // Normalize to centiseconds (2 digits)
        const frac = match[3]
        centiseconds = frac.length === 3
          ? Math.round(parseInt(frac, 10) / 10)
          : parseInt(frac, 10)
      }
      const time = minutes * 60 + seconds + centiseconds / 100
      timestamps.push(time)
      lastIndex = timeRegex.lastIndex
    }

    if (timestamps.length === 0) continue

    // The text portion is everything after the last timestamp
    const lyricText = trimmed.substring(lastIndex).trim()

    // Create a line entry for each timestamp (handles multi-timestamp lines)
    for (const time of timestamps) {
      lines.push({ time, text: lyricText })
    }
  }

  // Sort by time
  lines.sort((a, b) => a.time - b.time)

  return lines
}

/**
 * Format an array of timed lines back into an LRC string.
 * Output format: [mm:ss.xx]text
 */
export function formatLRC(lines: LrcLine[]): string {
  const sorted = [...lines].sort((a, b) => a.time - b.time)

  return sorted
    .map((line) => {
      const totalSeconds = Math.max(0, line.time)
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = Math.floor(totalSeconds % 60)
      const centiseconds = Math.round((totalSeconds % 1) * 100)

      const mm = minutes.toString().padStart(2, '0')
      const ss = seconds.toString().padStart(2, '0')
      const xx = centiseconds.toString().padStart(2, '0')

      return `[${mm}:${ss}.${xx}]${line.text}`
    })
    .join('\n')
}
