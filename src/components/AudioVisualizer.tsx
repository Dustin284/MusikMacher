import { useRef, useEffect, useCallback } from 'react'

interface Props {
  analyserNode: AnalyserNode | null
  isPlaying: boolean
}

const BAR_COUNT = 64
const BAR_GAP = 2

export default function AudioVisualizer({ analyserNode, isPlaying }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const dataArrayRef = useRef<Uint8Array | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Get canvas dimensions
    const rect = canvas.getBoundingClientRect()
    const width = rect.width
    const height = rect.height

    // Set canvas size (only if changed)
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
    }

    // Clear (transparent background so waveform shows through)
    ctx.clearRect(0, 0, width, height)

    // Calculate bar width (ensure positive)
    const barWidth = Math.max(1, (width - (BAR_COUNT - 1) * BAR_GAP) / BAR_COUNT)

    // Get frequency data if analyser is available
    if (analyserNode && dataArrayRef.current) {
      analyserNode.getByteFrequencyData(dataArrayRef.current)

      // Sample the frequency data for our bar count
      const step = Math.max(1, Math.floor(dataArrayRef.current.length / BAR_COUNT))

      for (let i = 0; i < BAR_COUNT; i++) {
        // Get average value for this bar's range
        let sum = 0
        for (let j = 0; j < step; j++) {
          const idx = i * step + j
          if (idx < dataArrayRef.current.length) {
            sum += dataArrayRef.current[idx]
          }
        }
        const value = sum / step

        // Calculate bar height (normalized to canvas height)
        const barHeight = Math.max(2, (value / 255) * height * 0.9)

        // Calculate x position
        const x = i * (barWidth + BAR_GAP)

        // Create gradient for bar (semi-transparent)
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight)
        gradient.addColorStop(0, 'rgba(147, 51, 234, 0.7)') // purple-600
        gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.6)') // purple-500
        gradient.addColorStop(1, 'rgba(192, 132, 252, 0.5)') // purple-400

        // Draw bar with rounded top
        ctx.fillStyle = gradient
        ctx.beginPath()
        const radius = Math.max(0, Math.min(barWidth / 2, 2))
        if (barWidth > 0 && barHeight > 0) {
          ctx.roundRect(x, height - barHeight, barWidth, barHeight, [radius, radius, 0, 0])
          ctx.fill()
        }
      }
    }
    // No idle bars - waveform is visible underneath

    // Continue animation
    animationRef.current = requestAnimationFrame(draw)
  }, [analyserNode])

  useEffect(() => {
    // Initialize data array when analyser changes
    if (analyserNode) {
      const bufferLength = analyserNode.frequencyBinCount
      dataArrayRef.current = new Uint8Array(bufferLength)
    }
  }, [analyserNode])

  useEffect(() => {
    // Start animation loop
    animationRef.current = requestAnimationFrame(draw)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
    />
  )
}
