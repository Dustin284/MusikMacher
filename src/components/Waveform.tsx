import { useRef, useCallback, useEffect } from 'react'
import type { CuePoint } from '../types'

interface WaveformProps {
  peaks: number[]
  audio: HTMLAudioElement | null
  duration: number
  onSeek: (position: number) => void
  cuePoints?: CuePoint[]
}

export default function Waveform({ peaks, audio, duration, onSeek, cuePoints }: WaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const unplayedRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const hoverRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)

  const progress = audio && duration > 0 ? audio.currentTime / duration : 0

  // Draw static waveform to canvas
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || peaks.length === 0) return

    const isDark = document.documentElement.classList.contains('dark')

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = container.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      if (w === 0 || h === 0) return

      canvas.width = w * dpr
      canvas.height = h * dpr
      const ctx = canvas.getContext('2d')!
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, w, h)

      const mid = h / 2

      ctx.fillStyle = isDark ? 'rgba(100, 100, 110, 0.15)' : 'rgba(150, 150, 160, 0.2)'
      ctx.fillRect(0, mid - 0.5, w, 1)

      for (let x = 0; x < w; x++) {
        const floatIdx = (x / w) * (peaks.length - 1)
        const idx0 = Math.floor(floatIdx)
        const idx1 = Math.min(idx0 + 1, peaks.length - 1)
        const frac = floatIdx - idx0
        const peak = peaks[idx0] * (1 - frac) + peaks[idx1] * frac

        const barH = peak * mid * 0.92
        const alpha = 0.25 + peak * 0.65
        ctx.fillStyle = isDark
          ? `rgba(180, 185, 195, ${alpha})`
          : `rgba(80, 85, 100, ${alpha})`

        ctx.fillRect(x, mid - barH, 1, barH * 2)
      }
    }

    draw()

    const observer = new ResizeObserver(draw)
    observer.observe(container)
    return () => observer.disconnect()
  }, [peaks])

  // Animate playhead/progress via rAF
  useEffect(() => {
    if (!audio || duration <= 0) return

    const updatePosition = () => {
      const pct = `${(audio.currentTime / duration) * 100}%`
      if (progressRef.current) progressRef.current.style.width = pct
      if (unplayedRef.current) unplayedRef.current.style.left = pct
      if (playheadRef.current) playheadRef.current.style.left = pct
    }

    const animate = () => {
      updatePosition()
      rafRef.current = requestAnimationFrame(animate)
    }

    const start = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(animate)
    }

    const stop = () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      updatePosition()
    }

    audio.addEventListener('play', start)
    audio.addEventListener('pause', stop)
    audio.addEventListener('ended', stop)
    audio.addEventListener('seeked', updatePosition)

    if (!audio.paused) start()
    else updatePosition()

    return () => {
      audio.removeEventListener('play', start)
      audio.removeEventListener('pause', stop)
      audio.removeEventListener('ended', stop)
      audio.removeEventListener('seeked', updatePosition)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [audio, duration])

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || !duration) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    onSeek(x * duration)
  }, [duration, onSeek])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!hoverRef.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    hoverRef.current.style.left = `${((e.clientX - rect.left) / rect.width) * 100}%`
    hoverRef.current.style.opacity = '1'
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (hoverRef.current) hoverRef.current.style.opacity = '0'
  }, [])

  if (peaks.length === 0) {
    return (
      <div
        ref={containerRef}
        onClick={handleClick}
        className="relative h-full w-full cursor-pointer rounded-lg overflow-hidden bg-surface-200/40 dark:bg-surface-800/40"
      >
        <div
          ref={progressRef}
          className="absolute inset-y-0 left-0 bg-surface-300/30 dark:bg-surface-700/30"
          style={{ width: `${progress * 100}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-xs text-surface-400 dark:text-surface-500">
          {duration > 0 ? '' : ''}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative h-full w-full cursor-pointer rounded-lg overflow-hidden bg-surface-100/60 dark:bg-surface-900/50 group"
    >
      {/* Static waveform canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />

      {/* Played overlay tint */}
      <div
        ref={progressRef}
        className="absolute inset-y-0 left-0 bg-primary-500/[0.12] dark:bg-primary-400/[0.08] pointer-events-none"
        style={{ width: `${progress * 100}%` }}
      />

      {/* Unplayed darkening */}
      <div
        ref={unplayedRef}
        className="absolute inset-y-0 right-0 bg-surface-950/[0.04] dark:bg-surface-950/[0.15] pointer-events-none"
        style={{ left: `${progress * 100}%` }}
      />

      {/* Cue point markers */}
      {cuePoints && duration > 0 && cuePoints.map(cue => (
        <div
          key={cue.id}
          className="absolute top-0 bottom-0 w-[3px] pointer-events-none z-[5]"
          style={{
            left: `${(cue.position / duration) * 100}%`,
            backgroundColor: cue.color,
            boxShadow: `0 0 6px ${cue.color}80`,
            opacity: 0.9,
          }}
          title={cue.label}
        >
          <div
            className="absolute -top-0.5 -left-[5px] w-[13px] h-[13px] rounded-sm text-[8px] font-bold flex items-center justify-center text-white shadow-sm"
            style={{ backgroundColor: cue.color, boxShadow: `0 1px 3px ${cue.color}60` }}
          >
            {cue.id <= 9 ? cue.id : ''}
          </div>
        </div>
      ))}

      {/* Hover cursor line */}
      <div
        ref={hoverRef}
        className="absolute inset-y-0 w-px bg-surface-500/40 dark:bg-surface-400/30 pointer-events-none"
        style={{ opacity: 0 }}
      />

      {/* Playhead */}
      <div
        ref={playheadRef}
        className="absolute inset-y-0 pointer-events-none"
        style={{ left: `${progress * 100}%` }}
      >
        <div className="w-[2px] h-full bg-white dark:bg-white shadow-[0_0_4px_rgba(255,255,255,0.5)]" />
      </div>
    </div>
  )
}
