const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Existing
  startDrag: (trackId, fileName) => ipcRenderer.send('start-drag', trackId, fileName),
  prepareDrag: (trackId, fileName) => ipcRenderer.invoke('prepare-drag', trackId, fileName),
  saveFile: (fileName, fileData) => ipcRenderer.invoke('save-file', fileName, fileData),
  isElectron: true,

  // Native drag cleanup
  onNativeDragEnded: (cb) => {
    ipcRenderer.removeAllListeners('native-drag-ended')
    ipcRenderer.on('native-drag-ended', () => cb())
  },

  // Download (YouTube / SoundCloud)
  downloadAudio: (url) => ipcRenderer.invoke('download-audio', url),
  checkYtdlp: () => ipcRenderer.invoke('check-ytdlp'),
  installYtdlp: () => ipcRenderer.invoke('install-ytdlp'),
  onDownloadProgress: (cb) => {
    ipcRenderer.removeAllListeners('download-progress')
    ipcRenderer.on('download-progress', (_event, data) => cb(data))
  },

  // Download (Spotify)
  downloadSpotify: (url) => ipcRenderer.invoke('download-spotify', url),
  checkSpotdl: () => ipcRenderer.invoke('check-spotdl'),
  installSpotdl: () => ipcRenderer.invoke('install-spotdl'),

  // Audio disk cache
  cacheAudioFromPath: (filePath, trackId) => ipcRenderer.invoke('cache-audio-from-path', filePath, trackId),
  cacheAudio: (trackId, audioData) => ipcRenderer.invoke('cache-audio', trackId, audioData),
  getCachedAudio: (trackId) => ipcRenderer.invoke('get-cached-audio', trackId),
  deleteCachedAudio: (trackId) => ipcRenderer.invoke('delete-cached-audio', trackId),
  isAudioCached: (trackId) => ipcRenderer.invoke('is-audio-cached', trackId),

  // Waveform disk cache
  cacheWaveform: (trackId, peaks) => ipcRenderer.invoke('cache-waveform', trackId, peaks),
  getCachedWaveform: (trackId) => ipcRenderer.invoke('get-cached-waveform', trackId),

  // File scanning
  scanDirectory: (dirPath) => ipcRenderer.invoke('scan-directory', dirPath),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),

  // Lyrics (Genius scraping via main process)
  fetchGeniusLyrics: (query) => ipcRenderer.invoke('fetch-genius-lyrics', query),
  fetchGeniusLyricsUrl: (url) => ipcRenderer.invoke('fetch-genius-lyrics-url', url),

  // Logging
  writeLog: (level, message, data) => ipcRenderer.send('write-log', level, message, data),

  // Auto updates
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', () => cb()),
  installUpdate: () => ipcRenderer.send('install-update'),

  // Clipboard URL detection
  onClipboardUrl: (cb) => {
    ipcRenderer.removeAllListeners('clipboard-url')
    ipcRenderer.on('clipboard-url', (_event, data) => cb(data))
  },

  // GitHub releases check
  checkGithubUpdate: (repo) => ipcRenderer.invoke('check-github-update', repo),
  downloadAndInstallUpdate: (assetUrl) => ipcRenderer.invoke('download-and-install-update', assetUrl),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Folder watching
  startWatching: (watchId, dirPath) => ipcRenderer.invoke('start-watching', watchId, dirPath),
  stopWatching: (watchId) => ipcRenderer.invoke('stop-watching', watchId),
  onFileDetected: (cb) => {
    ipcRenderer.removeAllListeners('file-detected')
    ipcRenderer.on('file-detected', (_event, data) => cb(data))
  },
  // Audio fingerprinting (AcoustID)
  installFpcalc: () => ipcRenderer.invoke('install-fpcalc'),
  generateFingerprint: (trackId) => ipcRenderer.invoke('generate-fingerprint', trackId),
  acoustidLookup: (fingerprint, duration, apiKey) => ipcRenderer.invoke('acoustid-lookup', fingerprint, duration, apiKey),
})
