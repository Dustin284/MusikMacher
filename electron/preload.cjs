const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Existing
  startDrag: (trackId, fileName) => ipcRenderer.send('start-drag', trackId, fileName),
  prepareDrag: (fileName, fileData) => ipcRenderer.invoke('prepare-drag', fileName, fileData),
  saveFile: (fileName, fileData) => ipcRenderer.invoke('save-file', fileName, fileData),
  isElectron: true,

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

  // GitHub releases check
  checkGithubUpdate: (repo) => ipcRenderer.invoke('check-github-update', repo),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
})
