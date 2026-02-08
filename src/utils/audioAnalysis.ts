import type { CuePoint } from '../types'

/**
 * Detect drops and builds in an audio track using multi-band spectral analysis.
 *
 * Algorithm:
 * 1. Split audio into ~50ms frames (25ms hop) and compute FFT per frame
 * 2. Sum energy in 4 frequency bands (sub-bass, bass, mid, high)
 * 3. Compute half-wave rectified spectral flux per band
 * 4. Adaptive threshold via sliding median + 2.5× MAD (4s window)
 * 5. Score & classify candidates as Drop or Build
 * 6. Greedy selection: top 8 by score, min 8s gap
 *
 * Returns CuePoints with IDs starting at 100.
 */
export function detectDrops(audioBuffer: AudioBuffer): CuePoint[] {
  const channelData = audioBuffer.getChannelData(0)
  const sampleRate = audioBuffer.sampleRate

  // Frame parameters — use power-of-2 FFT size closest to 50ms
  const fftSize = 2048 // ~46ms at 44100 Hz
  const hopSize = Math.floor(fftSize / 2) // ~23ms hop
  const numFrames = Math.floor((channelData.length - fftSize) / hopSize)

  if (numFrames < 10) return []

  // Frequency band boundaries in Hz
  const bands = [
    { name: 'subBass', lo: 20, hi: 100 },
    { name: 'bass', lo: 100, hi: 300 },
    { name: 'mid', lo: 300, hi: 4000 },
    { name: 'high', lo: 4000, hi: sampleRate / 2 },
  ]

  // Precompute bin ranges for each band
  const bandBins = bands.map(b => ({
    lo: Math.max(1, Math.floor((b.lo * fftSize) / sampleRate)),
    hi: Math.min(fftSize / 2 - 1, Math.floor((b.hi * fftSize) / sampleRate)),
  }))

  // Compute per-frame, per-band energy
  const bandEnergy: Float64Array[] = bands.map(() => new Float64Array(numFrames))
  const frameData = new Float64Array(fftSize)

  for (let f = 0; f < numFrames; f++) {
    const offset = f * hopSize
    // Apply Hann window and copy to frameData
    for (let i = 0; i < fftSize; i++) {
      const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)))
      frameData[i] = (channelData[offset + i] || 0) * w
    }

    const mags = computeMagnitudeSpectrum(frameData, fftSize)

    for (let b = 0; b < bands.length; b++) {
      let energy = 0
      for (let bin = bandBins[b].lo; bin <= bandBins[b].hi; bin++) {
        energy += mags[bin] * mags[bin]
      }
      bandEnergy[b][f] = energy
    }
  }

  // Compute half-wave rectified spectral flux per band
  const flux: Float64Array[] = bands.map(() => new Float64Array(numFrames - 1))
  for (let b = 0; b < bands.length; b++) {
    for (let f = 0; f < numFrames - 1; f++) {
      flux[b][f] = Math.max(0, bandEnergy[b][f + 1] - bandEnergy[b][f])
    }
  }

  const numFluxFrames = numFrames - 1
  const framesPerSecond = sampleRate / hopSize

  // Adaptive threshold: sliding median + 2.5 × MAD over ~4s window
  const windowHalfFrames = Math.floor(framesPerSecond * 2) // 2s each side = 4s total

  function adaptiveThreshold(arr: Float64Array): Float64Array {
    const thresholds = new Float64Array(arr.length)
    for (let i = 0; i < arr.length; i++) {
      const lo = Math.max(0, i - windowHalfFrames)
      const hi = Math.min(arr.length - 1, i + windowHalfFrames)
      // Collect window values
      const windowLen = hi - lo + 1
      const windowVals = new Float64Array(windowLen)
      for (let j = 0; j < windowLen; j++) windowVals[j] = arr[lo + j]
      // Sort for median
      windowVals.sort()
      const median = windowVals[Math.floor(windowLen / 2)]
      // MAD
      const deviations = new Float64Array(windowLen)
      for (let j = 0; j < windowLen; j++) deviations[j] = Math.abs(windowVals[j] - median)
      deviations.sort()
      const mad = deviations[Math.floor(windowLen / 2)]
      thresholds[i] = median + 2.5 * Math.max(mad, 1e-10)
    }
    return thresholds
  }

  // Compute thresholds for each band
  const thresholds = flux.map(f => adaptiveThreshold(f))

  // Score each frame: weighted combination of above-threshold flux
  // Drop weighting: sub-bass heavy
  const dropWeights = [0.4, 0.3, 0.2, 0.1]
  // Build detection: high/mid increase with bass decrease
  const scores = new Float64Array(numFluxFrames)
  const buildScores = new Float64Array(numFluxFrames)

  for (let f = 0; f < numFluxFrames; f++) {
    let dropScore = 0
    for (let b = 0; b < bands.length; b++) {
      const excess = flux[b][f] - thresholds[b][f]
      if (excess > 0) {
        dropScore += excess * dropWeights[b]
      }
    }
    scores[f] = dropScore

    // Build: high+mid flux exceeds threshold while bass flux is low
    const highExcess = flux[3][f] - thresholds[3][f]
    const midExcess = flux[2][f] - thresholds[2][f]
    const bassFluxLow = flux[0][f] < thresholds[0][f] * 0.5 && flux[1][f] < thresholds[1][f] * 0.5
    if ((highExcess > 0 || midExcess > 0) && bassFluxLow) {
      buildScores[f] = Math.max(0, highExcess) * 0.5 + Math.max(0, midExcess) * 0.5
    }
  }

  // Collect candidates: only frames where score is positive (above adaptive threshold)
  type Candidate = { frame: number; score: number; type: 'drop' | 'build' }
  const allCandidates: Candidate[] = []

  for (let f = 0; f < numFluxFrames; f++) {
    if (scores[f] > 0) allCandidates.push({ frame: f, score: scores[f], type: 'drop' })
    if (buildScores[f] > 0) allCandidates.push({ frame: f, score: buildScores[f], type: 'build' })
  }

  // Sort by score descending — pick the strongest hits first
  allCandidates.sort((a, b) => b.score - a.score)

  // Greedy selection: max 8 markers, min 8s gap between any two
  const MAX_MARKERS = 8
  const minGapFrames = Math.floor(framesPerSecond * 8)
  const selected: Candidate[] = []

  for (const c of allCandidates) {
    if (selected.length >= MAX_MARKERS) break
    let tooClose = false
    for (const s of selected) {
      if (Math.abs(c.frame - s.frame) < minGapFrames) {
        tooClose = true
        break
      }
    }
    if (!tooClose) selected.push(c)
  }

  // Sort by time and generate CuePoints
  selected.sort((a, b) => a.frame - b.frame)

  const cuePoints: CuePoint[] = []
  let cueId = 100

  for (const c of selected) {
    const position = ((c.frame + 1) * hopSize) / sampleRate
    if (c.type === 'drop') {
      cuePoints.push({
        id: cueId++,
        position: Math.round(position * 100) / 100,
        label: 'Drop',
        color: '#ef4444',
        source: 'auto-drop',
      })
    } else {
      cuePoints.push({
        id: cueId++,
        position: Math.round(position * 100) / 100,
        label: 'Build',
        color: '#f59e0b',
        source: 'auto-build',
      })
    }
  }

  return cuePoints
}

/**
 * Detect BPM using spectral-flux onset detection + autocorrelation + log-normal
 * tempo weighting (Ellis 2007 / librosa approach, same method as vocalremover.org).
 *
 * Algorithm:
 * 1. Compute STFT magnitude spectrum per frame (Hann window, 50% overlap)
 * 2. Half-wave rectified spectral flux → onset strength envelope
 * 3. Global autocorrelation of onset envelope for lag range [30–300 BPM]
 * 4. Log-normal tempo prior centered at 120 BPM (σ = 1 octave)
 * 5. Peak selection: argmax( log(1 + 1e6·autocorr) + logprior )
 * 6. Parabolic interpolation for sub-frame accuracy
 * 7. Octave folding into "felt tempo" range (60–150 BPM)
 */
export function detectBPM(audioBuffer: AudioBuffer): number {
  const channelData = audioBuffer.getChannelData(0)
  const sampleRate = audioBuffer.sampleRate

  // --- Parameters (matching librosa / Ellis 2007) ---
  const fftSize = 2048
  const hopSize = fftSize >> 1 // 50% overlap → ~43 fps at 44.1 kHz
  const START_BPM = 120.0  // prior center (Ellis 2007 default)
  const STD_BPM = 1.0      // log-normal std in octaves
  const MAX_TEMPO = 300.0
  const MIN_TEMPO = 30.0

  const numFrames = Math.floor((channelData.length - fftSize) / hopSize)
  if (numFrames < 2) return 0

  // --- Step 1: Spectral-flux onset strength ---
  // Pre-allocate FFT work buffers (avoids per-frame allocations)
  const fftRe = new Float64Array(fftSize)
  const fftIm = new Float64Array(fftSize)
  const curMags = new Float64Array(fftSize >> 1)
  const prevMags = new Float64Array(fftSize >> 1)
  const onset = new Float64Array(numFrames)
  const halfN = fftSize >> 1

  for (let f = 0; f < numFrames; f++) {
    const offset = f * hopSize

    // Hann window → fftRe, zero fftIm
    for (let i = 0; i < fftSize; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1))
      fftRe[i] = (channelData[offset + i] || 0) * w
    }
    fftIm.fill(0)

    // In-place Cooley-Tukey FFT
    fftInPlace(fftRe, fftIm, fftSize)

    // Magnitude spectrum
    for (let i = 0; i < halfN; i++) {
      curMags[i] = Math.sqrt(fftRe[i] * fftRe[i] + fftIm[i] * fftIm[i])
    }

    // Spectral flux: sum of positive magnitude differences (half-wave rectified)
    if (f > 0) {
      let flux = 0
      for (let bin = 0; bin < halfN; bin++) {
        const diff = curMags[bin] - prevMags[bin]
        if (diff > 0) flux += diff
      }
      onset[f] = flux
    }

    // current → previous (swap via copy)
    prevMags.set(curMags)
  }

  // --- Step 2: Global autocorrelation of onset envelope ---
  const fps = sampleRate / hopSize
  const maxLag = Math.min(onset.length - 1, Math.floor(60 * fps / MIN_TEMPO))
  const minLag = Math.max(1, Math.ceil(60 * fps / MAX_TEMPO))
  if (minLag >= maxLag) return 0

  const autocorr = new Float64Array(maxLag + 1)
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    const len = onset.length - lag
    for (let i = 0; i < len; i++) {
      sum += onset[i] * onset[i + lag]
    }
    autocorr[lag] = sum / len // normalize by overlap length
  }

  // Normalize to [0, 1]
  let maxAC = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    if (autocorr[lag] > maxAC) maxAC = autocorr[lag]
  }
  if (maxAC > 0) {
    for (let lag = minLag; lag <= maxLag; lag++) autocorr[lag] /= maxAC
  }

  // --- Step 3: Log-normal tempo weighting + peak selection ---
  // score(lag) = log(1 + 1e6 · ac[lag]) + logprior(bpm)
  // logprior = -0.5 · ((log₂(bpm) − log₂(120)) / σ)²
  const log2Start = Math.log2(START_BPM)
  let bestLag = minLag
  let bestScore = -Infinity

  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = (60 * fps) / lag
    const logRatio = Math.log2(bpm) - log2Start
    const logprior = -0.5 * (logRatio / STD_BPM) * (logRatio / STD_BPM)
    const score = Math.log1p(1e6 * autocorr[lag]) + logprior

    if (score > bestScore) {
      bestScore = score
      bestLag = lag
    }
  }

  // --- Step 4: Parabolic interpolation for sub-frame accuracy ---
  let refinedLag = bestLag
  if (bestLag > minLag && bestLag < maxLag) {
    const a = autocorr[bestLag - 1]
    const b = autocorr[bestLag]
    const c = autocorr[bestLag + 1]
    const denom = a - 2 * b + c
    if (Math.abs(denom) > 1e-10) {
      refinedLag = bestLag + 0.5 * (a - c) / denom
    }
  }

  // --- Step 5: Octave folding into "felt tempo" range (60–150 BPM) ---
  // This matches vocalremover.org / web BPM-finder conventions:
  // most music is perceived in the 60–150 BPM range.
  let bpm = (60 * fps) / refinedLag
  while (bpm > 150) bpm /= 2
  while (bpm < 60) bpm *= 2

  return Math.round(bpm)
}

/**
 * In-place iterative Cooley-Tukey FFT (radix-2, decimation-in-time).
 * Operates on pre-allocated real/imag arrays of the given size.
 */
function fftInPlace(real: Float64Array, imag: Float64Array, size: number): void {
  // Bit-reversal permutation
  let j = 0
  for (let i = 0; i < size; i++) {
    if (j > i) {
      const tR = real[j]; real[j] = real[i]; real[i] = tR
      const tI = imag[j]; imag[j] = imag[i]; imag[i] = tI
    }
    let m = size >> 1
    while (m >= 1 && j >= m) { j -= m; m >>= 1 }
    j += m
  }

  // Butterfly stages
  for (let step = 2; step <= size; step <<= 1) {
    const halfStep = step >> 1
    const angle = (-2 * Math.PI) / step
    const wR = Math.cos(angle)
    const wI = Math.sin(angle)

    for (let group = 0; group < size; group += step) {
      let cR = 1, cI = 0
      for (let pair = 0; pair < halfStep; pair++) {
        const i1 = group + pair
        const i2 = i1 + halfStep
        const tR = cR * real[i2] - cI * imag[i2]
        const tI = cR * imag[i2] + cI * real[i2]
        real[i2] = real[i1] - tR
        imag[i2] = imag[i1] - tI
        real[i1] += tR
        imag[i1] += tI
        const nR = cR * wR - cI * wI
        cI = cR * wI + cI * wR
        cR = nR
      }
    }
  }
}

/**
 * Detect musical key using FFT -> chroma features -> Krumhansl-Schmuckler profile matching.
 * Returns the key in Camelot notation (e.g., "8A", "11B").
 */
export function detectKey(audioBuffer: AudioBuffer): string {
  const channelData = audioBuffer.getChannelData(0)
  const sampleRate = audioBuffer.sampleRate

  // Use a segment from the middle of the track for more stable pitch content
  const segmentDuration = Math.min(60, audioBuffer.duration) // max 60 seconds
  const segmentSamples = Math.floor(segmentDuration * sampleRate)
  const startSample = Math.floor((channelData.length - segmentSamples) / 2)
  const segment = channelData.slice(
    Math.max(0, startSample),
    Math.max(0, startSample) + segmentSamples,
  )

  // FFT size (power of 2)
  const fftSize = 8192
  const hopSizeKey = Math.floor(fftSize / 2) // 50% overlap
  const numFrames = Math.floor((segment.length - fftSize) / hopSizeKey) + 1

  if (numFrames < 1) return 'N/A'

  // Accumulate chroma features across frames
  const chroma = new Float64Array(12) // C, C#, D, D#, E, F, F#, G, G#, A, A#, B

  for (let frame = 0; frame < numFrames; frame++) {
    const offset = frame * hopSizeKey
    const frameData = new Float64Array(fftSize)
    for (let i = 0; i < fftSize; i++) {
      // Apply Hanning window
      const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)))
      frameData[i] = (segment[offset + i] || 0) * window
    }

    // Compute magnitude spectrum via DFT (simplified - only compute needed bins)
    // For efficiency, we compute power at specific frequencies mapping to each chroma bin
    const magnitudes = computeMagnitudeSpectrum(frameData, fftSize)

    // Map FFT bins to chroma — wider frequency range for better accuracy
    for (let bin = 1; bin < fftSize / 2; bin++) {
      const freq = (bin * sampleRate) / fftSize
      if (freq < 50 || freq > 4000) continue // wider range: captures bass fundamentals and higher harmonics

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
 * Compute spectral features from an AudioBuffer for AI analysis.
 * Returns centroid, rolloff, zcr, rms, and a 12-bin chroma vector.
 */
export function computeSpectralFeatures(audioBuffer: AudioBuffer): {
  centroid: number
  rolloff: number
  zcr: number
  rms: number
  chromaVector: number[]
} {
  const channelData = audioBuffer.getChannelData(0)
  const sampleRate = audioBuffer.sampleRate
  const fftSize = 2048
  const hopSize = Math.floor(fftSize / 2) // 50% overlap
  const numFrames = Math.floor((channelData.length - fftSize) / hopSize)

  if (numFrames < 1) return { centroid: 0, rolloff: 0, zcr: 0, rms: 0, chromaVector: new Array(12).fill(0) }

  let totalCentroid = 0
  let totalRolloff = 0
  let totalZcr = 0
  let totalRms = 0
  const chromaAccum = new Float64Array(12)
  const frameData = new Float64Array(fftSize)

  for (let f = 0; f < numFrames; f++) {
    const offset = f * hopSize

    // RMS
    let sumSq = 0
    for (let i = 0; i < fftSize; i++) {
      const s = channelData[offset + i] || 0
      sumSq += s * s
    }
    totalRms += Math.sqrt(sumSq / fftSize)

    // Zero-crossing rate
    let crossings = 0
    for (let i = 1; i < fftSize; i++) {
      const prev = channelData[offset + i - 1] || 0
      const curr = channelData[offset + i] || 0
      if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) crossings++
    }
    totalZcr += crossings / fftSize

    // Windowed FFT
    for (let i = 0; i < fftSize; i++) {
      const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)))
      frameData[i] = (channelData[offset + i] || 0) * w
    }
    const mags = computeMagnitudeSpectrum(frameData, fftSize)

    // Spectral centroid: weighted mean of frequencies
    let magSum = 0
    let weightedSum = 0
    for (let bin = 1; bin < fftSize / 2; bin++) {
      const freq = (bin * sampleRate) / fftSize
      weightedSum += freq * mags[bin]
      magSum += mags[bin]
    }
    totalCentroid += magSum > 0 ? weightedSum / magSum : 0

    // Spectral rolloff: frequency below which 85% of spectral energy lies
    const totalEnergy = magSum
    let cumEnergy = 0
    let rolloffFreq = 0
    for (let bin = 1; bin < fftSize / 2; bin++) {
      cumEnergy += mags[bin]
      if (cumEnergy >= totalEnergy * 0.85) {
        rolloffFreq = (bin * sampleRate) / fftSize
        break
      }
    }
    totalRolloff += rolloffFreq

    // Chroma accumulation
    for (let bin = 1; bin < fftSize / 2; bin++) {
      const freq = (bin * sampleRate) / fftSize
      if (freq < 50 || freq > 4000) continue
      const chromaBin = frequencyToChroma(freq)
      chromaAccum[chromaBin] += mags[bin] * mags[bin]
    }
  }

  // Normalize chroma vector
  let maxChroma = 0
  for (let i = 0; i < 12; i++) {
    if (chromaAccum[i] > maxChroma) maxChroma = chromaAccum[i]
  }
  const chromaVector: number[] = new Array(12)
  for (let i = 0; i < 12; i++) {
    chromaVector[i] = maxChroma > 0 ? chromaAccum[i] / maxChroma : 0
  }

  return {
    centroid: totalCentroid / numFrames,
    rolloff: totalRolloff / numFrames,
    zcr: totalZcr / numFrames,
    rms: totalRms / numFrames,
    chromaVector,
  }
}

/**
 * Detect energy level (1-10) based on RMS, spectral rolloff, and BPM.
 */
export function detectEnergy(audioBuffer: AudioBuffer, bpm: number, rms: number, rolloff: number): number {
  const channelData = audioBuffer.getChannelData(0)
  const sampleRate = audioBuffer.sampleRate

  // Compute peak RMS from top 10% of frames
  const fftSize = 2048
  const hopSize = Math.floor(fftSize / 2)
  const numFrames = Math.floor((channelData.length - fftSize) / hopSize)
  if (numFrames < 1) return 5

  const frameRms: number[] = []
  for (let f = 0; f < numFrames; f++) {
    const offset = f * hopSize
    let sumSq = 0
    for (let i = 0; i < fftSize; i++) {
      const s = channelData[offset + i] || 0
      sumSq += s * s
    }
    frameRms.push(Math.sqrt(sumSq / fftSize))
  }
  frameRms.sort((a, b) => b - a)
  const top10Count = Math.max(1, Math.floor(numFrames * 0.1))
  let peakRms = 0
  for (let i = 0; i < top10Count; i++) peakRms += frameRms[i]
  peakRms /= top10Count

  const rmsScore = peakRms > 0 ? Math.min(1, rms / peakRms) : 0
  const fullnessScore = Math.min(1, rolloff / (sampleRate / 2))
  const bpmScore = Math.max(0, Math.min(1, (bpm - 60) / 140))

  const raw = 0.4 * rmsScore + 0.3 * fullnessScore + 0.3 * bpmScore
  return Math.max(1, Math.min(10, Math.round(raw * 9 + 1)))
}

/**
 * Detect intro end and outro start positions in an audio track.
 */
export function detectIntroOutro(audioBuffer: AudioBuffer): { introTime: number; outroTime: number } {
  const channelData = audioBuffer.getChannelData(0)
  const sampleRate = audioBuffer.sampleRate
  const frameSamples = Math.floor(sampleRate * 0.05) // 50ms frames
  const numFrames = Math.floor(channelData.length / frameSamples)

  if (numFrames < 2) return { introTime: 0, outroTime: audioBuffer.duration }

  // Compute RMS per frame
  const frameRms = new Float32Array(numFrames)
  let peakRms = 0
  for (let f = 0; f < numFrames; f++) {
    let sumSq = 0
    const offset = f * frameSamples
    for (let i = 0; i < frameSamples; i++) {
      const s = channelData[offset + i] || 0
      sumSq += s * s
    }
    frameRms[f] = Math.sqrt(sumSq / frameSamples)
    if (frameRms[f] > peakRms) peakRms = frameRms[f]
  }

  const threshold = peakRms * 0.03 // 3% of peak

  // Scan from front: first frame above threshold = intro end
  let introFrame = 0
  for (let f = 0; f < numFrames; f++) {
    if (frameRms[f] > threshold) {
      introFrame = f
      break
    }
  }

  // Scan from back: last frame above threshold = outro start
  let outroFrame = numFrames - 1
  for (let f = numFrames - 1; f >= 0; f--) {
    if (frameRms[f] > threshold) {
      outroFrame = f
      break
    }
  }

  return {
    introTime: (introFrame * frameSamples) / sampleRate,
    outroTime: (outroFrame * frameSamples) / sampleRate,
  }
}

/**
 * Auto-tag a track based on spectral features, BPM, and energy.
 */
export function autoTag(
  features: { centroid: number; rolloff: number; zcr: number; rms: number },
  bpm: number,
  energy: number,
  musicalKey?: string,
): string[] {
  const tags: string[] = []

  if (energy >= 7) tags.push('AI: Energetic')
  if (energy <= 3 && bpm < 110) tags.push('AI: Chill')
  if (features.centroid < 1500 && features.rolloff < 3000) tags.push('AI: Dark')
  if (features.centroid > 4000) tags.push('AI: Bright')
  if (features.centroid >= 1500 && features.centroid <= 4000 && features.zcr > 0.05) tags.push('AI: Vocal')
  // Instrumental: only when truly no singing — very strict thresholds
  if (features.zcr < 0.02 && features.centroid < 2000) tags.push('AI: Instrumental')
  if (features.rolloff < 4000 && features.rms < 0.1) tags.push('AI: Acoustic')
  if (features.centroid > 3000 && bpm >= 120) tags.push('AI: Electronic')
  if (musicalKey?.endsWith('A') && energy <= 4 && bpm < 120 && features.centroid < 3000) tags.push('AI: Melancholic')

  return tags
}

/**
 * Detect mood from spectral features, BPM, energy, and musical key.
 * Returns one of 8 moods: Fröhlich, Melancholisch, Aggressiv, Entspannt,
 * Episch, Mysteriös, Romantisch, Düster.
 */
export function detectMood(
  features: { centroid: number; rolloff: number; zcr: number; rms: number },
  bpm: number,
  energy: number,
  musicalKey?: string,
): string {
  const isMinor = musicalKey?.endsWith('A') ?? false
  const isMajor = musicalKey?.endsWith('B') ?? false

  // Normalize features to 0-1 ranges for scoring
  const centroidNorm = Math.min(1, features.centroid / 8000)
  const rolloffNorm = Math.min(1, features.rolloff / 12000)
  const zcrNorm = Math.min(1, features.zcr / 0.15)
  const rmsNorm = Math.min(1, features.rms / 0.3)
  const bpmNorm = Math.max(0, Math.min(1, (bpm - 60) / 140))
  const energyNorm = (energy - 1) / 9

  const scores: Record<string, number> = {
    'Fröhlich': 0,
    'Melancholisch': 0,
    'Aggressiv': 0,
    'Entspannt': 0,
    'Episch': 0,
    'Mysteriös': 0,
    'Romantisch': 0,
    'Düster': 0,
  }

  // Fröhlich: Major + high energy + high BPM + bright centroid
  scores['Fröhlich'] =
    (isMajor ? 0.3 : 0) +
    energyNorm * 0.25 +
    bpmNorm * 0.2 +
    centroidNorm * 0.15 +
    (1 - zcrNorm) * 0.1

  // Melancholisch: Minor + low energy + low BPM + dark centroid
  scores['Melancholisch'] =
    (isMinor ? 0.3 : 0) +
    (1 - energyNorm) * 0.25 +
    (1 - bpmNorm) * 0.2 +
    (1 - centroidNorm) * 0.15 +
    (1 - rmsNorm) * 0.1

  // Aggressiv: Very high energy + high BPM + high ZCR + high RMS
  scores['Aggressiv'] =
    energyNorm * 0.3 +
    bpmNorm * 0.25 +
    zcrNorm * 0.2 +
    rmsNorm * 0.25

  // Entspannt: Low energy + low BPM + low ZCR
  scores['Entspannt'] =
    (1 - energyNorm) * 0.35 +
    (1 - bpmNorm) * 0.3 +
    (1 - zcrNorm) * 0.2 +
    (1 - rmsNorm) * 0.15

  // Episch: High energy + high RMS + high rolloff
  scores['Episch'] =
    energyNorm * 0.3 +
    rmsNorm * 0.25 +
    rolloffNorm * 0.25 +
    bpmNorm * 0.2

  // Mysteriös: Minor + low centroid + medium energy
  const midEnergy = 1 - Math.abs(energyNorm - 0.5) * 2
  scores['Mysteriös'] =
    (isMinor ? 0.3 : 0) +
    (1 - centroidNorm) * 0.25 +
    midEnergy * 0.25 +
    (1 - rolloffNorm) * 0.2

  // Romantisch: Major + low BPM + medium energy + low ZCR
  scores['Romantisch'] =
    (isMajor ? 0.25 : 0) +
    (1 - bpmNorm) * 0.25 +
    midEnergy * 0.2 +
    (1 - zcrNorm) * 0.2 +
    (1 - rmsNorm) * 0.1

  // Düster: Minor + very low centroid + low rolloff + low energy
  scores['Düster'] =
    (isMinor ? 0.25 : 0) +
    (1 - centroidNorm) * 0.25 +
    (1 - rolloffNorm) * 0.2 +
    (1 - energyNorm) * 0.2 +
    (1 - rmsNorm) * 0.1

  // Pick the highest scoring mood
  let bestMood = 'Entspannt'
  let bestScore = -Infinity
  for (const [mood, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score
      bestMood = mood
    }
  }

  return bestMood
}

/**
 * Get harmonically compatible Camelot keys (same, ±1 number, parallel A↔B).
 */
export function getCamelotCompatible(camelotKey: string): string[] {
  const match = camelotKey.match(/^(\d{1,2})([AB])$/)
  if (!match) return []

  const num = parseInt(match[1], 10)
  const letter = match[2]

  const results: string[] = [camelotKey]

  // ±1 on the wheel (wraps 1-12)
  const prev = num === 1 ? 12 : num - 1
  const next = num === 12 ? 1 : num + 1
  results.push(`${prev}${letter}`)
  results.push(`${next}${letter}`)

  // Parallel key (A↔B, same number)
  const parallel = letter === 'A' ? 'B' : 'A'
  results.push(`${num}${parallel}`)

  return results
}

/**
 * Cosine similarity between two feature vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom > 0 ? dot / denom : 0
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
  // Chroma = midiNote mod 12, where C = 0 — safe modulo for negative values
  return ((Math.round(midiNote) % 12) + 12) % 12
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
