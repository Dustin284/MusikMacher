import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { usePlayerStore, type PlaybackMode } from '../store/usePlayerStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { useTrackStore } from '../store/useTrackStore'
import { useTranslation } from '../i18n/useTranslation'
import { formatTime } from '../utils/formatTime'
import Waveform from './Waveform'
import LyricsPanel from './LyricsPanel'
import QueuePanel from './QueuePanel'
import AudioVisualizer from './AudioVisualizer'

const PositionTime = memo(function PositionTime() {
  const position = usePlayerStore(s => s.position)
  return <span className="text-[11px] font-mono text-surface-500 w-11 text-right shrink-0 tabular-nums">{formatTime(position)}</span>
})

const SLIDER_HEIGHT = 120
const DB_MIN = -12
const DB_MAX = 12
const DB_RANGE = DB_MAX - DB_MIN

function EqBandSlider({ value, onChange, label, freq, enabled }: {
  value: number; onChange: (v: number) => void; label: string; freq: string; enabled: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const dbToY = (db: number) => ((DB_MAX - db) / DB_RANGE) * SLIDER_HEIGHT
  const yToDb = (y: number) => {
    const clamped = Math.max(0, Math.min(SLIDER_HEIGHT, y))
    const raw = DB_MAX - (clamped / SLIDER_HEIGHT) * DB_RANGE
    return Math.round(raw)
  }

  const handlePointer = useCallback((e: React.PointerEvent | PointerEvent) => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const y = e.clientY - rect.top
    onChange(yToDb(y))
  }, [onChange])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    handlePointer(e)
  }, [handlePointer])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragging.current) handlePointer(e)
  }, [handlePointer])

  const onPointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  const thumbY = dbToY(value)
  const centerY = dbToY(0)
  const fillTop = value >= 0 ? thumbY : centerY
  const fillHeight = Math.abs(thumbY - centerY)
  const isActive = value !== 0

  return (
    <div className="flex flex-col items-center gap-1.5 w-12">
      {/* dB value */}
      <span className={`text-[10px] font-mono tabular-nums leading-none font-medium ${
        !enabled ? 'text-surface-400/50' :
        value > 0 ? 'text-cyan-500' : value < 0 ? 'text-amber-500' : 'text-surface-400'
      }`}>
        {value > 0 ? '+' : ''}{value}
      </span>

      {/* Custom vertical slider */}
      <div
        ref={trackRef}
        className="relative cursor-pointer select-none"
        style={{ width: 32, height: SLIDER_HEIGHT }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={() => onChange(0)}
      >
        {/* Track background */}
        <div className="absolute left-1/2 -translate-x-1/2 w-[3px] h-full rounded-full bg-surface-200 dark:bg-surface-700" />

        {/* Center line (0 dB) */}
        <div
          className="absolute left-1 right-1 h-[1px] bg-surface-300 dark:bg-surface-600"
          style={{ top: centerY }}
        />

        {/* Gain fill bar */}
        {isActive && enabled && (
          <div
            className={`absolute left-1/2 -translate-x-1/2 w-[5px] rounded-full transition-colors ${
              value > 0 ? 'bg-cyan-500/70' : 'bg-amber-500/70'
            }`}
            style={{ top: fillTop, height: Math.max(fillHeight, 1) }}
          />
        )}

        {/* Tick marks */}
        {[-12, -6, 0, 6, 12].map(db => (
          <div
            key={db}
            className={`absolute h-[1px] ${db === 0 ? 'left-1.5 right-1.5 bg-surface-300/60 dark:bg-surface-600/60' : 'left-2.5 right-2.5 bg-surface-200/60 dark:bg-surface-700/40'}`}
            style={{ top: dbToY(db) }}
          />
        ))}

        {/* Thumb */}
        <div
          className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 transition-all shadow-sm ${
            !enabled
              ? 'bg-surface-300 dark:bg-surface-600 border-surface-400/50'
              : isActive
              ? value > 0
                ? 'bg-cyan-500 border-cyan-400 shadow-cyan-500/30'
                : 'bg-amber-500 border-amber-400 shadow-amber-500/30'
              : 'bg-white dark:bg-surface-300 border-surface-300 dark:border-surface-500'
          }`}
          style={{ top: thumbY }}
        />
      </div>

      {/* Band label + freq */}
      <div className="flex flex-col items-center">
        <span className="text-[10px] font-medium text-surface-600 dark:text-surface-400 leading-tight">{label}</span>
        <span className="text-[8px] font-mono text-surface-400/70 leading-tight">{freq} Hz</span>
      </div>
    </div>
  )
}

export default function Player() {
  const currentTrack = usePlayerStore(s => s.currentTrack)
  const isPlaying = usePlayerStore(s => s.isPlaying)
  const duration = usePlayerStore(s => s.duration)
  const volume = usePlayerStore(s => s.volume)
  const waveformPeaks = usePlayerStore(s => s.waveformPeaks)
  const audio = usePlayerStore(s => s.audio)
  const showLyrics = usePlayerStore(s => s.showLyrics)
  const showQueue = usePlayerStore(s => s.showQueue)
  const playbackSpeed = usePlayerStore(s => s.playbackSpeed)
  const abLoop = usePlayerStore(s => s.abLoop)
  const abLoopSetting = usePlayerStore(s => s.abLoopSetting)
  const playPause = usePlayerStore(s => s.playPause)
  const seek = usePlayerStore(s => s.seek)
  const setVolume = usePlayerStore(s => s.setVolume)
  const skipForward = usePlayerStore(s => s.skipForward)
  const skipBackward = usePlayerStore(s => s.skipBackward)
  const toggleLyrics = usePlayerStore(s => s.toggleLyrics)
  const toggleQueue = usePlayerStore(s => s.toggleQueue)
  const toggleABLoop = usePlayerStore(s => s.toggleABLoop)
  const clearABLoop = usePlayerStore(s => s.clearABLoop)
  const speedUp = usePlayerStore(s => s.speedUp)
  const speedDown = usePlayerStore(s => s.speedDown)
  const speedReset = usePlayerStore(s => s.speedReset)
  const eqBass = usePlayerStore(s => s.eqBass)
  const eqMid = usePlayerStore(s => s.eqMid)
  const eqTreble = usePlayerStore(s => s.eqTreble)
  const eqEnabled = usePlayerStore(s => s.eqEnabled)
  const setEqBass = usePlayerStore(s => s.setEqBass)
  const setEqMid = usePlayerStore(s => s.setEqMid)
  const setEqTreble = usePlayerStore(s => s.setEqTreble)
  const toggleEq = usePlayerStore(s => s.toggleEq)
  const resetEq = usePlayerStore(s => s.resetEq)
  const pitchSemitones = usePlayerStore(s => s.pitchSemitones)
  const setPitchSemitones = usePlayerStore(s => s.setPitchSemitones)
  const resetPitch = usePlayerStore(s => s.resetPitch)
  const queue = usePlayerStore(s => s.queue)
  const setCuePoint = usePlayerStore(s => s.setCuePoint)
  const deleteCuePoint = usePlayerStore(s => s.deleteCuePoint)
  const settings = useSettingsStore(s => s.settings)
  const { t } = useTranslation()
  const addTrackNote = useTrackStore(s => s.addTrackNote)
  const deleteTrackNote = useTrackStore(s => s.deleteTrackNote)
  // FX state
  const reverbEnabled = usePlayerStore(s => s.reverbEnabled)
  const reverbMix = usePlayerStore(s => s.reverbMix)
  const reverbRoomSize = usePlayerStore(s => s.reverbRoomSize)
  const compressorEnabled = usePlayerStore(s => s.compressorEnabled)
  const compThreshold = usePlayerStore(s => s.compThreshold)
  const compRatio = usePlayerStore(s => s.compRatio)
  const compAttack = usePlayerStore(s => s.compAttack)
  const compRelease = usePlayerStore(s => s.compRelease)
  const compKnee = usePlayerStore(s => s.compKnee)
  const setReverbEnabled = usePlayerStore(s => s.setReverbEnabled)
  const setReverbMix = usePlayerStore(s => s.setReverbMix)
  const setReverbRoomSize = usePlayerStore(s => s.setReverbRoomSize)
  const setCompressorEnabled = usePlayerStore(s => s.setCompressorEnabled)
  const setCompThreshold = usePlayerStore(s => s.setCompThreshold)
  const setCompRatio = usePlayerStore(s => s.setCompRatio)
  const setCompAttack = usePlayerStore(s => s.setCompAttack)
  const setCompRelease = usePlayerStore(s => s.setCompRelease)
  const setCompKnee = usePlayerStore(s => s.setCompKnee)
  const resetFx = usePlayerStore(s => s.resetFx)
  const showVisualizer = usePlayerStore(s => s.showVisualizer)
  const toggleVisualizer = usePlayerStore(s => s.toggleVisualizer)
  const getAnalyserNode = usePlayerStore(s => s.getAnalyserNode)
  const playbackMode = usePlayerStore(s => s.playbackMode)
  const setPlaybackMode = usePlayerStore(s => s.setPlaybackMode)

  const [showEqPanel, setShowEqPanel] = useState(false)
  const [eqPanelPos, setEqPanelPos] = useState({ bottom: 0, left: 0 })
  const eqPanelRef = useRef<HTMLDivElement>(null)
  const eqButtonRef = useRef<HTMLButtonElement>(null)
  const [noteInput, setNoteInput] = useState<{ time: number; x: number } | null>(null)
  const [noteText, setNoteText] = useState('')
  const [showFxPanel, setShowFxPanel] = useState(false)
  const [fxPanelPos, setFxPanelPos] = useState({ bottom: 0, left: 0 })
  const fxPanelRef = useRef<HTMLDivElement>(null)
  const fxButtonRef = useRef<HTMLButtonElement>(null)

  // Compute EQ panel position from button ref
  const handleEqToggle = useCallback(() => {
    const newShow = !showEqPanel
    if (newShow && eqButtonRef.current) {
      const rect = eqButtonRef.current.getBoundingClientRect()
      setEqPanelPos({
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left + rect.width / 2,
      })
    }
    setShowEqPanel(newShow)
  }, [showEqPanel])

  // Update EQ panel position on resize
  useEffect(() => {
    if (!showEqPanel) return
    const update = () => {
      if (!eqButtonRef.current) return
      const rect = eqButtonRef.current.getBoundingClientRect()
      setEqPanelPos({
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left + rect.width / 2,
      })
    }
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [showEqPanel])

  // Close EQ panel when clicking outside
  useEffect(() => {
    if (!showEqPanel) return
    const handleClick = (e: MouseEvent) => {
      if (eqPanelRef.current && !eqPanelRef.current.contains(e.target as Node) &&
          eqButtonRef.current && !eqButtonRef.current.contains(e.target as Node)) {
        setShowEqPanel(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showEqPanel])

  const handleAddNote = useCallback((time: number) => {
    if (!currentTrack?.id) return
    // Calculate approximate x position from time
    setNoteInput({ time, x: 0 })
    setNoteText('')
  }, [currentTrack])

  const handleSaveNote = useCallback(() => {
    if (!currentTrack?.id || !noteInput || !noteText.trim()) {
      setNoteInput(null)
      return
    }
    addTrackNote(currentTrack.id, noteInput.time, noteText.trim())
    // Sync updated notes from track store into player store's currentTrack
    const updated = useTrackStore.getState().tracks.find(t => t.id === currentTrack.id)
    if (updated) {
      usePlayerStore.setState({ currentTrack: { ...currentTrack, notes: updated.notes } })
    }
    setNoteInput(null)
    setNoteText('')
  }, [currentTrack, noteInput, noteText, addTrackNote])

  const handleDeleteNote = useCallback((noteId: string) => {
    if (!currentTrack?.id) return
    deleteTrackNote(currentTrack.id, noteId)
    // Sync updated notes from track store into player store's currentTrack
    const updated = useTrackStore.getState().tracks.find(t => t.id === currentTrack.id)
    if (updated) {
      usePlayerStore.setState({ currentTrack: { ...currentTrack, notes: updated.notes } })
    }
  }, [currentTrack, deleteTrackNote])

  // FX panel position
  const handleFxToggle = useCallback(() => {
    const newShow = !showFxPanel
    if (newShow && fxButtonRef.current) {
      const rect = fxButtonRef.current.getBoundingClientRect()
      setFxPanelPos({
        bottom: window.innerHeight - rect.top + 8,
        left: rect.left + rect.width / 2,
      })
    }
    setShowFxPanel(newShow)
  }, [showFxPanel])

  // Close FX panel on outside click
  useEffect(() => {
    if (!showFxPanel) return
    const handleClick = (e: MouseEvent) => {
      if (fxPanelRef.current && !fxPanelRef.current.contains(e.target as Node) &&
          fxButtonRef.current && !fxButtonRef.current.contains(e.target as Node)) {
        setShowFxPanel(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showFxPanel])

  const eqHasChanges = eqBass !== 0 || eqMid !== 0 || eqTreble !== 0

  if (!currentTrack) {
    return (
      <div className="h-36 border-t border-surface-200/60 dark:border-surface-800/60 bg-white/40 dark:bg-surface-900/40 backdrop-blur-xl flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-surface-400 dark:text-surface-600">
          <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
          <span className="text-xs">{t('player.doubleClick')}</span>
        </div>
      </div>
    )
  }

  const cuePoints = currentTrack.cuePoints || []

  return (
    <>
      {showQueue && (
        <div className="h-48 border-t border-surface-200/60 dark:border-surface-700/60 bg-white/30 dark:bg-surface-900/30 backdrop-blur-xl overflow-hidden">
          <QueuePanel />
        </div>
      )}
      {showLyrics && (
        <div className="h-64 border-t border-surface-200/60 dark:border-surface-700/60 bg-white/30 dark:bg-surface-900/30 backdrop-blur-xl overflow-hidden">
          <LyricsPanel />
        </div>
      )}
      <div className="h-36 border-t border-surface-200/60 dark:border-surface-800/60 bg-white/50 dark:bg-surface-900/50 backdrop-blur-xl flex gap-4 p-3 relative">
        {/* Ambient color from artwork */}
        {currentTrack.artworkUrl && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <img src={currentTrack.artworkUrl} className="absolute inset-0 w-full h-full object-cover blur-[80px] opacity-10 dark:opacity-[0.07] scale-150" alt="" />
          </div>
        )}

        {/* Artwork */}
        <div className="w-[112px] h-[112px] shrink-0 rounded-xl overflow-hidden shadow-lg relative group">
          {currentTrack.artworkUrl ? (
            <img src={currentTrack.artworkUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-surface-200 to-surface-300 dark:from-surface-700 dark:to-surface-800 flex items-center justify-center">
              <svg className="w-10 h-10 text-surface-400 dark:text-surface-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          )}
          {isPlaying && (
            <div className="absolute inset-0 bg-primary-500/10 animate-pulse" />
          )}
        </div>

        {/* Main player area */}
        <div className="flex-1 flex flex-col min-w-0 gap-1.5 relative z-10">
          {/* Track name + playing indicator */}
          <div className="flex items-center gap-2">
            {isPlaying && (
              <div className="flex items-end gap-[2px] h-3.5 w-3.5 shrink-0">
                <div className="w-[3px] rounded-full bg-primary-500 eq-bar-1" />
                <div className="w-[3px] rounded-full bg-primary-500 eq-bar-2" />
                <div className="w-[3px] rounded-full bg-primary-500 eq-bar-3" />
              </div>
            )}
            <span className="text-sm font-semibold truncate">{currentTrack.name}</span>
            {currentTrack.bpm && (
              <span className="text-[10px] font-mono text-surface-400 shrink-0">{Math.round(currentTrack.bpm)} BPM</span>
            )}
            {currentTrack.musicalKey && (
              <span className="text-[10px] font-mono text-surface-400 shrink-0">{currentTrack.musicalKey}</span>
            )}
          </div>

          {/* Waveform + time */}
          <div className="flex items-center gap-2.5 flex-1">
            <PositionTime />
            <div className="flex-1 h-14 relative">
              <Waveform peaks={waveformPeaks} audio={audio} duration={duration} onSeek={seek} cuePoints={cuePoints} notes={currentTrack.notes} onAddNote={handleAddNote} onDeleteNote={handleDeleteNote} />
              {/* Visualizer overlay */}
              {showVisualizer && (
                <div className="absolute inset-0 pointer-events-none">
                  <AudioVisualizer analyserNode={getAnalyserNode()} isPlaying={isPlaying} />
                </div>
              )}
            </div>
            {noteInput && (
              <div className="absolute z-20 bottom-full mb-2 left-1/2 -translate-x-1/2">
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveNote()
                    if (e.key === 'Escape') setNoteInput(null)
                  }}
                  onBlur={handleSaveNote}
                  autoFocus
                  placeholder={t('notes.placeholder')}
                  className="px-2 py-1 text-[12px] rounded-lg border border-amber-500 bg-white dark:bg-surface-800 focus:outline-none shadow-lg w-48"
                />
              </div>
            )}
            <span className="text-[11px] font-mono text-surface-500 w-11 shrink-0 tabular-nums">{formatTime(duration)}</span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5">
            {/* Playback mode buttons */}
            {(['sequential', 'shuffle', 'smartDj'] as PlaybackMode[]).map((mode) => {
              const active = playbackMode === mode
              const titles = {
                sequential: t('playbackMode.sequential'),
                shuffle: t('playbackMode.shuffle'),
                smartDj: t('playbackMode.smartDj'),
              }
              const icons = {
                sequential: (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                ),
                shuffle: (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
                  </svg>
                ),
                smartDj: (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                ),
              }
              return (
                <button
                  key={mode}
                  onClick={() => setPlaybackMode(mode)}
                  title={titles[mode]}
                  className={`p-1 rounded-md transition-all duration-150 ${
                    active
                      ? 'text-primary-500 bg-primary-500/10'
                      : 'text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-200/60 dark:hover:bg-surface-800/60'
                  }`}
                >
                  {icons[mode]}
                </button>
              )
            })}

            <div className="w-px h-4 bg-surface-200/60 dark:bg-surface-700/60 mx-0.5" />

            {/* Skip backward */}
            <button
              onClick={() => skipBackward(settings.skipPositionMovement)}
              className="p-1.5 rounded-lg hover:bg-surface-200/60 dark:hover:bg-surface-800/60 transition-all duration-150 active:scale-95"
            >
              <svg className="w-4.5 h-4.5 text-surface-600 dark:text-surface-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>

            {/* Play/Pause */}
            <button
              onClick={playPause}
              className="p-2 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 hover:from-primary-500 hover:to-primary-700 text-white shadow-lg shadow-primary-500/25 transition-all duration-150 active:scale-95"
            >
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Skip forward */}
            <button
              onClick={() => skipForward(settings.skipPositionMovement)}
              className="p-1.5 rounded-lg hover:bg-surface-200/60 dark:hover:bg-surface-800/60 transition-all duration-150 active:scale-95"
            >
              <svg className="w-4.5 h-4.5 text-surface-600 dark:text-surface-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>

            {/* Cue point buttons */}
            <div className="flex items-center gap-0.5 ml-1">
              {Array.from({ length: 9 }, (_, i) => i + 1).map(slot => {
                const cue = cuePoints.find(c => c.id === slot)
                const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e']
                const slotColor = cue?.color || colors[(slot - 1) % colors.length]
                return (
                  <button
                    key={slot}
                    onClick={() => cue ? seek(cue.position) : setCuePoint(slot)}
                    onContextMenu={(e) => { e.preventDefault(); if (cue) deleteCuePoint(slot) }}
                    className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center transition-all cursor-pointer ${
                      cue
                        ? 'text-white hover:scale-110 active:scale-95'
                        : 'border border-dashed hover:border-solid hover:scale-105 active:scale-95'
                    }`}
                    style={cue
                      ? { backgroundColor: slotColor, boxShadow: `0 0 6px ${slotColor}60` }
                      : { borderColor: `${slotColor}40`, color: `${slotColor}50` }
                    }
                    title={cue ? `${cue.label} (${formatTime(cue.position)}) — Rechtsklick: loeschen` : `Cue ${slot} setzen (Klick oder Shift+${slot})`}
                  >
                    {slot}
                  </button>
                )
              })}
            </div>

            <div className="flex-1" />

            {/* Speed control */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={speedDown}
                className="p-1 rounded hover:bg-surface-200/60 dark:hover:bg-surface-800/60 transition-colors text-surface-400 text-[10px]"
              >
                -
              </button>
              <button
                onClick={speedReset}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium transition-all ${
                  playbackSpeed !== 1.0
                    ? 'bg-amber-500/20 text-amber-500'
                    : 'text-surface-500 hover:bg-surface-200/60 dark:hover:bg-surface-800/60'
                }`}
                title={t('player.speed')}
              >
                {playbackSpeed.toFixed(1)}x
              </button>
              <button
                onClick={speedUp}
                className="p-1 rounded hover:bg-surface-200/60 dark:hover:bg-surface-800/60 transition-colors text-surface-400 text-[10px]"
              >
                +
              </button>
            </div>

            {/* Visualizer toggle */}
            <button
              onClick={toggleVisualizer}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 ${
                showVisualizer
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'hover:bg-surface-200/60 dark:hover:bg-surface-800/60 text-surface-500'
              }`}
              title={t('player.visualizer')}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 8h2v8H6V8zm4-4h2v16h-2V4zm4 8h2v4h-2v-4zm4-2h2v6h-2v-6z" />
              </svg>
              VIS
            </button>

            {/* EQ control */}
            <div className="relative">
              <button
                ref={eqButtonRef}
                onClick={handleEqToggle}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 ${
                  showEqPanel
                    ? 'bg-cyan-500/25 text-cyan-500'
                    : eqHasChanges && eqEnabled
                    ? 'bg-cyan-500/20 text-cyan-500'
                    : !eqEnabled && eqHasChanges
                    ? 'bg-surface-500/20 text-surface-400'
                    : 'hover:bg-surface-200/60 dark:hover:bg-surface-800/60 text-surface-500'
                }`}
                title={t('player.eq')}
              >
                {/* Mini EQ bars icon */}
                <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="currentColor">
                  <rect x="1" y={7 - Math.max(0, eqBass) * 0.4 - 2} width="2.5" rx="0.75" height={4 + Math.abs(eqBass) * 0.4} opacity={eqEnabled ? 1 : 0.35} />
                  <rect x="5.5" y={7 - Math.max(0, eqMid) * 0.4 - 2} width="2.5" rx="0.75" height={4 + Math.abs(eqMid) * 0.4} opacity={eqEnabled ? 1 : 0.35} />
                  <rect x="10" y={7 - Math.max(0, eqTreble) * 0.4 - 2} width="2.5" rx="0.75" height={4 + Math.abs(eqTreble) * 0.4} opacity={eqEnabled ? 1 : 0.35} />
                </svg>
                {t('player.eq')}
              </button>

              {showEqPanel && createPortal(
                <div
                  ref={eqPanelRef}
                  className="fixed rounded-2xl shadow-2xl border border-surface-200/60 dark:border-surface-700/50 bg-white/90 dark:bg-surface-850/95 backdrop-blur-2xl overflow-hidden"
                  style={{ minWidth: 220, bottom: eqPanelPos.bottom, left: eqPanelPos.left, transform: 'translateX(-50%)', zIndex: 9999 }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 pt-3 pb-1">
                    <span className="text-[11px] font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">Equalizer</span>
                    <button
                      onClick={toggleEq}
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide transition-all ${
                        eqEnabled
                          ? 'bg-cyan-500 text-white shadow-sm shadow-cyan-500/30'
                          : 'bg-surface-200 dark:bg-surface-700 text-surface-400'
                      }`}
                    >
                      {eqEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  {/* Slider area */}
                  <div className="px-4 pt-1 pb-2">
                    {/* dB scale + sliders */}
                    <div className="flex gap-0">
                      {/* dB scale labels */}
                      <div className="flex flex-col justify-between h-[120px] pr-1.5 pt-[2px] pb-[2px]">
                        <span className="text-[8px] font-mono text-surface-400 leading-none">+12</span>
                        <span className="text-[8px] font-mono text-surface-400 leading-none">+6</span>
                        <span className="text-[8px] font-mono text-surface-300 dark:text-surface-600 leading-none">0</span>
                        <span className="text-[8px] font-mono text-surface-400 leading-none">-6</span>
                        <span className="text-[8px] font-mono text-surface-400 leading-none">-12</span>
                      </div>

                      {/* 3 Band sliders */}
                      <div className="flex flex-1 justify-around">
                        <EqBandSlider value={eqBass} onChange={setEqBass} label={t('player.eqBass')} freq="200" enabled={eqEnabled} />
                        <EqBandSlider value={eqMid} onChange={setEqMid} label={t('player.eqMid')} freq="1k" enabled={eqEnabled} />
                        <EqBandSlider value={eqTreble} onChange={setEqTreble} label={t('player.eqTreble')} freq="4k" enabled={eqEnabled} />
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-4 pb-3">
                    <button
                      onClick={resetEq}
                      className="w-full py-1 rounded-lg text-[10px] font-medium text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-100/60 dark:hover:bg-surface-700/40 transition-colors"
                    >
                      {t('player.eqReset')}
                    </button>
                  </div>
                </div>,
                document.body
              )}
            </div>

            {/* FX control */}
            <div className="relative">
              <button
                ref={fxButtonRef}
                onClick={handleFxToggle}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 ${
                  showFxPanel
                    ? 'bg-amber-500/25 text-amber-500'
                    : (reverbEnabled || compressorEnabled)
                    ? 'bg-amber-500/20 text-amber-500'
                    : 'hover:bg-surface-200/60 dark:hover:bg-surface-800/60 text-surface-500'
                }`}
                title={t('player.fx')}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                {t('player.fx')}
              </button>

              {showFxPanel && createPortal(
                <div
                  ref={fxPanelRef}
                  className="fixed rounded-2xl shadow-2xl border border-surface-200/60 dark:border-surface-700/50 bg-white/90 dark:bg-surface-850/95 backdrop-blur-2xl overflow-hidden"
                  style={{ minWidth: 280, maxHeight: 400, overflowY: 'auto', bottom: fxPanelPos.bottom, left: fxPanelPos.left, transform: 'translateX(-50%)', zIndex: 9999 }}
                >
                  {/* Reverb Section */}
                  <div className="px-4 pt-3 pb-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">{t('player.reverb')}</span>
                      <button
                        onClick={() => setReverbEnabled(!reverbEnabled)}
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide transition-all ${
                          reverbEnabled
                            ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                            : 'bg-surface-200 dark:bg-surface-700 text-surface-400'
                        }`}
                      >
                        {reverbEnabled ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-[10px] text-surface-500">{t('player.reverbMix')}</span>
                          <span className="text-[10px] font-mono text-amber-500">{Math.round(reverbMix * 100)}%</span>
                        </div>
                        <input type="range" min="0" max="1" step="0.01" value={reverbMix} onChange={(e) => setReverbMix(parseFloat(e.target.value))} className="w-full" />
                      </div>
                      <div>
                        <span className="text-[10px] text-surface-500 mb-1 block">{t('player.reverbRoom')}</span>
                        <div className="flex gap-1">
                          {(['small', 'medium', 'large'] as const).map(size => (
                            <button
                              key={size}
                              onClick={() => setReverbRoomSize(size)}
                              className={`flex-1 py-1 rounded-md text-[10px] font-medium transition-all ${
                                reverbRoomSize === size
                                  ? 'bg-amber-500/20 text-amber-500'
                                  : 'bg-surface-100 dark:bg-surface-700 text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-600'
                              }`}
                            >
                              {t(`player.room${size.charAt(0).toUpperCase() + size.slice(1)}` as any)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mx-4 border-t border-surface-200/60 dark:border-surface-700/40" />

                  {/* Compressor Section */}
                  <div className="px-4 pt-2 pb-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">{t('player.compressor')}</span>
                      <button
                        onClick={() => setCompressorEnabled(!compressorEnabled)}
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide transition-all ${
                          compressorEnabled
                            ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                            : 'bg-surface-200 dark:bg-surface-700 text-surface-400'
                        }`}
                      >
                        {compressorEnabled ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <FxSlider label={t('player.compThreshold')} value={compThreshold} min={-100} max={0} step={1} format={v => `${v} dB`} onChange={setCompThreshold} />
                      <FxSlider label={t('player.compRatio')} value={compRatio} min={1} max={20} step={0.5} format={v => `${v}:1`} onChange={setCompRatio} />
                      <FxSlider label={t('player.compAttack')} value={compAttack} min={0} max={1} step={0.001} format={v => `${(v * 1000).toFixed(0)}ms`} onChange={setCompAttack} />
                      <FxSlider label={t('player.compRelease')} value={compRelease} min={0} max={1} step={0.01} format={v => `${(v * 1000).toFixed(0)}ms`} onChange={setCompRelease} />
                      <FxSlider label={t('player.compKnee')} value={compKnee} min={0} max={40} step={1} format={v => `${v} dB`} onChange={setCompKnee} />
                    </div>
                  </div>

                  {/* Reset */}
                  <div className="px-4 pb-3 pt-1">
                    <button
                      onClick={resetFx}
                      className="w-full py-1 rounded-lg text-[10px] font-medium text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-100/60 dark:hover:bg-surface-700/40 transition-colors"
                    >
                      {t('player.fxReset')}
                    </button>
                  </div>
                </div>,
                document.body
              )}
            </div>

            {/* Pitch control */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setPitchSemitones(pitchSemitones - 1)}
                className="p-1 rounded hover:bg-surface-200/60 dark:hover:bg-surface-800/60 transition-colors text-surface-400 text-[10px]"
              >
                -
              </button>
              <button
                onClick={resetPitch}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium transition-all ${
                  pitchSemitones !== 0
                    ? 'bg-violet-500/20 text-violet-500'
                    : 'text-surface-500 hover:bg-surface-200/60 dark:hover:bg-surface-800/60'
                }`}
                title={t('player.pitch')}
              >
                {pitchSemitones > 0 ? '+' : ''}{pitchSemitones} st
              </button>
              <button
                onClick={() => setPitchSemitones(pitchSemitones + 1)}
                className="p-1 rounded hover:bg-surface-200/60 dark:hover:bg-surface-800/60 transition-colors text-surface-400 text-[10px]"
              >
                +
              </button>
            </div>

            {/* A-B Loop */}
            <button
              onClick={abLoop ? clearABLoop : toggleABLoop}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                abLoop
                  ? 'bg-green-500/20 text-green-500'
                  : abLoopSetting === 'setB'
                  ? 'bg-amber-500/20 text-amber-500 animate-pulse'
                  : 'hover:bg-surface-200/60 dark:hover:bg-surface-800/60 text-surface-500'
              }`}
              title={abLoop ? t('player.abLoopClear') : t('player.abLoopSet')}
            >
              {abLoop ? 'A-B' : abLoopSetting === 'setB' ? 'A...' : 'A-B'}
            </button>

            {/* Queue toggle */}
            <button
              onClick={toggleQueue}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all relative ${
                showQueue
                  ? 'bg-primary-500/20 text-primary-500'
                  : 'hover:bg-surface-200/60 dark:hover:bg-surface-800/60 text-surface-500'
              }`}
            >
              {t('player.queue')}
              {queue.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary-500 text-white text-[9px] flex items-center justify-center font-bold">
                  {queue.length}
                </span>
              )}
            </button>

            {/* Lyrics toggle */}
            <button
              onClick={toggleLyrics}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                showLyrics
                  ? 'bg-primary-500/20 text-primary-500'
                  : 'hover:bg-surface-200/60 dark:hover:bg-surface-800/60 text-surface-500'
              }`}
            >
              {t('player.lyrics')}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-2 group">
              <button
                onClick={() => setVolume(volume > 0 ? 0 : 0.5)}
                className="p-1 rounded hover:bg-surface-200/60 dark:hover:bg-surface-800/60 transition-colors"
              >
                {volume === 0 ? (
                  <svg className="w-4 h-4 text-surface-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  </svg>
                ) : volume < 0.5 ? (
                  <svg className="w-4 h-4 text-surface-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-surface-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  </svg>
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-20"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function FxSlider({ label, value, min, max, step, format, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between">
        <span className="text-[10px] text-surface-500">{label}</span>
        <span className="text-[10px] font-mono text-amber-500">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full" />
    </div>
  )
}
