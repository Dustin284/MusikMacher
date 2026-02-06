import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from '../i18n/useTranslation'
import { usePlayerStore } from '../store/usePlayerStore'
import { useTrackStore } from '../store/useTrackStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { parseLRC, formatLRC, type LrcLine } from '../utils/lrcParser'
import { updateTrack } from '../db/database'
import { log } from '../utils/logger'
import type { Track } from '../types'

interface LyricsPanelProps {
  track?: import('../types').Track
}

export default function LyricsPanel({ track: trackProp }: LyricsPanelProps = {}) {
  const { t } = useTranslation()
  const position = usePlayerStore(s => s.position)
  const currentTrack = usePlayerStore(s => s.currentTrack)

  // Use the prop if provided, otherwise fall back to the current playing track
  const track = trackProp ?? currentTrack

  const [lyrics, setLyrics] = useState('')
  const [lrcLines, setLrcLines] = useState<LrcLine[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [isSyncMode, setIsSyncMode] = useState(false)
  const [syncLineIndex, setSyncLineIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const lyricsContainerRef = useRef<HTMLDivElement>(null)
  const activeLineRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Persist lyrics to DB + sync both stores so data survives panel remount
  const persistLyrics = async (trackId: number, changes: Partial<Pick<Track, 'lyrics' | 'lrcLyrics'>>) => {
    await updateTrack(trackId, changes)
    const ps = usePlayerStore.getState()
    if (ps.currentTrack?.id === trackId) {
      usePlayerStore.setState({ currentTrack: { ...ps.currentTrack, ...changes } })
    }
    useTrackStore.setState(s => ({
      tracks: s.tracks.map(t => t.id === trackId ? { ...t, ...changes } : t)
    }))
  }

  // Load LRC data from track
  useEffect(() => {
    if (!track) return
    setLyrics(track.lyrics || '')
    setNotFound(false)
    if (track.lrcLyrics) {
      setLrcLines(parseLRC(track.lrcLyrics))
    } else {
      setLrcLines([])
    }
  }, [track?.id, track?.lyrics, track?.lrcLyrics])

  // Find the current LRC line based on playback position
  const currentLineIndex = lrcLines.length > 0
    ? lrcLines.reduce((bestIdx, line, idx) => {
        if (line.time <= position) return idx
        return bestIdx
      }, -1)
    : -1

  // Auto-scroll to current line in non-edit mode (contained within lyrics panel)
  useEffect(() => {
    if (isEditing || isSyncMode || !activeLineRef.current || !lyricsContainerRef.current) return

    const container = lyricsContainerRef.current
    const activeLine = activeLineRef.current

    // Calculate scroll position to center the active line
    const containerHeight = container.clientHeight
    const lineTop = activeLine.offsetTop
    const lineHeight = activeLine.offsetHeight
    const targetScroll = lineTop - (containerHeight / 2) + (lineHeight / 2)

    container.scrollTo({
      top: Math.max(0, targetScroll),
      behavior: 'smooth'
    })
  }, [currentLineIndex, isEditing, isSyncMode])

  const settings = useSettingsStore(s => s.settings)
  const updateSettings = useSettingsStore(s => s.update)
  const provider = settings.lyricsProvider || 'lyrics.ovh'

  // Parse "Artist - Title" from track name
  const parseTrackName = () => {
    if (!track?.name) return { artist: '', title: '' }
    const parts = track.name.replace(/\.\w+$/, '').split(' - ')
    if (parts.length >= 2) {
      return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() }
    }
    return { artist: '', title: parts[0].trim() }
  }

  // --- Provider: lyrics.ovh ---
  const searchLyricsOvh = async (artist: string, title: string): Promise<{ lyrics?: string; lrc?: string }> => {
    const response = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
    )
    if (!response.ok) return {}
    const data = await response.json()
    return data.lyrics ? { lyrics: data.lyrics.trim() } : {}
  }

  // --- Provider: Genius (via Electron main process) ---
  const searchGenius = async (artist: string, title: string): Promise<{ lyrics?: string; lrc?: string }> => {
    if (!window.electronAPI?.fetchGeniusLyrics) return {}
    const query = artist ? `${artist} ${title}` : title
    const result = await window.electronAPI.fetchGeniusLyrics(query)
    if (result.lyrics) return { lyrics: result.lyrics }
    // Fallback: try title-only search if artist+title failed
    if (artist) {
      const fallback = await window.electronAPI.fetchGeniusLyrics(title)
      if (fallback.lyrics) return { lyrics: fallback.lyrics }
    }
    return {}
  }

  // --- Provider: LRCLIB (with synced lyrics) ---
  const searchLrclib = async (artist: string, title: string): Promise<{ lyrics?: string; lrc?: string }> => {
    const params = new URLSearchParams()
    if (artist) params.set('artist_name', artist)
    params.set('track_name', title)
    if (track?.length) params.set('duration', String(Math.round(track.length)))
    const response = await fetch(`https://lrclib.net/api/get?${params}`)
    if (!response.ok) {
      // Try search endpoint as fallback
      const searchRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(artist ? `${artist} ${title}` : title)}`)
      if (!searchRes.ok) return {}
      const results = await searchRes.json()
      if (!results?.[0]) return {}
      return {
        lyrics: results[0].plainLyrics || undefined,
        lrc: results[0].syncedLyrics || undefined,
      }
    }
    const data = await response.json()
    return {
      lyrics: data.plainLyrics || undefined,
      lrc: data.syncedLyrics || undefined,
    }
  }

  // Fetch lyrics from a direct Genius URL
  const fetchGeniusUrl = async (url: string): Promise<{ lyrics?: string }> => {
    if (!window.electronAPI?.fetchGeniusLyricsUrl) return {}
    const result = await window.electronAPI.fetchGeniusLyricsUrl(url)
    return result.lyrics ? { lyrics: result.lyrics } : {}
  }

  // Search lyrics using selected provider
  const handleSearch = async () => {
    if (!track?.name) return
    const { artist, title } = parseTrackName()

    if (!title) {
      setNotFound(true)
      return
    }

    // lyrics.ovh requires both artist and title
    if (provider === 'lyrics.ovh' && !artist) {
      setNotFound(true)
      return
    }

    setIsLoading(true)
    setNotFound(false)

    try {
      log('info', 'Searching lyrics', { provider, artist, title })

      let result: { lyrics?: string; lrc?: string } = {}
      switch (provider) {
        case 'genius': result = await searchGenius(artist, title); break
        case 'lrclib': result = await searchLrclib(artist, title); break
        default: result = await searchLyricsOvh(artist, title); break
      }

      if (result.lyrics) {
        setLyrics(result.lyrics)
        setNotFound(false)

        const changes: Partial<Pick<Track, 'lyrics' | 'lrcLyrics'>> = { lyrics: result.lyrics }

        // LRCLIB can return synced lyrics
        if (result.lrc) {
          const parsed = parseLRC(result.lrc)
          setLrcLines(parsed)
          changes.lrcLyrics = result.lrc
        }

        if (track.id != null) {
          await persistLyrics(track.id, changes)
        }
        log('info', 'Lyrics found and saved', { provider, artist, title })
      } else {
        setNotFound(true)
      }
    } catch (err) {
      log('error', 'Lyrics search failed', { error: String(err) })
      setNotFound(true)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch from a pasted Genius URL
  const [geniusUrl, setGeniusUrl] = useState('')
  const handleFetchUrl = async () => {
    const url = geniusUrl.trim()
    if (!url || !track) return
    setIsLoading(true)
    setNotFound(false)
    try {
      // Handle numeric IDs: genius.com/38458926
      const fetchUrl = /^\d+$/.test(url) ? `https://genius.com/${url}` : url
      const result = await fetchGeniusUrl(fetchUrl)
      if (result.lyrics) {
        setLyrics(result.lyrics)
        setGeniusUrl('')
        if (track.id != null) {
          await persistLyrics(track.id, { lyrics: result.lyrics })
        }
      } else {
        setNotFound(true)
      }
    } catch {
      setNotFound(true)
    } finally {
      setIsLoading(false)
    }
  }

  // Enter edit mode
  const handleStartEdit = () => {
    setEditText(lyrics)
    setIsEditing(true)
  }

  // Save edited lyrics
  const handleSaveEdit = async () => {
    setLyrics(editText)
    setIsEditing(false)
    if (track?.id != null) {
      await persistLyrics(track.id, { lyrics: editText })
    }
  }

  // Sync mode: press Enter to set timestamp for current line
  const handleSyncKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isSyncMode || !track) return
      if (e.key === 'Enter') {
        e.preventDefault()

        const plainLines = lyrics.split('\n').filter((l) => l.trim())
        if (syncLineIndex >= plainLines.length) {
          // Finished syncing
          setIsSyncMode(false)
          return
        }

        const currentTime = usePlayerStore.getState().position
        const updatedLines = [...lrcLines]

        // Find or create the line entry
        if (syncLineIndex < updatedLines.length) {
          updatedLines[syncLineIndex] = {
            time: currentTime,
            text: updatedLines[syncLineIndex].text,
          }
        } else {
          updatedLines.push({
            time: currentTime,
            text: plainLines[syncLineIndex] || '',
          })
        }

        setLrcLines(updatedLines)
        setSyncLineIndex(syncLineIndex + 1)

        // Save LRC to track
        if (track.id != null) {
          const lrcText = formatLRC(updatedLines)
          persistLyrics(track.id, { lrcLyrics: lrcText })
        }
      } else if (e.key === 'Escape') {
        setIsSyncMode(false)
      }
    },
    [isSyncMode, syncLineIndex, lrcLines, lyrics, track],
  )

  useEffect(() => {
    if (isSyncMode) {
      window.addEventListener('keydown', handleSyncKeyDown)
      return () => window.removeEventListener('keydown', handleSyncKeyDown)
    }
  }, [isSyncMode, handleSyncKeyDown])

  // Start sync mode
  const handleStartSync = () => {
    if (!lyrics.trim()) return

    // Initialize LRC lines from plain lyrics
    const plainLines = lyrics.split('\n').filter((l) => l.trim())
    const initialLines: LrcLine[] = plainLines.map((text, i) => ({
      time: lrcLines[i]?.time ?? 0,
      text: text.trim(),
    }))

    setLrcLines(initialLines)
    setSyncLineIndex(0)
    setIsSyncMode(true)
  }

  // Import LRC file
  const handleImportLRC = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = ev.target?.result as string
      if (!text) return

      const parsed = parseLRC(text)
      setLrcLines(parsed)

      // Also set plain lyrics from LRC text
      const plainText = parsed.map((l) => l.text).join('\n')
      setLyrics(plainText)

      // Save both
      if (track?.id != null) {
        await persistLyrics(track.id, {
          lyrics: plainText,
          lrcLyrics: formatLRC(parsed),
        })
      }

      log('info', 'LRC file imported', { lines: parsed.length })
    }
    reader.readAsText(file)

    // Reset input
    e.target.value = ''
  }

  // Export LRC file
  const handleExportLRC = () => {
    if (lrcLines.length === 0 || !track) return

    const lrcText = formatLRC(lrcLines)
    const blob = new Blob([lrcText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${track.name.replace(/\.\w+$/, '')}.lrc`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!track) {
    return null
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 p-2 border-b border-surface-200/60 dark:border-surface-700/60 shrink-0 flex-wrap">
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 transition-colors disabled:opacity-40"
        >
          {isLoading ? '...' : t('lyrics.search')}
        </button>

        <select
          value={provider}
          onChange={(e) => updateSettings({ lyricsProvider: e.target.value as 'lyrics.ovh' | 'genius' | 'lrclib' })}
          className="text-[11px] py-1 px-1.5 rounded-md border border-surface-200 dark:border-surface-700 bg-white/80 dark:bg-surface-800/80 text-surface-600 dark:text-surface-400 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
        >
          <option value="lyrics.ovh">lyrics.ovh</option>
          <option value="genius">Genius</option>
          <option value="lrclib">LRCLIB</option>
        </select>

        {!isEditing ? (
          <button
            onClick={handleStartEdit}
            className="px-2.5 py-1 text-[11px] font-medium rounded-md hover:bg-surface-200/60 dark:hover:bg-surface-700/60 text-surface-600 dark:text-surface-400 transition-colors"
          >
            {t('lyrics.edit')}
          </button>
        ) : (
          <button
            onClick={handleSaveEdit}
            className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-colors"
          >
            {t('lyrics.save')}
          </button>
        )}

        <button
          onClick={() => (isSyncMode ? setIsSyncMode(false) : handleStartSync())}
          disabled={!lyrics.trim()}
          className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors disabled:opacity-40 ${
            isSyncMode
              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
              : 'hover:bg-surface-200/60 dark:hover:bg-surface-700/60 text-surface-600 dark:text-surface-400'
          }`}
        >
          {t('lyrics.syncMode')}
        </button>

        {/* Genius URL input */}
        {provider === 'genius' && window.electronAPI?.fetchGeniusLyricsUrl && (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={geniusUrl}
              onChange={(e) => setGeniusUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFetchUrl()}
              placeholder="Genius URL / ID..."
              className="w-32 px-2 py-0.5 text-[11px] rounded-md border border-surface-200 dark:border-surface-700 bg-white/80 dark:bg-surface-800/80 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
            />
            <button
              onClick={handleFetchUrl}
              disabled={isLoading || !geniusUrl.trim()}
              className="px-2 py-1 text-[11px] font-medium rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-40"
            >
              Fetch
            </button>
          </div>
        )}

        <div className="flex-1" />

        {/* LRC import/export */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".lrc,.txt"
          className="hidden"
          onChange={handleImportLRC}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-2.5 py-1 text-[11px] font-medium rounded-md hover:bg-surface-200/60 dark:hover:bg-surface-700/60 text-surface-600 dark:text-surface-400 transition-colors"
        >
          {t('lyrics.importLRC')}
        </button>
        <button
          onClick={handleExportLRC}
          disabled={lrcLines.length === 0}
          className="px-2.5 py-1 text-[11px] font-medium rounded-md hover:bg-surface-200/60 dark:hover:bg-surface-700/60 text-surface-600 dark:text-surface-400 transition-colors disabled:opacity-40"
        >
          {t('lyrics.exportLRC')}
        </button>
      </div>

      {/* Lyrics display area */}
      <div
        ref={lyricsContainerRef}
        className="flex-1 overflow-y-auto p-3"
      >
        {isEditing ? (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full h-full min-h-[200px] p-2 text-[13px] leading-relaxed rounded-lg border border-surface-200 dark:border-surface-700 bg-white/80 dark:bg-surface-800/80 focus:outline-none focus:ring-2 focus:ring-primary-500/30 resize-none font-mono"
          />
        ) : isSyncMode ? (
          <div className="space-y-1">
            {lyrics
              .split('\n')
              .filter((l) => l.trim())
              .map((line, idx) => (
                <div
                  key={idx}
                  className={`px-2 py-1 rounded text-[13px] transition-colors ${
                    idx === syncLineIndex
                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold'
                      : idx < syncLineIndex
                      ? 'text-surface-400 dark:text-surface-600'
                      : 'text-surface-700 dark:text-surface-300'
                  }`}
                >
                  {idx < syncLineIndex && lrcLines[idx] && (
                    <span className="text-[11px] text-surface-400 mr-2 font-mono">
                      [{formatTimestamp(lrcLines[idx].time)}]
                    </span>
                  )}
                  {line}
                </div>
              ))}
            <p className="text-[11px] text-surface-500 mt-3 italic">
              Press Enter to set timestamp for highlighted line. Escape to exit.
            </p>
          </div>
        ) : lrcLines.length > 0 ? (
          <div className="space-y-0.5">
            {lrcLines.map((line, idx) => {
              const isActive = idx === currentLineIndex
              return (
                <div
                  key={idx}
                  ref={isActive ? activeLineRef : undefined}
                  className={`px-2 py-1 rounded text-[13px] transition-all duration-200 ${
                    isActive
                      ? 'bg-primary-500/15 text-primary-600 dark:text-primary-400 font-semibold scale-[1.01]'
                      : idx < currentLineIndex
                      ? 'text-surface-400 dark:text-surface-600'
                      : 'text-surface-700 dark:text-surface-300'
                  }`}
                >
                  <span className="text-[10px] text-surface-400 mr-2 font-mono">
                    [{formatTimestamp(line.time)}]
                  </span>
                  {line.text}
                </div>
              )
            })}
          </div>
        ) : lyrics ? (
          <div className="text-[13px] text-surface-700 dark:text-surface-300 whitespace-pre-wrap leading-relaxed">
            {lyrics}
          </div>
        ) : notFound ? (
          <div className="flex items-center justify-center h-full text-surface-400 dark:text-surface-600 text-[13px]">
            {t('lyrics.notFound')}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-surface-400 dark:text-surface-600 text-[13px]">
            {t('lyrics.search')}
          </div>
        )}
      </div>
    </div>
  )
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const cs = Math.round((seconds % 1) * 100)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`
}
