import { memo } from 'react'
import { usePlayerStore } from '../store/usePlayerStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { useTranslation } from '../i18n/useTranslation'
import { formatTime } from '../utils/formatTime'
import Waveform from './Waveform'
import LyricsPanel from './LyricsPanel'
import QueuePanel from './QueuePanel'

const PositionTime = memo(function PositionTime() {
  const position = usePlayerStore(s => s.position)
  return <span className="text-[11px] font-mono text-surface-500 w-11 text-right shrink-0 tabular-nums">{formatTime(position)}</span>
})

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
  const queue = usePlayerStore(s => s.queue)
  const settings = useSettingsStore(s => s.settings)
  const { t } = useTranslation()

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
      <div className="h-36 border-t border-surface-200/60 dark:border-surface-800/60 bg-white/50 dark:bg-surface-900/50 backdrop-blur-xl flex gap-4 p-3 relative overflow-hidden">
        {/* Ambient color from artwork */}
        {currentTrack.artworkUrl && (
          <div className="absolute inset-0 pointer-events-none">
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
            <div className="flex-1 h-14">
              <Waveform peaks={waveformPeaks} audio={audio} duration={duration} onSeek={seek} cuePoints={cuePoints} />
            </div>
            <span className="text-[11px] font-mono text-surface-500 w-11 shrink-0 tabular-nums">{formatTime(duration)}</span>
          </div>

          {/* Cue point strip */}
          {cuePoints.length > 0 && (
            <div className="flex items-center gap-1 h-4">
              {Array.from({ length: 9 }, (_, i) => i + 1).map(slot => {
                const cue = cuePoints.find(c => c.id === slot)
                return (
                  <button
                    key={slot}
                    onClick={() => cue && seek(cue.position)}
                    className={`w-4 h-4 rounded text-[8px] font-bold flex items-center justify-center transition-all ${
                      cue
                        ? 'text-white shadow-sm cursor-pointer hover:scale-110'
                        : 'text-surface-400 bg-surface-200/50 dark:bg-surface-800/50 cursor-default opacity-30'
                    }`}
                    style={cue ? { backgroundColor: cue.color } : undefined}
                    title={cue ? `${cue.label} (${formatTime(cue.position)})` : `Cue ${slot}`}
                  >
                    {slot}
                  </button>
                )
              })}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-1.5">
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
