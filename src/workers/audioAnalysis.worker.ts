import { detectBPM, detectKey, detectDrops, computeSpectralFeatures, detectEnergy, detectIntroOutro, autoTag } from '../utils/audioAnalysis'
import type { CuePoint } from '../types'

export interface AnalysisRequest {
  channelData: Float32Array
  sampleRate: number
  duration: number
}

export interface AnalysisResult {
  bpm: number
  key: string
  energy: number
  featureVector: number[]
  features: { centroid: number; rolloff: number; zcr: number; rms: number }
  drops: CuePoint[]
  introTime: number
  outroTime: number
  aiTags: string[]
}

/**
 * Minimal AudioBuffer shim so analysis functions work unchanged in a Worker context.
 * Only implements getChannelData(0), sampleRate, duration, and length.
 */
class AudioBufferShim {
  private _channelData: Float32Array
  readonly sampleRate: number
  readonly duration: number
  readonly numberOfChannels = 1
  readonly length: number

  constructor(channelData: Float32Array, sampleRate: number, duration: number) {
    this._channelData = channelData
    this.sampleRate = sampleRate
    this.duration = duration
    this.length = channelData.length
  }

  getChannelData(_channel: number): Float32Array {
    return this._channelData
  }

  copyFromChannel() { /* stub */ }
  copyToChannel() { /* stub */ }
}

self.onmessage = (e: MessageEvent<AnalysisRequest>) => {
  try {
    const { channelData, sampleRate, duration } = e.data
    const audioBuffer = new AudioBufferShim(channelData, sampleRate, duration) as unknown as AudioBuffer

    const bpm = detectBPM(audioBuffer)
    const key = detectKey(audioBuffer)
    const drops = detectDrops(audioBuffer)
    const features = computeSpectralFeatures(audioBuffer)
    const energy = detectEnergy(audioBuffer, bpm, features.rms, features.rolloff)
    const { introTime, outroTime } = detectIntroOutro(audioBuffer)
    const aiTags = autoTag(features, bpm, energy, key)

    const featureVector = [
      features.centroid, features.rolloff, features.zcr, features.rms, bpm,
      ...features.chromaVector,
    ]

    const result: AnalysisResult = {
      bpm,
      key,
      energy,
      featureVector,
      features,
      drops,
      introTime,
      outroTime,
      aiTags,
    }

    self.postMessage(result)
  } catch (err) {
    // Report error back so the main thread's onerror fires
    throw err
  }
}
