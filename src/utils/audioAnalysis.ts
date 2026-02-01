import type { CuePoint } from '../types'

/**
 * Detect drops and builds in an audio track using RMS energy analysis.
 * Computes RMS energy in 0.5s windows, then finds peaks where the
 * energy delta exceeds 2x the standard deviation.
 * Returns CuePoints with IDs starting at 100.
 */
export function detectDrops(audioBuffer: AudioBuffer): CuePoint[] {
  const channelData = audioBuffer.getChannelData(0)
  const sampleRate = audioBuffer.sampleRate
  const windowSize = Math.floor(sampleRate * 0.5) // 0.5 second windows
  const numWindows = Math.floor(channelData.length / windowSize)

  if (numWindows < 3) return []

  // Calculate RMS energy for each window
  const rmsEnergy = new Float64Array(numWindows)
  for (let i = 0; i < numWindows; i++) {
    let sum = 0
    const offset = i * windowSize
    for (let j = 0; j < windowSize; j++) {
      const sample = channelData[offset + j]
      sum += sample * sample
    }
    rmsEnergy[i] = Math.sqrt(sum / windowSize)
  }

  // Calculate deltas between consecutive windows
  const deltas = new Float64Array(numWindows - 1)
  for (let i = 0; i < numWindows - 1; i++) {
    deltas[i] = rmsEnergy[i + 1] - rmsEnergy[i]
  }

  // Calculate mean and standard deviation of deltas
  let deltaMean = 0
  for (let i = 0; i < deltas.length; i++) {
    deltaMean += deltas[i]
  }
  deltaMean /= deltas.length

  let deltaVariance = 0
  for (let i = 0; i < deltas.length; i++) {
    const diff = deltas[i] - deltaMean
    deltaVariance += diff * diff
  }
  deltaVariance /= deltas.length
  const deltaStdDev = Math.sqrt(deltaVariance)

  const threshold = deltaStdDev * 2
  const cuePoints: CuePoint[] = []
  let cueId = 100

  // Minimum gap between detected cue points (in windows = 2 seconds = 4 windows)
  const minGapWindows = 4
  let lastDetectedWindow = -minGapWindows

  for (let i = 0; i < deltas.length; i++) {
    if (i - lastDetectedWindow < minGapWindows) continue

    const delta = deltas[i]

    if (delta > threshold) {
      // Positive energy spike = Drop
      const position = (i + 1) * 0.5 // position in seconds
      cuePoints.push({
        id: cueId++,
        position,
        label: 'Drop',
        color: '#ef4444', // red
        source: 'auto-drop',
      })
      lastDetectedWindow = i
    } else if (delta < -threshold) {
      // Large energy buildup before a drop typically shows as
      // a negative delta (energy decreasing = build/breakdown)
      // We look for significant negative deltas followed by a rise
      const position = (i + 1) * 0.5
      cuePoints.push({
        id: cueId++,
        position,
        label: 'Build',
        color: '#f59e0b', // amber
        source: 'auto-build',
      })
      lastDetectedWindow = i
    }
  }

  return cuePoints
}

/**
 * Detect BPM of an audio track using onset envelope and autocorrelation.
 * Returns the most likely BPM in the 60-200 range.
 */
export function detectBPM(audioBuffer: AudioBuffer): number {
  const channelData = audioBuffer.getChannelData(0)
  const sampleRate = audioBuffer.sampleRate

  // Downsample to ~11025 Hz for faster processing
  const downsampleFactor = Math.max(1, Math.floor(sampleRate / 11025))
  const downsampledRate = sampleRate / downsampleFactor
  const downsampledLength = Math.floor(channelData.length / downsampleFactor)
  const downsampled = new Float32Array(downsampledLength)

  for (let i = 0; i < downsampledLength; i++) {
    downsampled[i] = channelData[i * downsampleFactor]
  }

  // Compute onset envelope using spectral flux
  const hopSize = Math.floor(downsampledRate * 0.01) // ~10ms hop
  const frameSize = hopSize * 4
  const numFrames = Math.floor((downsampledLength - frameSize) / hopSize)

  if (numFrames < 2) return 0

  const envelope = new Float32Array(numFrames)

  // Simple energy-based onset detection
  for (let i = 0; i < numFrames; i++) {
    let energy = 0
    const offset = i * hopSize
    for (let j = 0; j < frameSize && offset + j < downsampledLength; j++) {
      energy += downsampled[offset + j] * downsampled[offset + j]
    }
    envelope[i] = Math.sqrt(energy / frameSize)
  }

  // Half-wave rectified first difference (onset strength)
  const onset = new Float32Array(numFrames - 1)
  for (let i = 0; i < numFrames - 1; i++) {
    onset[i] = Math.max(0, envelope[i + 1] - envelope[i])
  }

  // Autocorrelation of onset envelope
  // BPM range 60-200 -> period in frames
  const framesPerSecond = downsampledRate / hopSize
  const minLag = Math.floor(framesPerSecond * (60 / 200)) // 200 BPM
  const maxLag = Math.floor(framesPerSecond * (60 / 60))  // 60 BPM
  const effectiveMaxLag = Math.min(maxLag, onset.length - 1)

  if (minLag >= effectiveMaxLag) return 0

  let bestLag = minLag
  let bestCorr = -Infinity

  for (let lag = minLag; lag <= effectiveMaxLag; lag++) {
    let correlation = 0
    const corrLength = Math.min(onset.length - lag, onset.length)
    for (let i = 0; i < corrLength; i++) {
      correlation += onset[i] * onset[i + lag]
    }
    correlation /= corrLength

    if (correlation > bestCorr) {
      bestCorr = correlation
      bestLag = lag
    }
  }

  // Octave correction: the autocorrelation often favors the subharmonic (half BPM).
  // Check if doubling/halving gives a BPM in the typical 80-170 range with reasonable correlation.
  let rawBpm = (framesPerSecond * 60) / bestLag

  if (rawBpm < 80) {
    // Likely detected half-tempo — check correlation at double BPM (half lag)
    const halfLag = Math.round(bestLag / 2)
    if (halfLag >= minLag) {
      let halfCorr = 0
      const corrLen = Math.min(onset.length - halfLag, onset.length)
      for (let i = 0; i < corrLen; i++) {
        halfCorr += onset[i] * onset[i + halfLag]
      }
      halfCorr /= corrLen
      // Accept if correlation is at least 50% of the best — subharmonics
      // naturally score higher, so the threshold must be generous
      if (halfCorr > bestCorr * 0.5) {
        bestLag = halfLag
        rawBpm = (framesPerSecond * 60) / bestLag
      }
    }
  } else if (rawBpm > 170) {
    // Likely detected double-tempo — check correlation at half BPM (double lag)
    const doubleLag = bestLag * 2
    if (doubleLag <= effectiveMaxLag) {
      let doubleCorr = 0
      const corrLen = Math.min(onset.length - doubleLag, onset.length)
      for (let i = 0; i < corrLen; i++) {
        doubleCorr += onset[i] * onset[i + doubleLag]
      }
      doubleCorr /= corrLen
      if (doubleCorr > bestCorr * 0.8) {
        bestLag = doubleLag
        rawBpm = (framesPerSecond * 60) / bestLag
      }
    }
  }

  // Round to nearest integer
  return Math.round(rawBpm)
}

/**
 * Detect musical key using FFT -> chroma features -> Krumhansl-Schmuckler profile matching.
 * Returns the key in Camelot notation (e.g., "8A", "11B").
 */
export function detectKey(audioBuffer: AudioBuffer): string {
  const channelData = audioBuffer.getChannelData(0)
  const sampleRate = audioBuffer.sampleRate

  // Use a segment from the middle of the track for more stable pitch content
  const segmentDuration = Math.min(30, audioBuffer.duration) // max 30 seconds
  const segmentSamples = Math.floor(segmentDuration * sampleRate)
  const startSample = Math.floor((channelData.length - segmentSamples) / 2)
  const segment = channelData.slice(
    Math.max(0, startSample),
    Math.max(0, startSample) + segmentSamples,
  )

  // FFT size (power of 2)
  const fftSize = 8192
  const numFrames = Math.floor(segment.length / fftSize)

  if (numFrames < 1) return 'N/A'

  // Accumulate chroma features across frames
  const chroma = new Float64Array(12) // C, C#, D, D#, E, F, F#, G, G#, A, A#, B

  for (let frame = 0; frame < numFrames; frame++) {
    const offset = frame * fftSize
    const frameData = new Float64Array(fftSize)
    for (let i = 0; i < fftSize; i++) {
      // Apply Hanning window
      const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)))
      frameData[i] = (segment[offset + i] || 0) * window
    }

    // Compute magnitude spectrum via DFT (simplified - only compute needed bins)
    // For efficiency, we compute power at specific frequencies mapping to each chroma bin
    const magnitudes = computeMagnitudeSpectrum(frameData, fftSize)

    // Map FFT bins to chroma
    for (let bin = 1; bin < fftSize / 2; bin++) {
      const freq = (bin * sampleRate) / fftSize
      if (freq < 65 || freq > 2000) continue // A2 to B6 range

      const chromaBin = frequencyToChroma(freq)
      chroma[chromaBin] += magnitudes[bin] * magnitudes[bin]
    }
  }

  // Normalize chroma
  let maxChroma = 0
  for (let i = 0; i < 12; i++) {
    if (chroma[i] > maxChroma) maxChroma = chroma[i]
  }
  if (maxChroma > 0) {
    for (let i = 0; i < 12; i++) {
      chroma[i] /= maxChroma
    }
  }

  // Krumhansl-Schmuckler key profiles
  const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
  const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

  let bestKey = 0
  let bestMode: 'major' | 'minor' = 'major'
  let bestCorrelation = -Infinity

  // Test all 12 major and 12 minor keys
  for (let shift = 0; shift < 12; shift++) {
    const majorCorr = pearsonCorrelation(chroma, rotateArray(majorProfile, shift))
    const minorCorr = pearsonCorrelation(chroma, rotateArray(minorProfile, shift))

    if (majorCorr > bestCorrelation) {
      bestCorrelation = majorCorr
      bestKey = shift
      bestMode = 'major'
    }
    if (minorCorr > bestCorrelation) {
      bestCorrelation = minorCorr
      bestKey = shift
      bestMode = 'minor'
    }
  }

  return toCamelotNotation(bestKey, bestMode)
}

/**
 * Compute normalized waveform peaks from an AudioBuffer.
 */
export function computeWaveformPeaks(audioBuffer: AudioBuffer, numPeaks = 2048): number[] {
  const channelData = audioBuffer.getChannelData(0)
  const blockSize = Math.floor(channelData.length / numPeaks)
  if (blockSize < 1) return []

  const peaks = new Array<number>(numPeaks)
  for (let i = 0; i < numPeaks; i++) {
    let peak = 0
    const start = i * blockSize
    for (let j = 0; j < blockSize; j++) {
      const val = Math.abs(channelData[start + j])
      if (val > peak) peak = val
    }
    peaks[i] = peak
  }

  let maxPeak = 0.001
  for (const p of peaks) if (p > maxPeak) maxPeak = p
  for (let i = 0; i < numPeaks; i++) peaks[i] /= maxPeak

  return peaks
}

// --- Internal helpers ---

/**
 * Compute magnitude spectrum using a real DFT implementation.
 * This is a simplified Cooley-Tukey FFT for real input.
 */
function computeMagnitudeSpectrum(data: Float64Array, size: number): Float64Array {
  // Bit-reversal permutation
  const real = new Float64Array(size)
  const imag = new Float64Array(size)

  for (let i = 0; i < size; i++) {
    real[i] = data[i]
  }

  // In-place FFT (iterative Cooley-Tukey)
  let j = 0
  for (let i = 0; i < size; i++) {
    if (j > i) {
      const tempR = real[j]
      real[j] = real[i]
      real[i] = tempR
    }
    let m = size >> 1
    while (m >= 1 && j >= m) {
      j -= m
      m >>= 1
    }
    j += m
  }

  for (let step = 2; step <= size; step *= 2) {
    const halfStep = step / 2
    const angle = (-2 * Math.PI) / step
    const wR = Math.cos(angle)
    const wI = Math.sin(angle)

    for (let group = 0; group < size; group += step) {
      let curR = 1
      let curI = 0

      for (let pair = 0; pair < halfStep; pair++) {
        const idx1 = group + pair
        const idx2 = group + pair + halfStep

        const tR = curR * real[idx2] - curI * imag[idx2]
        const tI = curR * imag[idx2] + curI * real[idx2]

        real[idx2] = real[idx1] - tR
        imag[idx2] = imag[idx1] - tI
        real[idx1] = real[idx1] + tR
        imag[idx1] = imag[idx1] + tI

        const newCurR = curR * wR - curI * wI
        curI = curR * wI + curI * wR
        curR = newCurR
      }
    }
  }

  // Compute magnitudes
  const magnitudes = new Float64Array(size / 2)
  for (let i = 0; i < size / 2; i++) {
    magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i])
  }

  return magnitudes
}

/**
 * Map a frequency in Hz to a chroma bin (0=C, 1=C#, ..., 11=B).
 */
function frequencyToChroma(freq: number): number {
  // MIDI note number: 69 + 12 * log2(freq/440)
  const midiNote = 69 + 12 * Math.log2(freq / 440)
  // Chroma = midiNote mod 12, where C = 0
  return Math.round(midiNote) % 12
}

/**
 * Pearson correlation between two arrays.
 */
function pearsonCorrelation(a: Float64Array, b: number[]): number {
  const n = a.length
  let sumA = 0, sumB = 0, sumAB = 0, sumA2 = 0, sumB2 = 0

  for (let i = 0; i < n; i++) {
    sumA += a[i]
    sumB += b[i]
    sumAB += a[i] * b[i]
    sumA2 += a[i] * a[i]
    sumB2 += b[i] * b[i]
  }

  const numerator = n * sumAB - sumA * sumB
  const denominator = Math.sqrt((n * sumA2 - sumA * sumA) * (n * sumB2 - sumB * sumB))

  if (denominator === 0) return 0
  return numerator / denominator
}

/**
 * Rotate an array by `shift` positions to the right (circular).
 */
function rotateArray(arr: number[], shift: number): number[] {
  const n = arr.length
  const result = new Array(n)
  for (let i = 0; i < n; i++) {
    result[i] = arr[(i - shift + n) % n]
  }
  return result
}

/**
 * Convert a key index (0=C) and mode to Camelot wheel notation.
 * Major keys get "B", minor keys get "A".
 */
function toCamelotNotation(keyIndex: number, mode: 'major' | 'minor'): string {
  // Camelot wheel mapping
  // Major (B): C=8B, Db=3B, D=10B, Eb=5B, E=12B, F=7B, F#=2B, G=9B, Ab=4B, A=11B, Bb=6B, B=1B
  // Minor (A): Am=8A, Bbm=3A, Bm=10A, Cm=5A, C#m=12A, Dm=7A, Ebm=2A, Em=9A, Fm=4A, F#m=11A, Gm=6A, G#m=1A
  const majorCamelot = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1]
  const minorCamelot = [5, 12, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10]

  if (mode === 'major') {
    return `${majorCamelot[keyIndex]}B`
  } else {
    return `${minorCamelot[keyIndex]}A`
  }
}
