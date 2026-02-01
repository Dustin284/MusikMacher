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
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
