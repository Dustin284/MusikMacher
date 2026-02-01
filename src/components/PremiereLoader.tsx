import { useState, useRef, useEffect } from 'react'
import type { Clip, PremiereUsage } from '../types'
import { parsePremiereFile, generateYoutubeTimestamps } from '../utils/premiereParser'
import { formatTime } from '../utils/formatTime'
import { useTranslation } from '../i18n/useTranslation'
import { getAllTracks, updateTrack } from '../db/database'
import { log } from '../utils/logger'

export default function PremiereLoader() {
  const [clips, setClips] = useState<Clip[]>([])
  const [log_, setLog] = useState('')
  const [loading, setLoading] = useState(false)
  const [filterTrack1, setFilterTrack1] = useState(false)
  const [filterLibrary, setFilterLibrary] = useState(false)
  const [timestamps, setTimestamps] = useState('')
  const [projectName, setProjectName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logRef = useRef<HTMLTextAreaElement>(null)
  const { t } = useTranslation()

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [log_])

  // Build a set of library track names for O(1) lookup
  const [libraryTrackNames, setLibraryTrackNames] = useState<Set<string>>(new Set())
  useEffect(() => {
    getAllTracks().then(tracks => {
      const names = new Set<string>()
      for (const track of tracks) {
        // Store both with and without extension for matching
        names.add(track.name.toLowerCase())
        const nameWithoutExt = track.name.replace(/\.\w+$/, '').toLowerCase()
        names.add(nameWithoutExt)
      }
      setLibraryTrackNames(names)
    })
  }, [])

  const handleLoadFile = async (file: File | null) => {
    if (!file) return

    setLoading(true)
    setLog('')
    setTimestamps('')

    const name = file.name.replace(/\.prproj$/, '')
    setProjectName(name)

    try {
      const result = await parsePremiereFile(file)
      setClips(result.clips)
      setLog(result.log)

      // Record Premiere usage on matching library tracks
      await recordPremiereUsage(name, result.clips)

      log('info', 'Premiere project loaded', { name, clips: result.clips.length })
    } catch (err) {
      setLog(`Error: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const recordPremiereUsage = async (projName: string, loadedClips: Clip[]) => {
    const allTracks = await getAllTracks()
    const trackNameMap = new Map<string, number>()
    for (const track of allTracks) {
      const nameLC = track.name.replace(/\.\w+$/, '').toLowerCase()
      if (track.id != null) trackNameMap.set(nameLC, track.id)
    }

    for (const clip of loadedClips) {
      const clipNameLC = clip.name.replace(/\.\w+$/, '').toLowerCase()
      const trackId = trackNameMap.get(clipNameLC)
      if (trackId == null) continue

      const track = allTracks.find(t => t.id === trackId)
      if (!track) continue

      const usage: PremiereUsage = {
        projectName: projName,
        clipName: clip.name,
        inTime: clip.inTime,
        outTime: clip.outTime,
        loadedAt: new Date().toISOString(),
      }

      const existing = track.premiereUsage || []
      // Avoid duplicates for same project+clip
      const alreadyExists = existing.some(
        u => u.projectName === projName && u.clipName === clip.name
      )
      if (!alreadyExists) {
        await updateTrack(trackId, {
          premiereUsage: [...existing, usage],
        })
      }
    }
  }

  const toggleClipInclude = (id: string) => {
    setClips(prev => prev.map(c =>
      c.id === id ? { ...c, include: !c.include } : c
    ))
  }

  const handleGenerate = () => {
    const result = generateYoutubeTimestamps(clips)
    setTimestamps(result)
    navigator.clipboard.writeText(result).catch(() => {})
  }

  // EDL Export (CMX3600 format)
  const handleExportEDL = () => {
    const included = filteredClips.filter(c => c.include)
    if (included.length === 0) return

    const fps = 25
    const toTC = (seconds: number) => {
      const h = Math.floor(seconds / 3600)
      const m = Math.floor((seconds % 3600) / 60)
      const s = Math.floor(seconds % 60)
      const f = Math.floor((seconds % 1) * fps)
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`
    }

    let edl = `TITLE: ${projectName || 'Untitled'}\nFCM: NON-DROP FRAME\n\n`
    included.forEach((clip, i) => {
      const num = String(i + 1).padStart(3, '0')
      const srcIn = toTC(clip.inTime)
      const srcOut = toTC(clip.outTime)
      const recIn = toTC(clip.inTime)
      const recOut = toTC(clip.outTime)
      edl += `${num}  AX       AA/V  C        ${srcIn} ${srcOut} ${recIn} ${recOut}\n`
      edl += `* FROM CLIP NAME: ${clip.name}\n\n`
    })

    const blob = new Blob([edl], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName || 'export'}.edl`
    a.click()
    URL.revokeObjectURL(url)
  }

  let filteredClips = filterTrack1
    ? clips.filter(c => c.trackIndex === 1 || c.include)
    : clips

  if (filterLibrary) {
    filteredClips = filteredClips.filter(c => {
      const nameLC = c.name.replace(/\.\w+$/, '').toLowerCase()
      return libraryTrackNames.has(nameLC) || libraryTrackNames.has(c.name.toLowerCase())
    })
  }

  return (
    <div className="p-6 flex flex-col gap-4 h-full">
      {/* File picker */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 transition-colors"
        >
          {t('premiere.loadProject')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".prproj"
          className="hidden"
          onChange={(e) => handleLoadFile(e.target.files?.[0] ?? null)}
        />
        {loading && <span className="text-sm text-zinc-500 animate-pulse">{t('premiere.loading')}</span>}
        {projectName && !loading && (
          <span className="text-[12px] text-surface-500">{projectName}</span>
        )}
      </div>

      {/* Log */}
      <textarea
        ref={logRef}
        readOnly
        value={log_}
        className="h-40 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-3 text-xs font-mono text-zinc-600 dark:text-zinc-400 resize-none"
      />

      {/* Filters */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={filterTrack1}
            onChange={(e) => setFilterTrack1(e.target.checked)}
            className="rounded text-primary-500 focus:ring-primary-500"
          />
          {t('premiere.filterTrack1')}
        </label>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={filterLibrary}
            onChange={(e) => setFilterLibrary(e.target.checked)}
            className="rounded text-primary-500 focus:ring-primary-500"
          />
          {t('premiere.filterLibrary')}
        </label>
      </div>

      {/* Clips table */}
      <div className="flex-1 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
            <tr>
              <th className="w-16 px-3 py-2 text-left">{t('premiere.include')}</th>
              <th className="px-3 py-2 text-left">{t('premiere.name')}</th>
              <th className="w-24 px-3 py-2 text-right">{t('premiere.in')}</th>
              <th className="w-24 px-3 py-2 text-right">{t('premiere.out')}</th>
              <th className="w-20 px-3 py-2 text-right">{t('premiere.duration')}</th>
              <th className="w-16 px-3 py-2 text-right">{t('premiere.track')}</th>
              <th className="w-20 px-3 py-2 text-center">{t('premiere.usedIn')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredClips.map((clip) => {
              const clipNameLC = clip.name.replace(/\.\w+$/, '').toLowerCase()
              const isInLibrary = libraryTrackNames.has(clipNameLC) || libraryTrackNames.has(clip.name.toLowerCase())
              return (
                <tr
                  key={clip.id}
                  className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <td className="px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={clip.include}
                      onChange={() => toggleClipInclude(clip.id)}
                      className="rounded text-primary-500"
                    />
                  </td>
                  <td className="px-3 py-1.5 truncate max-w-[300px]">{clip.name}</td>
                  <td className="px-3 py-1.5 text-right text-zinc-500 tabular-nums">{formatTime(clip.inTime)}</td>
                  <td className="px-3 py-1.5 text-right text-zinc-500 tabular-nums">{formatTime(clip.outTime)}</td>
                  <td className="px-3 py-1.5 text-right text-zinc-500 tabular-nums">{clip.time.toFixed(2)}s</td>
                  <td className="px-3 py-1.5 text-right text-zinc-500">{clip.trackIndex}</td>
                  <td className="px-3 py-1.5 text-center">
                    {isInLibrary ? (
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="In Library" />
                    ) : (
                      <span className="inline-block w-2 h-2 rounded-full bg-surface-300 dark:bg-surface-600" />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Generate */}
      <div className="flex gap-3 items-start">
        <button
          onClick={handleGenerate}
          disabled={clips.length === 0}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 transition-colors shrink-0"
        >
          {t('premiere.generateTimestamps')}
        </button>
        <button
          onClick={handleExportEDL}
          disabled={clips.length === 0}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-primary-500 text-primary-500 hover:bg-primary-500/10 disabled:opacity-50 transition-colors shrink-0"
        >
          EDL Export
        </button>
        {timestamps && (
          <pre className="flex-1 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 text-xs font-mono text-zinc-600 dark:text-zinc-400 max-h-32 overflow-auto">
            {timestamps}
          </pre>
        )}
      </div>
    </div>
  )
}
