// --- Cue Points ---
export interface CuePoint {
  id: number        // 1-9 (keyboard slot) or 100+ (auto-detected)
  position: number  // seconds
  label: string
  color: string     // hex color
  source?: 'manual' | 'auto-drop' | 'auto-build'
}

// --- Waveform Notes ---
export interface WaveformNote {
  id: string
  time: number      // seconds
  text: string
}

// --- Premiere Usage ---
export interface PremiereUsage {
  projectName: string
  clipName: string
  inTime: number
  outTime: number
  loadedAt: string
}

// --- Import Locations ---
export interface ImportLocation {
  id?: number
  path: string
  category: number
  subfoldersTag: boolean
  lastSyncAt?: string
  watchEnabled?: boolean
}

// --- Libraries ---
export interface Library {
  id?: number
  name: string
  icon?: string
  order: number
  isOpen: boolean
}

// --- Projects ---
export interface Project {
  id?: number
  name: string
  customerName?: string
  order: number
}

// --- Tracks ---
export interface Track {
  id?: number
  name: string
  path: string
  length: number // duration in seconds
  createdAt: string
  comment: string
  isHidden: boolean
  category: number // library ID (migrated from 'tracks' | 'effects')
  artworkBlob?: Blob
  artworkUrl?: string // runtime-only, regenerated from artworkBlob
  tagIds: number[]
  waveformData?: number[] // cached peak data
  cuePoints?: CuePoint[]
  bpm?: number
  musicalKey?: string
  lyrics?: string
  lrcLyrics?: string
  premiereUsage?: PremiereUsage[]
  rating?: number // 0-5 star rating
  playCount?: number
  lastPlayedAt?: string
  isFavorite?: boolean
  notes?: WaveformNote[]
  projectId?: number
}

// --- Smart Tags ---
export interface SmartTag {
  id?: number
  name: string
  category: number
  rules: SmartTagRule[]
  match: 'all' | 'any' // AND / OR
}

export interface SmartTagRule {
  field: 'bpm' | 'musicalKey' | 'rating' | 'name' | 'comment' | 'duration' | 'tags' | 'playCount' | 'isFavorite' | 'lastPlayedAt'
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'between' | 'isEmpty' | 'isNotEmpty' | 'daysAgo'
  value: string
  value2?: string // for 'between'
}

// --- Queue ---
export interface QueueItem {
  trackId: number
  track: Track
}

export interface AudioFile {
  trackId: number
  blob: Blob
}

export interface Tag {
  id?: number
  name: string
  isChecked: boolean
  isHidden: boolean
  isFavorite: boolean
  category: number // library ID (migrated from 'tracks' | 'effects')
}

export interface Clip {
  id: string
  name: string
  filename: string
  inTime: number
  outTime: number
  time: number
  trackIndex: number
  include: boolean
  artwork?: string
}

export interface BrowseSettings {
  searchTerm: string
  volume: number
  sortField: keyof Track
  sortDirection: 'asc' | 'desc'
}

export interface KeyboardShortcut {
  action: string
  key: string // e.g. 'Space', 'ArrowRight', 'Ctrl+Shift+A'
}

export interface AppSettings {
  windowTitle: string
  language: 'de-DE' | 'en-US'
  skipPosition: number
  skipPositionMovement: number
  playEffectsFromBeginning: boolean
  continuePlayback: boolean
  loadCovers: boolean
  andTagCombination: boolean
  importPath: string
  importSubfolders: boolean
  premiereFilePath: string
  theme: 'light' | 'dark' | 'system'
  lyricsProvider: 'lyrics.ovh' | 'genius' | 'lrclib'
  trackBrowseSettings: BrowseSettings
  effectBrowseSettings: BrowseSettings

  // Playback
  crossfadeDuration: number // seconds (0 = off)
  playbackSpeed: number // 0.5 - 2.0

  // Keyboard shortcuts
  customShortcuts: KeyboardShortcut[]

  // Display
  visibleColumns: string[] // which columns to show in TrackGrid

  // AcoustID
  acoustidApiKey?: string
}

export const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  { action: 'playPause', key: 'Space' },
  { action: 'skipForward', key: 'ArrowRight' },
  { action: 'skipBackward', key: 'ArrowLeft' },
  { action: 'cue1', key: '1' },
  { action: 'cue2', key: '2' },
  { action: 'cue3', key: '3' },
  { action: 'cue4', key: '4' },
  { action: 'cue5', key: '5' },
  { action: 'cue6', key: '6' },
  { action: 'cue7', key: '7' },
  { action: 'cue8', key: '8' },
  { action: 'cue9', key: '9' },
  { action: 'volumeUp', key: 'ArrowUp' },
  { action: 'volumeDown', key: 'ArrowDown' },
  { action: 'toggleQueue', key: 'Q' },
  { action: 'toggleLyrics', key: 'L' },
  { action: 'search', key: 'Ctrl+F' },
  { action: 'speedUp', key: 'Ctrl+ArrowUp' },
  { action: 'speedDown', key: 'Ctrl+ArrowDown' },
  { action: 'speedReset', key: 'Ctrl+0' },
  { action: 'abLoopSet', key: 'B' },
  { action: 'toggleEq', key: 'E' },
  { action: 'pitchUp', key: 'Shift+ArrowUp' },
  { action: 'pitchDown', key: 'Shift+ArrowDown' },
  { action: 'pitchReset', key: 'Shift+0' },
  { action: 'playRandom', key: 'R' },
  { action: 'toggleFavorite', key: 'F' },
  { action: 'undo', key: 'Ctrl+Z' },
  { action: 'redo', key: 'Ctrl+Shift+Z' },
]

export const DEFAULT_VISIBLE_COLUMNS = ['name', 'duration', 'bpm', 'key', 'rating', 'tags', 'comment']

export const DEFAULT_SETTINGS: AppSettings = {
  windowTitle: 'Lorus Musik Macher',
  language: 'de-DE',
  skipPosition: 0.3,
  skipPositionMovement: 0.1,
  playEffectsFromBeginning: false,
  continuePlayback: false,
  loadCovers: true,
  andTagCombination: false,
  importPath: '',
  importSubfolders: true,
  premiereFilePath: '',
  theme: 'dark',
  lyricsProvider: 'lyrics.ovh',
  trackBrowseSettings: {
    searchTerm: '',
    volume: 0.5,
    sortField: 'name',
    sortDirection: 'asc',
  },
  effectBrowseSettings: {
    searchTerm: '',
    volume: 0.5,
    sortField: 'name',
    sortDirection: 'asc',
  },
  crossfadeDuration: 0,
  playbackSpeed: 1.0,
  customShortcuts: [],
  visibleColumns: DEFAULT_VISIBLE_COLUMNS,
}

// Category mapping for backwards compatibility
export const CATEGORY_TRACKS = 1
export const CATEGORY_EFFECTS = 2

export function categoryToId(cat: string): number {
  if (cat === 'effects') return CATEGORY_EFFECTS
  return CATEGORY_TRACKS
}

export function categoryToString(id: number): string {
  if (id === CATEGORY_EFFECTS) return 'effects'
  return 'tracks'
}
