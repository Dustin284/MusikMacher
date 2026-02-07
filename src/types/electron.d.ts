export interface ElectronAPI {
  startDrag: (trackId: number, fileName: string) => void
  prepareDrag?: (trackId: number, fileName: string) => Promise<boolean>
  onNativeDragEnded?: (cb: () => void) => void
  saveFile: (fileName: string, fileData: ArrayBuffer) => Promise<{ success: boolean; path?: string }>
  isElectron: boolean

  // Download (YouTube / SoundCloud)
  downloadAudio?: (url: string) => Promise<{
    success: boolean
    filePath?: string
    fileName?: string
    fileData?: ArrayBuffer
    error?: string
  }>
  checkYtdlp?: () => Promise<boolean>
  installYtdlp?: () => Promise<boolean>
  onDownloadProgress?: (cb: (data: { percent: number; phase: string }) => void) => void

  // Download (Spotify)
  downloadSpotify?: (url: string) => Promise<{
    success: boolean
    filePath?: string
    fileName?: string
    fileData?: ArrayBuffer
    error?: string
  }>
  checkSpotdl?: () => Promise<boolean>
  installSpotdl?: () => Promise<boolean>

  // Search
  searchAudio?: (query: string, platform: 'youtube' | 'soundcloud' | 'both', count?: number) => Promise<{
    success: boolean
    results?: import('./index').SearchResult[]
    error?: string
  }>

  // Audio disk cache
  cacheAudioFromPath?: (filePath: string, trackId: number) => Promise<boolean>
  cacheAudio?: (trackId: number, audioData: ArrayBuffer) => Promise<boolean>
  getCachedAudio?: (trackId: number) => Promise<ArrayBuffer | null>
  deleteCachedAudio?: (trackId: number) => Promise<boolean>
  isAudioCached?: (trackId: number) => Promise<boolean>

  // Waveform disk cache
  cacheWaveform?: (trackId: number, peaks: number[]) => Promise<boolean>
  getCachedWaveform?: (trackId: number) => Promise<number[] | null>

  // File scanning
  scanDirectory?: (dirPath: string) => Promise<string[]>
  readFile?: (filePath: string) => Promise<ArrayBuffer>
  selectDirectory?: () => Promise<string | null>

  // Lyrics
  fetchGeniusLyrics?: (query: string) => Promise<{ lyrics: string | null; title?: string; error?: string; debug?: string }>
  fetchGeniusLyricsUrl?: (url: string) => Promise<{ lyrics: string | null; error?: string }>

  // Logging
  writeLog?: (level: string, message: string, data?: string) => void

  // Clipboard URL detection
  onClipboardUrl?: (cb: (data: { url: string; platform: string }) => void) => void

  // Auto updates
  onUpdateAvailable?: (cb: () => void) => void
  installUpdate?: () => void

  // GitHub releases check
  checkGithubUpdate?: (repo: string) => Promise<{
    hasUpdate: boolean
    latestVersion?: string
    currentVersion?: string
    downloadUrl?: string
    assets?: { name: string; url: string; size: number }[]
    body?: string
    error?: string
  }>
  downloadAndInstallUpdate?: (assetUrl: string) => Promise<{ success: boolean; error?: string }>
  openExternal?: (url: string) => Promise<void>

  // Folder watching
  startWatching?: (watchId: string, dirPath: string) => Promise<boolean>
  stopWatching?: (watchId: string) => Promise<boolean>
  onFileDetected?: (cb: (data: { path: string; name: string; watchId?: string }) => void) => void

  // Audio fingerprinting (AcoustID)
  installFpcalc?: () => Promise<boolean>
  generateFingerprint?: (trackId: number) => Promise<{ fingerprint: string; duration: number } | null>
  acoustidLookup?: (fingerprint: string, duration: number, apiKey: string) => Promise<{ title: string | null; artist: string | null; score: number } | null>

  // Playlist download
  fetchPlaylistInfo?: (url: string) => Promise<{
    success: boolean
    playlist?: import('./index').PlaylistInfo
    error?: string
  }>
  downloadPlaylist?: (url: string) => Promise<{
    success: boolean
    results?: { fileName: string; fileData: ArrayBuffer; filePath: string }[]
    error?: string
  }>
  cancelPlaylistDownload?: () => Promise<void>
  onPlaylistProgress?: (cb: (data: { percent: number; phase: string; current: number; total: number; trackName: string }) => void) => void
  onPlaylistTrackReady?: (cb: (data: { fileName: string; fileData: ArrayBuffer; filePath: string }) => void) => void

  // Global media keys (work in background)
  onMediaKey?: (cb: (key: string) => void) => void

  // OBS / Streaming
  obsStartServer?: (port: number) => Promise<{ success: boolean; error?: string }>
  obsStopServer?: () => Promise<void>
  obsUpdateNowPlaying?: (data: {
    title: string
    artist: string
    bpm?: number | null
    key?: string | null
    cover?: string | null
    duration: number
    position: number
    isPlaying: boolean
  }) => void
  obsUpdateSettings?: (settings: Partial<import('./index').AppSettings>) => void
  obsSelectTextFilePath?: () => Promise<string | null>

  // Stem separation (Demucs)
  checkPython?: () => Promise<boolean>
  checkDemucs?: () => Promise<boolean>
  checkCuda?: () => Promise<{ available: boolean; device?: string | null; reason?: string }>
  installDemucs?: () => Promise<boolean | { success: boolean; error?: string }>
  separateStems?: (trackId: number, model: string) => Promise<{
    success: boolean
    stems?: { type: string; fileName: string; data: ArrayBuffer }[]
    error?: string
  }>
  onDemucsProgress?: (cb: (data: { percent: number; phase: string }) => void) => void
  onSeparationProgress?: (cb: (data: { percent: number; phase: string }) => void) => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
