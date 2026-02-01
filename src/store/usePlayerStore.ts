import { create } from 'zustand'
import type { Track, CuePoint, QueueItem } from '../types'
import { getAudioBlob, updateTrack, incrementPlayCount } from '../db/database'
import { useSettingsStore } from './useSettingsStore'
import { detectBPM, detectKey, computeWaveformPeaks } from '../utils/audioAnalysis'

interface ABLoop {
  a: number
  b: number
}

interface PlayerStore {
  currentTrack: Track | null
  isPlaying: boolean
  position: number
  duration: number
  volume: number
  audio: HTMLAudioElement | null
  waveformPeaks: number[]
  audioBlobUrl: string | null
  showLyrics: boolean

  // New features
  playbackSpeed: number
  abLoop: ABLoop | null
  abLoopSetting: 'none' | 'setA' | 'setB'
  queue: QueueItem[]
  showQueue: boolean

  // EQ
  eqBass: number
  eqMid: number
  eqTreble: number
  eqEnabled: boolean

  // Pitch
  pitchSemitones: number

  play: (track: Track) => void
  pause: () => void
  playPause: () => void
  seek: (position: number) => void
  setVolume: (volume: number) => void
  skipForward: (amount: number) => void
  skipBackward: (amount: number) => void
  stop: () => void
  setWaveformPeaks: (peaks: number[]) => void
  toggleLyrics: () => void

  // Playback speed
  setPlaybackSpeed: (speed: number) => void
  speedUp: () => void
  speedDown: () => void
  speedReset: () => void

  // EQ
  setEqBass: (db: number) => void
  setEqMid: (db: number) => void
  setEqTreble: (db: number) => void
  toggleEq: () => void
  resetEq: () => void

  // Pitch
  setPitchSemitones: (semitones: number) => void
  resetPitch: () => void

  // A-B Loop
  toggleABLoop: () => void
  clearABLoop: () => void

  // Queue
  addToQueue: (track: Track) => void
  removeFromQueue: (index: number) => void
  clearQueue: () => void
  playNext: () => void
  toggleQueue: () => void

  // Cue points
  setCuePoint: (slot: number) => void
  jumpToCuePoint: (slot: number) => void
  deleteCuePoint: (slot: number) => void
}

let positionInterval: ReturnType<typeof setInterval> | null = null

// Internal Web Audio API refs (not exposed in store interface)
let _audioContext: AudioContext | null = null
let _sourceNode: MediaElementAudioSourceNode | null = null
let _bassFilter: BiquadFilterNode | null = null
let _midFilter: BiquadFilterNode | null = null
let _trebleFilter: BiquadFilterNode | null = null
let _gainNode: GainNode | null = null

function ensureAudioContext(): AudioContext {
  if (!_audioContext || _audioContext.state === 'closed') {
    _audioContext = new AudioContext()
  }
  if (_audioContext.state === 'suspended') {
    _audioContext.resume()
  }
  return _audioContext
}

function connectAudioGraph(audio: HTMLAudioElement) {
  const ctx = ensureAudioContext()

  // Disconnect old source if exists
  if (_sourceNode) {
    try { _sourceNode.disconnect() } catch { /* already disconnected */ }
    _sourceNode = null
  }

  _sourceNode = ctx.createMediaElementSource(audio)

  // Create filters if not yet created (reuse across tracks)
  if (!_bassFilter) {
    _bassFilter = ctx.createBiquadFilter()
    _bassFilter.type = 'lowshelf'
    _bassFilter.frequency.value = 200
  }
  if (!_midFilter) {
    _midFilter = ctx.createBiquadFilter()
    _midFilter.type = 'peaking'
    _midFilter.frequency.value = 1000
    _midFilter.Q.value = 1.0
  }
  if (!_trebleFilter) {
    _trebleFilter = ctx.createBiquadFilter()
    _trebleFilter.type = 'highshelf'
    _trebleFilter.frequency.value = 4000
  }
  if (!_gainNode) {
    _gainNode = ctx.createGain()
    _gainNode.gain.value = 1.0
  }

  // Disconnect existing filter chain connections before reconnecting
  try { _bassFilter.disconnect() } catch { /* ok */ }
  try { _midFilter.disconnect() } catch { /* ok */ }
  try { _trebleFilter.disconnect() } catch { /* ok */ }
  try { _gainNode.disconnect() } catch { /* ok */ }

  // Connect chain: source → bass → mid → treble → gain → destination
  _sourceNode.connect(_bassFilter)
  _bassFilter.connect(_midFilter)
  _midFilter.connect(_trebleFilter)
  _trebleFilter.connect(_gainNode)
  _gainNode.connect(ctx.destination)

  // Apply current EQ values
  const state = usePlayerStore.getState()
  if (state.eqEnabled) {
    _bassFilter.gain.value = state.eqBass
    _midFilter.gain.value = state.eqMid
    _trebleFilter.gain.value = state.eqTreble
  } else {
    _bassFilter.gain.value = 0
    _midFilter.gain.value = 0
    _trebleFilter.gain.value = 0
  }
}

function applyPlaybackRate(audio: HTMLAudioElement, speed: number, semitones: number) {
  audio.playbackRate = speed * Math.pow(2, semitones / 12)
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  volume: 0.5,
  audio: null,
  waveformPeaks: [],
  audioBlobUrl: null,
  showLyrics: false,
  playbackSpeed: 1.0,
  abLoop: null,
  abLoopSetting: 'none',
  queue: [],
  showQueue: false,
  eqBass: 0,
  eqMid: 0,
  eqTreble: 0,
  eqEnabled: true,
  pitchSemitones: 0,

  play: (track) => {
    const { audio: existingAudio, currentTrack, audioBlobUrl } = get()

    if (currentTrack?.id === track.id && existingAudio) {
      existingAudio.play()
      set({ isPlaying: true })
      startPositionUpdate()
      return
    }

    const crossfadeDuration = useSettingsStore.getState().settings.crossfadeDuration

    if (existingAudio) {
      if (crossfadeDuration > 0) {
        // Crossfade: gradually fade out old audio
        fadeOutAndCleanup(existingAudio, crossfadeDuration, audioBlobUrl)
      } else {
        existingAudio.pause()
        existingAudio.src = ''
        if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl)
      }
      stopPositionUpdate()
    } else if (audioBlobUrl) {
      URL.revokeObjectURL(audioBlobUrl)
    }

    // Clear A-B loop on track change
    const trackId = track.id!
    const cachedPeaks = track.waveformData && track.waveformData.length > 0 ? track.waveformData : []
    set({ currentTrack: track, isPlaying: false, position: 0, waveformPeaks: cachedPeaks, audioBlobUrl: null, abLoop: null, abLoopSetting: 'none' })

    loadAndPlayTrack(trackId, track)
  },

  pause: () => {
    const { audio } = get()
    if (audio) {
      audio.pause()
      set({ isPlaying: false })
      stopPositionUpdate()
    }
  },

  playPause: () => {
    const { isPlaying, audio, currentTrack } = get()
    if (!currentTrack || !audio) return
    if (isPlaying) {
      get().pause()
    } else {
      audio.play()
      set({ isPlaying: true })
      startPositionUpdate()
    }
  },

  seek: (position) => {
    const { audio } = get()
    if (audio) {
      audio.currentTime = position
      set({ position })
    }
  },

  setVolume: (volume) => {
    const { audio } = get()
    if (audio) audio.volume = volume
    set({ volume })
  },

  skipForward: (amount) => {
    const { audio, duration } = get()
    if (audio) {
      const newTime = Math.min(audio.currentTime + duration * amount, duration)
      audio.currentTime = newTime
      set({ position: newTime })
    }
  },

  skipBackward: (amount) => {
    const { audio, duration } = get()
    if (audio) {
      const newTime = Math.max(audio.currentTime - duration * amount, 0)
      audio.currentTime = newTime
      set({ position: newTime })
    }
  },

  stop: () => {
    const { audio, audioBlobUrl } = get()
    if (audio) {
      audio.pause()
      audio.src = ''
    }
    if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl)
    stopPositionUpdate()
    set({ currentTrack: null, isPlaying: false, position: 0, duration: 0, audio: null, waveformPeaks: [], audioBlobUrl: null })
  },

  setWaveformPeaks: (peaks) => set({ waveformPeaks: peaks }),

  toggleLyrics: () => set(s => ({ showLyrics: !s.showLyrics })),

  setCuePoint: (slot) => {
    const { currentTrack, audio } = get()
    if (!currentTrack?.id || !audio) return

    const position = audio.currentTime
    const existing = currentTrack.cuePoints || []
    const filtered = existing.filter(c => c.id !== slot)

    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e']
    const newCue: CuePoint = {
      id: slot,
      position,
      label: `Cue ${slot}`,
      color: colors[(slot - 1) % colors.length],
      source: 'manual',
    }

    const cuePoints = [...filtered, newCue].sort((a, b) => a.position - b.position)
    const updatedTrack = { ...currentTrack, cuePoints }
    set({ currentTrack: updatedTrack })
    updateTrack(currentTrack.id, { cuePoints })
  },

  jumpToCuePoint: (slot) => {
    const { currentTrack, audio } = get()
    if (!currentTrack?.cuePoints || !audio) return

    const cue = currentTrack.cuePoints.find(c => c.id === slot)
    if (cue) {
      audio.currentTime = cue.position
      set({ position: cue.position })
    }
  },

  deleteCuePoint: (slot) => {
    const { currentTrack } = get()
    if (!currentTrack?.id || !currentTrack.cuePoints) return

    const cuePoints = currentTrack.cuePoints.filter(c => c.id !== slot)
    const updatedTrack = { ...currentTrack, cuePoints }
    set({ currentTrack: updatedTrack })
    updateTrack(currentTrack.id, { cuePoints })
  },

  // Playback speed
  setPlaybackSpeed: (speed) => {
    const { audio, pitchSemitones } = get()
    const clamped = Math.max(0.25, Math.min(3.0, speed))
    if (audio) applyPlaybackRate(audio, clamped, pitchSemitones)
    set({ playbackSpeed: clamped })
  },

  speedUp: () => {
    const { playbackSpeed } = get()
    get().setPlaybackSpeed(Math.round((playbackSpeed + 0.1) * 10) / 10)
  },

  speedDown: () => {
    const { playbackSpeed } = get()
    get().setPlaybackSpeed(Math.round((playbackSpeed - 0.1) * 10) / 10)
  },

  speedReset: () => {
    get().setPlaybackSpeed(1.0)
  },

  // EQ
  setEqBass: (db) => {
    const clamped = Math.max(-12, Math.min(12, db))
    if (_bassFilter && get().eqEnabled) _bassFilter.gain.value = clamped
    set({ eqBass: clamped })
  },

  setEqMid: (db) => {
    const clamped = Math.max(-12, Math.min(12, db))
    if (_midFilter && get().eqEnabled) _midFilter.gain.value = clamped
    set({ eqMid: clamped })
  },

  setEqTreble: (db) => {
    const clamped = Math.max(-12, Math.min(12, db))
    if (_trebleFilter && get().eqEnabled) _trebleFilter.gain.value = clamped
    set({ eqTreble: clamped })
  },

  toggleEq: () => {
    const { eqEnabled, eqBass, eqMid, eqTreble } = get()
    const newEnabled = !eqEnabled
    if (_bassFilter) _bassFilter.gain.value = newEnabled ? eqBass : 0
    if (_midFilter) _midFilter.gain.value = newEnabled ? eqMid : 0
    if (_trebleFilter) _trebleFilter.gain.value = newEnabled ? eqTreble : 0
    set({ eqEnabled: newEnabled })
  },

  resetEq: () => {
    if (_bassFilter) _bassFilter.gain.value = 0
    if (_midFilter) _midFilter.gain.value = 0
    if (_trebleFilter) _trebleFilter.gain.value = 0
    set({ eqBass: 0, eqMid: 0, eqTreble: 0 })
  },

  // Pitch
  setPitchSemitones: (semitones) => {
    const { audio, playbackSpeed } = get()
    const clamped = Math.max(-6, Math.min(6, Math.round(semitones)))
    if (audio) applyPlaybackRate(audio, playbackSpeed, clamped)
    set({ pitchSemitones: clamped })
  },

  resetPitch: () => {
    const { audio, playbackSpeed } = get()
    if (audio) applyPlaybackRate(audio, playbackSpeed, 0)
    set({ pitchSemitones: 0 })
  },

  // A-B Loop
  toggleABLoop: () => {
    const { abLoopSetting, audio, abLoop } = get()
    if (!audio) return

    if (abLoopSetting === 'none') {
      // Set A point
      set({ abLoopSetting: 'setA', abLoop: null })
      set({ abLoop: { a: audio.currentTime, b: 0 } as ABLoop, abLoopSetting: 'setB' })
    } else if (abLoopSetting === 'setB') {
      // Set B point
      const a = abLoop?.a ?? 0
      const b = audio.currentTime
      if (b > a) {
        set({ abLoop: { a, b }, abLoopSetting: 'none' })
      }
    } else {
      // Clear
      set({ abLoop: null, abLoopSetting: 'none' })
    }
  },

  clearABLoop: () => {
    set({ abLoop: null, abLoopSetting: 'none' })
  },

  // Queue
  addToQueue: (track) => {
    set(s => ({ queue: [...s.queue, { trackId: track.id!, track }] }))
  },

  removeFromQueue: (index) => {
    set(s => ({ queue: s.queue.filter((_, i) => i !== index) }))
  },

  clearQueue: () => {
    set({ queue: [] })
  },

  playNext: () => {
    const { queue } = get()
    if (queue.length === 0) return
    const next = queue[0]
    set({ queue: queue.slice(1) })
    get().play(next.track)
  },

  toggleQueue: () => set(s => ({ showQueue: !s.showQueue })),
}))

function fadeOutAndCleanup(audio: HTMLAudioElement, duration: number, blobUrl: string | null) {
  const startVolume = audio.volume
  const steps = 20
  const interval = (duration * 1000) / steps
  let step = 0
  const timer = setInterval(() => {
    step++
    audio.volume = Math.max(0, startVolume * (1 - step / steps))
    if (step >= steps) {
      clearInterval(timer)
      audio.pause()
      audio.src = ''
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, interval)
}

async function loadAndPlayTrack(trackId: number, track: Track) {
  let blobUrl: string
  let needsRevoke = false

  // Fast path in Electron: check if audio file exists on disk (tiny boolean IPC)
  // If cached, use media-cache:// protocol — Audio element streams directly from disk,
  // no multi-MB buffer serialization over IPC
  const diskCached = window.electronAPI?.isAudioCached
    ? await window.electronAPI.isAudioCached(trackId)
    : false

  if (usePlayerStore.getState().currentTrack?.id !== trackId) return

  if (diskCached) {
    blobUrl = `media-cache://audio/${trackId}`
  } else {
    // Fallback: read blob from IndexedDB (browser or uncached tracks)
    const blob = await getAudioBlob(trackId)
    if (usePlayerStore.getState().currentTrack?.id !== trackId) return

    if (blob) {
      blobUrl = URL.createObjectURL(blob)
      needsRevoke = true
    } else if (track.path) {
      blobUrl = track.path
    } else {
      return
    }
  }

  const audio = new Audio(blobUrl)
  audio.crossOrigin = 'anonymous'
  audio.volume = usePlayerStore.getState().volume
  const { playbackSpeed, pitchSemitones } = usePlayerStore.getState()
  applyPlaybackRate(audio, playbackSpeed, pitchSemitones)

  const settings = useSettingsStore.getState().settings

  audio.onloadedmetadata = () => {
    if (usePlayerStore.getState().currentTrack?.id !== trackId) return

    const dur = audio.duration
    const isEffect = track.category === 2
    const shouldStartFromBeginning = isEffect && settings.playEffectsFromBeginning
    const startPos = shouldStartFromBeginning ? 0 : settings.skipPosition * dur

    audio.currentTime = startPos
    usePlayerStore.setState({ duration: dur, position: startPos })

    // Play AFTER seeking to start position
    audio.play()
    usePlayerStore.setState({ isPlaying: true })
    startPositionUpdate()

    // Increment play count
    incrementPlayCount(trackId).catch(() => {})
  }

  audio.onended = () => {
    usePlayerStore.setState({ isPlaying: false, position: 0 })
    stopPositionUpdate()
    // Auto-play next from queue
    const { queue } = usePlayerStore.getState()
    if (queue.length > 0) {
      setTimeout(() => usePlayerStore.getState().playNext(), 100)
    }
  }

  audio.onerror = () => {
    usePlayerStore.setState({ isPlaying: false })
    stopPositionUpdate()
  }

  usePlayerStore.setState({ audio, isPlaying: false, audioBlobUrl: needsRevoke ? blobUrl : null })

  // Connect Web Audio graph for EQ + pitch processing
  try {
    connectAudioGraph(audio)
  } catch { /* audio graph connection failed, playback still works */ }

  // Analyze if waveform, BPM or key is missing
  const needsWaveform = !track.waveformData || track.waveformData.length === 0
  const needsBpm = !track.bpm
  const needsKey = !track.musicalKey

  if (needsWaveform || needsBpm || needsKey) {
    try {
      const analysisBlob = await fetch(blobUrl).then(r => r.blob())
      const arrayBuffer = await analysisBlob.arrayBuffer()
      const audioContext = new AudioContext()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      audioContext.close()

      const changes: Partial<Track> = {}
      if (needsWaveform) {
        changes.waveformData = computeWaveformPeaks(audioBuffer)
      }
      if (needsBpm) {
        changes.bpm = detectBPM(audioBuffer)
      }
      if (needsKey) {
        changes.musicalKey = detectKey(audioBuffer)
      }

      const ct = usePlayerStore.getState().currentTrack
      if (ct && ct.id === trackId) {
        if (changes.waveformData) {
          usePlayerStore.setState({ waveformPeaks: changes.waveformData })
        }
        usePlayerStore.setState({ currentTrack: { ...ct, ...changes } })
      }
      updateTrack(trackId, changes).catch(() => {})

      // Cache waveform to disk in AppData
      if (changes.waveformData && window.electronAPI?.cacheWaveform) {
        window.electronAPI.cacheWaveform(trackId, changes.waveformData).catch(() => {})
      }
    } catch { /* analysis failed */ }
  }
}

function startPositionUpdate() {
  stopPositionUpdate()
  positionInterval = setInterval(() => {
    const { audio, isPlaying, abLoop } = usePlayerStore.getState()
    if (audio && isPlaying) {
      // A-B Loop enforcement
      if (abLoop && abLoop.b > 0 && audio.currentTime >= abLoop.b) {
        audio.currentTime = abLoop.a
      }
      usePlayerStore.setState({ position: audio.currentTime })
    }
  }, 50)
}

function stopPositionUpdate() {
  if (positionInterval) {
    clearInterval(positionInterval)
    positionInterval = null
  }
}

