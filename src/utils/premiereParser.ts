import type { Clip } from '../types'

// Premiere .prproj files are gzip-compressed XML.
// In the browser we use DecompressionStream to decompress and DOMParser for XML.

export async function parsePremiereFile(file: File): Promise<{ clips: Clip[]; log: string }> {
  let log = ''
  const clips: Clip[] = []

  try {
    log += `Loading: ${file.name}\n`

    const arrayBuffer = await file.arrayBuffer()
    let xmlString: string

    // Try to decompress (prproj is gzip)
    try {
      const ds = new DecompressionStream('gzip')
      const writer = ds.writable.getWriter()
      writer.write(new Uint8Array(arrayBuffer))
      writer.close()

      const reader = ds.readable.getReader()
      const chunks: Uint8Array[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
      const merged = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        merged.set(chunk, offset)
        offset += chunk.length
      }

      xmlString = new TextDecoder().decode(merged)
    } catch {
      // Maybe it's already plain XML
      xmlString = new TextDecoder().decode(arrayBuffer)
    }

    log += `Decompressed. Parsing XML...\n`

    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlString, 'application/xml')

    // Find all sequences
    const sequences = doc.querySelectorAll('Sequence')
    log += `Found ${sequences.length} sequence(s)\n`

    let clipId = 0
    sequences.forEach((seq) => {
      const seqName = seq.querySelector('Name')?.textContent || 'Unnamed'
      log += `\nSequence: ${seqName}\n`

      // Find audio tracks
      const trackGroups = seq.querySelectorAll('TrackGroup')
      trackGroups.forEach((tg) => {
        const tracks = tg.querySelectorAll('Track')
        tracks.forEach((track, trackIndex) => {
          const clipItems = track.querySelectorAll('ClipItem, SubClip')
          clipItems.forEach((item) => {
            const name = item.querySelector('Name')?.textContent ||
                         item.querySelector('MasterClip Name')?.textContent || 'Unknown'

            // Try to extract timing
            const startStr = item.querySelector('Start')?.textContent
            const endStr = item.querySelector('End')?.textContent
            const inPointStr = item.querySelector('InPoint')?.textContent
            const outPointStr = item.querySelector('OutPoint')?.textContent

            const start = parseFloat(startStr || '0')
            const end = parseFloat(endStr || '0')
            const inPoint = parseFloat(inPointStr || '0')
            const outPoint = parseFloat(outPointStr || '0')

            // Premiere stores time in ticks (254016000000 per second for audio)
            const TICKS_PER_SEC = 254016000000
            const inTime = (start > 1000000 ? start / TICKS_PER_SEC : inPoint > 1000000 ? inPoint / TICKS_PER_SEC : inPoint)
            const outTime = (end > 1000000 ? end / TICKS_PER_SEC : outPoint > 1000000 ? outPoint / TICKS_PER_SEC : outPoint)

            const clip: Clip = {
              id: `clip-${clipId++}`,
              name,
              filename: name,
              inTime,
              outTime,
              time: outTime - inTime,
              trackIndex: trackIndex + 1,
              include: trackIndex === 0,
            }

            // Skip very short clips
            if (clip.time > 0.1) {
              clips.push(clip)
            }
          })
        })
      })
    })

    // Merge adjacent clips with same name
    const merged = mergeAdjacentClips(clips)
    log += `\nTotal clips: ${merged.length}\n`

    return { clips: merged, log }
  } catch (err) {
    log += `Error: ${err}\n`
    return { clips: [], log }
  }
}

function mergeAdjacentClips(clips: Clip[]): Clip[] {
  if (clips.length <= 1) return clips

  const result: Clip[] = [clips[0]]

  for (let i = 1; i < clips.length; i++) {
    const prev = result[result.length - 1]
    const curr = clips[i]

    if (prev.name === curr.name && Math.abs(prev.outTime - curr.inTime) < 0.5) {
      prev.outTime = curr.outTime
      prev.time = prev.outTime - prev.inTime
    } else {
      result.push(curr)
    }
  }

  return result
}

export function generateYoutubeTimestamps(clips: Clip[]): string {
  return clips
    .filter(c => c.include)
    .map(c => {
      const inTime = formatTimestamp(c.inTime)
      const outTime = formatTimestamp(c.outTime)
      return `[${inTime} - ${outTime}] ${c.name}`
    })
    .join('\n')
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}
