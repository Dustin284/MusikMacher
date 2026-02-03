const { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu, clipboard } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { pathToFileURL } = require('url')
const { spawn, execSync } = require('child_process')

const isDev = !app.isPackaged

// Register custom protocols BEFORE app.whenReady()
protocol.registerSchemesAsPrivileged([
  // Stream audio directly from disk cache — no IPC buffer transfer
  { scheme: 'media-cache', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
])

let mainWindow = null
const activeWatchers = new Map()

function createWindow() {
  Menu.setApplicationMenu(null)

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 500,
    frame: true,
    backgroundColor: '#09090b',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    show: false,
    titleBarStyle: 'hiddenInset',
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url)
    return { action: 'deny' }
  })
}

// IPC: Native drag-out (for Premiere Pro import)
// Uses persistent directory in AppData so Premiere Pro can always find the files
const dragDir = path.join(app.getPath('userData'), 'drag')

// Step 1: Prepare drag file from disk cache (no IPC data transfer)
ipcMain.handle('prepare-drag', async (_event, trackId, fileName) => {
  try {
    if (!fs.existsSync(dragDir)) fs.mkdirSync(dragDir, { recursive: true })
    const dragPath = path.join(dragDir, fileName)
    if (fs.existsSync(dragPath)) return true
    const cachePath = path.join(audioCacheDir, String(trackId))
    if (fs.existsSync(cachePath)) {
      fs.copyFileSync(cachePath, dragPath)
      return true
    }
    return false
  } catch {
    return false
  }
})

// Step 2: Start native drag on dragstart (sync, file already on disk)
ipcMain.on('start-drag', (event, trackId, fileName) => {
  if (!fs.existsSync(dragDir)) fs.mkdirSync(dragDir, { recursive: true })
  const dragPath = path.join(dragDir, fileName)

  // If file wasn't prepared via mousedown, try disk cache
  if (!fs.existsSync(dragPath)) {
    const cachePath = path.join(audioCacheDir, String(trackId))
    if (fs.existsSync(cachePath)) {
      fs.copyFileSync(cachePath, dragPath)
    }
  }

  if (fs.existsSync(dragPath)) {
    const iconPath = path.join(__dirname, '..', 'build', 'icon.png')
    event.sender.startDrag({
      file: dragPath,
      icon: iconPath,
    })
    // startDrag is synchronous — when it returns, the native drag is done.
    // Send a real Escape keypress through Chromium to cancel the stuck browser drag.
    event.sender.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
    event.sender.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
  }
})

// IPC: Save file to disk via native dialog
ipcMain.handle('save-file', async (_event, fileName, fileData) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: fileName,
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'webm'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })

  if (canceled || !filePath) return { success: false }

  fs.writeFileSync(filePath, Buffer.from(fileData))
  return { success: true, path: filePath }
})

// --- YouTube/SoundCloud Download via yt-dlp ---

function getBinDir() {
  return path.join(app.getPath('userData'), 'bin')
}

function getYtdlpPath() {
  return path.join(getBinDir(), process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
}



function hasFfmpeg() {
  const binDir = getBinDir()
  const ffmpeg = path.join(binDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
  const ffprobe = path.join(binDir, process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe')
  return fs.existsSync(ffmpeg) && fs.existsSync(ffprobe)
}

// Download a file using Electron's net.fetch (handles redirects automatically)
async function downloadToFile(url, destPath) {
  const response = await net.fetch(url)
  if (!response.ok) return false
  const buffer = Buffer.from(await response.arrayBuffer())
  fs.writeFileSync(destPath, buffer)
  return true
}

// Recursively find a file by name in a directory tree
function findFileInDir(dir, name) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const found = findFileInDir(fullPath, name)
      if (found) return found
    } else if (entry.name === name) {
      return fullPath
    }
  }
  return null
}

// Install ffmpeg + ffprobe into bin dir (standalone, can be called from anywhere)
async function ensureFfmpeg() {
  if (hasFfmpeg()) return true

  const binDir = getBinDir()
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true })
  }

  const isWin = process.platform === 'win32'
  const ffmpegUrl = isWin
    ? 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'
    : 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz'

  const tempDir = path.join(app.getPath('temp'), 'ffmpeg-install')
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
  fs.mkdirSync(tempDir, { recursive: true })

  try {
    const archivePath = path.join(tempDir, isWin ? 'ffmpeg.zip' : 'ffmpeg.tar.xz')
    const ok = await downloadToFile(ffmpegUrl, archivePath)
    if (!ok) return false

    // Verify downloaded file is not empty / error page
    const stat = fs.statSync(archivePath)
    if (stat.size < 1000000) return false // ffmpeg zip is always > 1MB

    // Extract archive
    if (isWin) {
      execSync(
        `powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${tempDir}' -Force"`,
        { timeout: 300000 }
      )
    } else {
      execSync(`tar -xf "${archivePath}" -C "${tempDir}"`, { timeout: 300000 })
    }

    // Find and copy ffmpeg + ffprobe
    const ffmpegName = isWin ? 'ffmpeg.exe' : 'ffmpeg'
    const ffprobeName = isWin ? 'ffprobe.exe' : 'ffprobe'

    const ffmpegSrc = findFileInDir(tempDir, ffmpegName)
    const ffprobeSrc = findFileInDir(tempDir, ffprobeName)

    if (ffmpegSrc) fs.copyFileSync(ffmpegSrc, path.join(binDir, ffmpegName))
    if (ffprobeSrc) fs.copyFileSync(ffprobeSrc, path.join(binDir, ffprobeName))

    if (!isWin) {
      const ffmpegDest = path.join(binDir, ffmpegName)
      const ffprobeDest = path.join(binDir, ffprobeName)
      if (fs.existsSync(ffmpegDest)) fs.chmodSync(ffmpegDest, '755')
      if (fs.existsSync(ffprobeDest)) fs.chmodSync(ffprobeDest, '755')
    }
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }) } catch {}
  }

  return hasFfmpeg()
}

ipcMain.handle('check-ytdlp', async () => {
  return fs.existsSync(getYtdlpPath()) && hasFfmpeg()
})

ipcMain.handle('install-ytdlp', async () => {
  try {
    const binDir = getBinDir()
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true })
    }

    // 1. Install yt-dlp
    const ytdlpPath = getYtdlpPath()
    if (!fs.existsSync(ytdlpPath)) {
      const platform = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp_linux'
      const ytdlpUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${platform}`
      const ok = await downloadToFile(ytdlpUrl, ytdlpPath)
      if (!ok) return false
      if (process.platform !== 'win32') {
        fs.chmodSync(ytdlpPath, '755')
      }
    }

    // 2. Install ffmpeg + ffprobe
    await ensureFfmpeg()

    return fs.existsSync(ytdlpPath) && hasFfmpeg()
  } catch {
    return false
  }
})

ipcMain.handle('download-audio', async (event, url) => {
  try {
    const ytdlpPath = getYtdlpPath()
    if (!fs.existsSync(ytdlpPath)) {
      return { success: false, error: 'yt-dlp not installed' }
    }

    // Ensure ffmpeg is available (auto-install if missing)
    if (!hasFfmpeg()) {
      event.sender.send('download-progress', { percent: 0, phase: 'installing' })
      const ok = await ensureFfmpeg()
      if (!ok) {
        return { success: false, error: 'ffmpeg konnte nicht installiert werden. Bitte erneut versuchen.' }
      }
    }

    const downloadDir = path.join(app.getPath('temp'), 'lorus-downloads')
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true })
    }

    const outputTemplate = path.join(downloadDir, '%(title)s.%(ext)s')

    return new Promise((resolve) => {
      const proc = spawn(ytdlpPath, [
        '--ffmpeg-location', getBinDir(),
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--embed-metadata',
        '--embed-thumbnail',
        '--convert-thumbnails', 'jpg',
        '-o', outputTemplate,
        '--newline',
        '--no-check-certificates',
        url,
      ])

      let lastFile = ''
      let stderrOutput = ''

      proc.stdout.on('data', (data) => {
        const lines = data.toString().split('\n')
        for (const line of lines) {
          // Download progress: scale to 0-70%
          const progressMatch = line.match(/\[download\]\s+(\d+\.?\d*)%/)
          if (progressMatch) {
            const raw = parseFloat(progressMatch[1])
            event.sender.send('download-progress', { percent: raw * 0.7, phase: 'downloading' })
          }

          // Post-processing phases
          if (line.includes('[ExtractAudio]')) {
            event.sender.send('download-progress', { percent: 75, phase: 'converting' })
          }
          if (line.includes('[EmbedThumbnail]')) {
            event.sender.send('download-progress', { percent: 85, phase: 'thumbnail' })
          }
          if (line.includes('[Metadata]') || line.includes('[EmbedMetadata]')) {
            event.sender.send('download-progress', { percent: 90, phase: 'metadata' })
          }

          // Track output file
          const destMatch = line.match(/Destination: (.+)/)
          if (destMatch) lastFile = destMatch[1].trim()
          const mergeMatch = line.match(/\[Merger\] Merging formats into "(.+)"/)
          if (mergeMatch) lastFile = mergeMatch[1].trim()
          const extractMatch = line.match(/\[ExtractAudio\] Destination: (.+)/)
          if (extractMatch) lastFile = extractMatch[1].trim()
        }
      })

      proc.stderr.on('data', (data) => {
        stderrOutput += data.toString()
      })

      proc.on('close', (code) => {
        if (code === 0 && lastFile && fs.existsSync(lastFile)) {
          const fileName = path.basename(lastFile)
          const fileBuffer = fs.readFileSync(lastFile)
          event.sender.send('download-progress', { percent: 100, phase: 'done' })
          resolve({
            success: true,
            filePath: lastFile,
            fileName,
            fileData: fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength),
          })
        } else {
          // Try to find any downloaded file
          const files = fs.readdirSync(downloadDir).filter(f => f.endsWith('.mp3'))
          if (files.length > 0) {
            const foundPath = path.join(downloadDir, files[files.length - 1])
            const fileName = files[files.length - 1]
            const fileBuffer = fs.readFileSync(foundPath)
            event.sender.send('download-progress', { percent: 100, phase: 'done' })
            resolve({
              success: true,
              filePath: foundPath,
              fileName,
              fileData: fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength),
            })
          } else {
            const errMsg = stderrOutput.trim().split('\n').pop() || `exit code ${code}`
            resolve({ success: false, error: errMsg })
          }
        }
      })

      proc.on('error', (err) => {
        resolve({ success: false, error: err.message })
      })
    })
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// --- Spotify Download (via Spotify oEmbed + yt-dlp YouTube search) ---

// Resolve Spotify track URL to artist + title using the free oEmbed API
async function resolveSpotifyTrack(spotifyUrl) {
  const cleanUrl = spotifyUrl.replace(/\/intl-[a-z]{2}\//, '/').split('?')[0]
  const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(cleanUrl)}`
  const res = await net.fetch(oembedUrl, { headers: { 'User-Agent': GENIUS_UA } })
  if (!res.ok) return null
  const data = await res.json()
  // data.title contains "Song Name" by "Artist Name" pattern from the embed title
  // The actual title field is the track name, provider_name is always "Spotify"
  // We parse the HTML title which is: "Track by Artist"
  return data.title || null // e.g. "Blinding Lights by The Weeknd"
}

ipcMain.handle('check-spotdl', async () => {
  // Spotify download uses yt-dlp, no separate tool needed
  return fs.existsSync(getYtdlpPath()) && hasFfmpeg()
})

ipcMain.handle('install-spotdl', async () => {
  // Just ensure yt-dlp + ffmpeg are available
  try {
    const binDir = getBinDir()
    if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true })

    const ytdlpPath = getYtdlpPath()
    if (!fs.existsSync(ytdlpPath)) {
      const platform = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp_linux'
      const ytdlpUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${platform}`
      const ok = await downloadToFile(ytdlpUrl, ytdlpPath)
      if (!ok) return false
      if (process.platform !== 'win32') fs.chmodSync(ytdlpPath, '755')
    }

    await ensureFfmpeg()
    return fs.existsSync(ytdlpPath) && hasFfmpeg()
  } catch {
    return false
  }
})

ipcMain.handle('download-spotify', async (event, url) => {
  try {
    const ytdlpPath = getYtdlpPath()
    if (!fs.existsSync(ytdlpPath)) {
      return { success: false, error: 'yt-dlp not installed' }
    }

    if (!hasFfmpeg()) {
      event.sender.send('download-progress', { percent: 0, phase: 'installing' })
      const ok = await ensureFfmpeg()
      if (!ok) return { success: false, error: 'ffmpeg could not be installed' }
    }

    // Step 1: Resolve Spotify URL to search query
    event.sender.send('download-progress', { percent: 5, phase: 'downloading' })
    const trackTitle = await resolveSpotifyTrack(url)
    if (!trackTitle) {
      return { success: false, error: 'Could not resolve Spotify track' }
    }

    event.sender.send('download-progress', { percent: 15, phase: 'downloading' })

    // Step 2: Download from YouTube using yt-dlp search
    const downloadDir = path.join(app.getPath('temp'), 'lorus-downloads')
    if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true })

    const outputTemplate = path.join(downloadDir, '%(title)s.%(ext)s')

    return new Promise((resolve) => {
      const proc = spawn(ytdlpPath, [
        '--ffmpeg-location', getBinDir(),
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--embed-metadata',
        '--embed-thumbnail',
        '--convert-thumbnails', 'jpg',
        '-o', outputTemplate,
        '--newline',
        '--no-check-certificates',
        `ytsearch1:${trackTitle}`,
      ])

      let lastFile = ''
      let stderrOutput = ''

      proc.stdout.on('data', (data) => {
        const lines = data.toString().split('\n')
        for (const line of lines) {
          const progressMatch = line.match(/\[download\]\s+(\d+\.?\d*)%/)
          if (progressMatch) {
            const raw = parseFloat(progressMatch[1])
            // Scale 0-100% download to 15-75% overall
            event.sender.send('download-progress', { percent: 15 + raw * 0.6, phase: 'downloading' })
          }
          if (line.includes('[ExtractAudio]')) {
            event.sender.send('download-progress', { percent: 80, phase: 'converting' })
          }
          if (line.includes('[EmbedThumbnail]')) {
            event.sender.send('download-progress', { percent: 88, phase: 'thumbnail' })
          }
          if (line.includes('[Metadata]') || line.includes('[EmbedMetadata]')) {
            event.sender.send('download-progress', { percent: 92, phase: 'metadata' })
          }

          const destMatch = line.match(/Destination: (.+)/)
          if (destMatch) lastFile = destMatch[1].trim()
          const mergeMatch = line.match(/\[Merger\] Merging formats into "(.+)"/)
          if (mergeMatch) lastFile = mergeMatch[1].trim()
          const extractMatch = line.match(/\[ExtractAudio\] Destination: (.+)/)
          if (extractMatch) lastFile = extractMatch[1].trim()
        }
      })

      proc.stderr.on('data', (data) => { stderrOutput += data.toString() })

      proc.on('close', (code) => {
        if (code === 0 && lastFile && fs.existsSync(lastFile)) {
          const fileName = path.basename(lastFile)
          const fileBuffer = fs.readFileSync(lastFile)
          event.sender.send('download-progress', { percent: 100, phase: 'done' })
          resolve({
            success: true,
            filePath: lastFile,
            fileName,
            fileData: fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength),
          })
        } else {
          const files = fs.readdirSync(downloadDir).filter(f => f.endsWith('.mp3'))
          if (files.length > 0) {
            const sorted = files
              .map(f => ({ name: f, time: fs.statSync(path.join(downloadDir, f)).mtimeMs }))
              .sort((a, b) => b.time - a.time)
            const foundPath = path.join(downloadDir, sorted[0].name)
            const fileBuffer = fs.readFileSync(foundPath)
            event.sender.send('download-progress', { percent: 100, phase: 'done' })
            resolve({
              success: true,
              filePath: foundPath,
              fileName: sorted[0].name,
              fileData: fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength),
            })
          } else {
            const errMsg = stderrOutput.trim().split('\n').pop() || `exit code ${code}`
            resolve({ success: false, error: errMsg })
          }
        }
      })

      proc.on('error', (err) => {
        resolve({ success: false, error: err.message })
      })
    })
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// --- Audio file disk cache ---
const audioCacheDir = path.join(app.getPath('userData'), 'audio')
const waveformCacheDir = path.join(app.getPath('userData'), 'waveforms')

ipcMain.handle('cache-audio', async (_event, trackId, audioData) => {
  try {
    if (!fs.existsSync(audioCacheDir)) {
      fs.mkdirSync(audioCacheDir, { recursive: true })
    }
    const filePath = path.join(audioCacheDir, String(trackId))
    fs.writeFileSync(filePath, Buffer.from(audioData))
    return true
  } catch {
    return false
  }
})

ipcMain.handle('get-cached-audio', async (_event, trackId) => {
  try {
    const filePath = path.join(audioCacheDir, String(trackId))
    if (!fs.existsSync(filePath)) return null
    const buffer = fs.readFileSync(filePath)
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  } catch {
    return null
  }
})

ipcMain.handle('delete-cached-audio', async (_event, trackId) => {
  try {
    const filePath = path.join(audioCacheDir, String(trackId))
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    return true
  } catch {
    return false
  }
})

// Cache audio by copying from an existing file path (no IPC data transfer)
ipcMain.handle('cache-audio-from-path', async (_event, filePath, trackId) => {
  try {
    if (!fs.existsSync(audioCacheDir)) {
      fs.mkdirSync(audioCacheDir, { recursive: true })
    }
    const destPath = path.join(audioCacheDir, String(trackId))
    fs.copyFileSync(filePath, destPath)
    return true
  } catch {
    return false
  }
})

// Check if audio is cached on disk (tiny IPC, no buffer transfer)
ipcMain.handle('is-audio-cached', async (_event, trackId) => {
  const filePath = path.join(audioCacheDir, String(trackId))
  return fs.existsSync(filePath)
})

// --- Waveform disk cache ---
ipcMain.handle('cache-waveform', async (_event, trackId, peaks) => {
  try {
    if (!fs.existsSync(waveformCacheDir)) {
      fs.mkdirSync(waveformCacheDir, { recursive: true })
    }
    const filePath = path.join(waveformCacheDir, String(trackId) + '.json')
    fs.writeFileSync(filePath, JSON.stringify(peaks))
    return true
  } catch {
    return false
  }
})

ipcMain.handle('get-cached-waveform', async (_event, trackId) => {
  try {
    const filePath = path.join(waveformCacheDir, String(trackId) + '.json')
    if (!fs.existsSync(filePath)) return null
    const data = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(data)
  } catch {
    return null
  }
})

// --- Directory scanning for import sync ---
ipcMain.handle('scan-directory', async (_event, dirPath) => {
  try {
    const audioExts = ['.mp3', '.m4a', '.mp4', '.wav', '.ogg', '.flac', '.webm']
    const files = []

    const scan = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          scan(fullPath)
        } else if (fs.existsSync(fullPath)) {
          const ext = path.extname(entry.name).toLowerCase()
          if (audioExts.includes(ext)) {
            files.push(fullPath)
          }
        }
      }
    }

    scan(dirPath)
    return files
  } catch {
    return []
  }
})

// --- Folder watching ---
ipcMain.handle('start-watching', async (_event, watchId, dirPath) => {
  try {
    if (activeWatchers.has(watchId)) return true
    if (!fs.existsSync(dirPath)) return false
    const audioExts = ['.mp3', '.m4a', '.mp4', '.wav', '.ogg', '.flac', '.webm']
    const watcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
      if (!filename) return
      const ext = path.extname(filename).toLowerCase()
      if (!audioExts.includes(ext)) return
      const fullPath = path.join(dirPath, filename)
      if (eventType === 'rename' && fs.existsSync(fullPath)) {
        // Small delay to ensure file is fully written
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('file-detected', { path: fullPath, name: path.basename(fullPath), watchId })
          }
        }, 500)
      }
    })
    activeWatchers.set(watchId, watcher)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('stop-watching', async (_event, watchId) => {
  const watcher = activeWatchers.get(watchId)
  if (watcher) {
    watcher.close()
    activeWatchers.delete(watchId)
  }
  return true
})

// --- Genius lyrics scraping (avoids CORS) ---
const GENIUS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function extractGeniusLyrics(html) {
  const parts = []

  // Strategy 1: data-lyrics-container="true" (current layout)
  const marker = 'data-lyrics-container="true"'
  let searchFrom = 0
  while (true) {
    const markerIdx = html.indexOf(marker, searchFrom)
    if (markerIdx === -1) break
    const openEnd = html.indexOf('>', markerIdx + marker.length)
    if (openEnd === -1) break
    const contentStart = openEnd + 1
    let depth = 1
    let i = contentStart
    while (depth > 0 && i < html.length) {
      const nextOpen = html.indexOf('<div', i)
      const nextClose = html.indexOf('</div>', i)
      if (nextClose === -1) break
      if (nextOpen !== -1 && nextOpen < nextClose) {
        const after = html.charAt(nextOpen + 4)
        if (after === ' ' || after === '>' || after === '\n' || after === '\t') {
          depth++
        }
        i = nextOpen + 5
      } else {
        depth--
        if (depth === 0) {
          parts.push(html.substring(contentStart, nextClose))
        }
        i = nextClose + 6
      }
    }
    searchFrom = i
  }

  // Strategy 2: Lyrics__Container class (styled-components layout)
  if (parts.length === 0) {
    const classMarker = 'class="Lyrics__Container'
    searchFrom = 0
    while (true) {
      const markerIdx = html.indexOf(classMarker, searchFrom)
      if (markerIdx === -1) break
      const openEnd = html.indexOf('>', markerIdx)
      if (openEnd === -1) break
      const contentStart = openEnd + 1
      let depth = 1
      let i = contentStart
      while (depth > 0 && i < html.length) {
        const nextOpen = html.indexOf('<div', i)
        const nextClose = html.indexOf('</div>', i)
        if (nextClose === -1) break
        if (nextOpen !== -1 && nextOpen < nextClose) {
          const after = html.charAt(nextOpen + 4)
          if (after === ' ' || after === '>' || after === '\n' || after === '\t') {
            depth++
          }
          i = nextOpen + 5
        } else {
          depth--
          if (depth === 0) {
            parts.push(html.substring(contentStart, nextClose))
          }
          i = nextClose + 6
        }
      }
      searchFrom = i
    }
  }

  // Strategy 3: old class="lyrics" layout
  if (parts.length === 0) {
    const oldMatch = html.match(/<div class="lyrics"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/)
    if (oldMatch) parts.push(oldMatch[1])
  }

  if (parts.length === 0) return null

  let text = parts.join('\n')
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<(?!\s*br\s*\/?)[^>]+>/gi, '')
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  text = text.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  text = text.replace(/\n{3,}/g, '\n\n')

  return text.trim() || null
}

ipcMain.handle('fetch-genius-lyrics', async (_event, query) => {
  try {
    // Use /api/search (simpler response format than /multi)
    const searchUrl = `https://genius.com/api/search?q=${encodeURIComponent(query)}`
    const searchRes = await net.fetch(searchUrl, { headers: { 'User-Agent': GENIUS_UA } })
    const searchData = await searchRes.json()

    // response.hits[] — flat array, each hit has type + result
    const hits = searchData.response?.hits || []
    const songHit = hits.find(h => h.type === 'song')?.result
    if (!songHit?.url) return { lyrics: null, debug: 'no search results' }

    const pageRes = await net.fetch(songHit.url, {
      headers: { 'User-Agent': GENIUS_UA, 'Accept': 'text/html' },
    })
    const html = await pageRes.text()
    const lyrics = extractGeniusLyrics(html)

    return { lyrics, title: songHit.full_title }
  } catch (err) {
    return { lyrics: null, error: err.message }
  }
})

// Fetch lyrics from a direct Genius URL or song ID
ipcMain.handle('fetch-genius-lyrics-url', async (_event, url) => {
  try {
    const pageRes = await net.fetch(url, {
      headers: { 'User-Agent': GENIUS_UA, 'Accept': 'text/html' },
    })
    const html = await pageRes.text()
    const lyrics = extractGeniusLyrics(html)
    return { lyrics }
  } catch (err) {
    return { lyrics: null, error: err.message }
  }
})

ipcMain.handle('read-file', async (_event, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath)
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  } catch {
    return null
  }
})

// --- Audio Fingerprinting (AcoustID via fpcalc) ---
function getFpcalcPath() {
  return path.join(getBinDir(), process.platform === 'win32' ? 'fpcalc.exe' : 'fpcalc')
}

ipcMain.handle('install-fpcalc', async () => {
  try {
    const fpcalcPath = getFpcalcPath()
    if (fs.existsSync(fpcalcPath)) return true
    const binDir = getBinDir()
    if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true })
    // Download Chromaprint fpcalc binary
    const isWin = process.platform === 'win32'
    const chromaprintUrl = isWin
      ? 'https://github.com/acoustid/chromaprint/releases/download/v1.5.1/chromaprint-fpcalc-1.5.1-windows-x86_64.zip'
      : 'https://github.com/acoustid/chromaprint/releases/download/v1.5.1/chromaprint-fpcalc-1.5.1-linux-x86_64.tar.gz'
    const tempDir = path.join(app.getPath('temp'), 'fpcalc-install')
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true })
    fs.mkdirSync(tempDir, { recursive: true })
    try {
      const archivePath = path.join(tempDir, isWin ? 'fpcalc.zip' : 'fpcalc.tar.gz')
      const ok = await downloadToFile(chromaprintUrl, archivePath)
      if (!ok) return false
      if (isWin) {
        execSync(`powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${tempDir}' -Force"`, { timeout: 60000 })
      } else {
        execSync(`tar -xf "${archivePath}" -C "${tempDir}"`, { timeout: 60000 })
      }
      const fpcalcName = isWin ? 'fpcalc.exe' : 'fpcalc'
      const found = findFileInDir(tempDir, fpcalcName)
      if (found) {
        fs.copyFileSync(found, fpcalcPath)
        if (!isWin) fs.chmodSync(fpcalcPath, '755')
      }
    } finally {
      try { fs.rmSync(tempDir, { recursive: true, force: true }) } catch {}
    }
    return fs.existsSync(fpcalcPath)
  } catch {
    return false
  }
})

ipcMain.handle('generate-fingerprint', async (_event, trackId) => {
  try {
    const fpcalcPath = getFpcalcPath()
    if (!fs.existsSync(fpcalcPath)) return null
    const audioPath = path.join(audioCacheDir, String(trackId))
    if (!fs.existsSync(audioPath)) return null
    return new Promise((resolve) => {
      const proc = spawn(fpcalcPath, ['-json', audioPath])
      let output = ''
      proc.stdout.on('data', (data) => { output += data.toString() })
      proc.on('close', (code) => {
        if (code !== 0) { resolve(null); return }
        try {
          const result = JSON.parse(output)
          resolve({ fingerprint: result.fingerprint, duration: Math.round(result.duration) })
        } catch { resolve(null) }
      })
      proc.on('error', () => resolve(null))
    })
  } catch {
    return null
  }
})

ipcMain.handle('acoustid-lookup', async (_event, fingerprint, duration, apiKey) => {
  try {
    const url = `https://api.acoustid.org/v2/lookup?client=${encodeURIComponent(apiKey)}&meta=recordings+releasegroups&fingerprint=${encodeURIComponent(fingerprint)}&duration=${duration}`
    const res = await net.fetch(url, { headers: { 'User-Agent': 'LorusMusikmacher/1.0' } })
    if (!res.ok) return null
    const data = await res.json()
    const results = data.results || []
    if (results.length === 0) return null
    const best = results[0]
    if (!best.recordings || best.recordings.length === 0) return null
    const recording = best.recordings[0]
    const title = recording.title || null
    const artist = recording.artists?.[0]?.name || null
    return { title, artist, score: best.score }
  } catch {
    return null
  }
})

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

// --- Logging ---
const logFile = path.join(app.getPath('userData'), 'app.log')

ipcMain.on('write-log', (_event, level, message, data) => {
  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] [${level}] ${message}${data ? ' ' + data : ''}\n`
  try {
    fs.appendFileSync(logFile, line)
  } catch {
    // Ignore logging errors
  }
})

// --- Auto Updates ---
function setupAutoUpdater() {
  try {
    const { autoUpdater } = require('electron-updater')
    autoUpdater.checkForUpdatesAndNotify()

    autoUpdater.on('update-available', () => {
      if (mainWindow) {
        mainWindow.webContents.send('update-available')
      }
    })

    autoUpdater.on('update-downloaded', () => {
      if (mainWindow) {
        mainWindow.webContents.send('update-downloaded')
      }
    })

    ipcMain.on('install-update', () => {
      autoUpdater.quitAndInstall()
    })
  } catch {
    // electron-updater not available in dev
  }
}

// --- GitHub Releases check ---
ipcMain.handle('check-github-update', async (_event, repo) => {
  try {
    if (!repo) return { hasUpdate: false }
    const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`
    const res = await net.fetch(apiUrl, {
      headers: { 'User-Agent': 'LorusMusikmacher', 'Accept': 'application/vnd.github.v3+json' },
    })
    if (!res.ok) return { hasUpdate: false, error: `HTTP ${res.status}` }
    const data = await res.json()
    const latestVersion = (data.tag_name || '').replace(/^v\.?/, '')
    const currentVersion = app.getVersion()
    if (!latestVersion) return { hasUpdate: false }
    const hasUpdate = latestVersion !== currentVersion && compareVersions(latestVersion, currentVersion) > 0
    const downloadUrl = data.html_url || ''
    const assets = (data.assets || []).map(a => ({ name: a.name, url: a.browser_download_url, size: a.size }))
    return { hasUpdate, latestVersion, currentVersion, downloadUrl, assets, body: data.body }
  } catch (err) {
    return { hasUpdate: false, error: err.message }
  }
})

function compareVersions(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

// Download update installer and run it
ipcMain.handle('download-and-install-update', async (_event, assetUrl) => {
  try {
    if (!assetUrl) return { success: false, error: 'No URL' }
    const res = await net.fetch(assetUrl, { headers: { 'User-Agent': 'LorusMusikmacher' } })
    if (!res.ok) return { success: false, error: `HTTP ${res.status}` }
    const buffer = Buffer.from(await res.arrayBuffer())
    const fileName = path.basename(new URL(assetUrl).pathname) || 'update-setup.exe'
    const tmpPath = path.join(os.tmpdir(), fileName)
    fs.writeFileSync(tmpPath, buffer)
    const { shell } = require('electron')
    shell.openPath(tmpPath)
    setTimeout(() => app.quit(), 1500)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// Open URL in default browser
ipcMain.handle('open-external', async (_event, url) => {
  const { shell } = require('electron')
  await shell.openExternal(url)
})

// --- Clipboard notification popup (custom BrowserWindow) ---
let notifWindow = null
let notifData = { url: '', platform: '' }

async function fetchOembedQuick(url, platform) {
  try {
    let oembedUrl
    if (platform === 'youtube') {
      oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    } else if (platform === 'spotify') {
      const cleanUrl = url.replace(/\/intl-[a-z]{2}\//, '/').split('?')[0]
      oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(cleanUrl)}`
    } else if (platform === 'soundcloud') {
      oembedUrl = `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`
    }
    if (!oembedUrl) return null
    const fetchPromise = net.fetch(oembedUrl, { headers: { 'User-Agent': GENIUS_UA } })
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(), 3000))
    const res = await Promise.race([fetchPromise, timeoutPromise])
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function buildNotificationHtml(url, platform, title, thumbnailUrl) {
  const colors = {
    youtube: { from: '#ef4444', to: '#dc2626', bg: 'rgba(239,68,68,0.12)', text: '#f87171' },
    soundcloud: { from: '#f97316', to: '#ea580c', bg: 'rgba(249,115,22,0.12)', text: '#fb923c' },
    spotify: { from: '#22c55e', to: '#16a34a', bg: 'rgba(34,197,94,0.12)', text: '#4ade80' },
  }
  const c = colors[platform] || colors.youtube
  const platformLabel = platform === 'youtube' ? 'YouTube' : platform === 'soundcloud' ? 'SoundCloud' : 'Spotify'
  const shortUrl = url.length > 45 ? url.slice(0, 45) + '\u2026' : url
  const titleText = title || (platformLabel + '-Link erkannt')

  const platformIcons = {
    youtube: '<svg width="22" height="22" viewBox="0 0 24 24" fill="' + c.from + '"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
    soundcloud: '<svg width="22" height="22" viewBox="0 0 24 24" fill="' + c.from + '"><path d="M11.56 8.48v8.02h8.44c2.04 0 2-.98 2-2.18s-.22-3.4-2.44-3.4c-.42 0-.63.05-.63.05S18.72 7.2 15.2 7.2c-1.76 0-3.64.66-3.64 1.28zM10.36 8.42c-.1-.04-.2-.02-.2.08v8h.6V8.9c0-.18-.2-.4-.4-.48zM9.2 9.2c-.08-.06-.2-.04-.2.06v7.24h.6v-7c0-.12-.24-.22-.4-.3zM8 10.04c-.08-.04-.2-.02-.2.08v6.38h.6v-6.2c0-.1-.2-.2-.4-.26z"/></svg>',
    spotify: '<svg width="22" height="22" viewBox="0 0 24 24" fill="' + c.from + '"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>',
  }

  const hasThumbnail = !!thumbnailUrl
  const visual = hasThumbnail
    ? '<img class="thumb" src="' + escHtml(thumbnailUrl) + '" onerror="this.parentNode.innerHTML=\'<div class=no-thumb>' + platformIcons[platform] + '</div>\'" />'
    : '<div class="no-thumb">' + (platformIcons[platform] || '') + '</div>'

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    '*{margin:0;padding:0;box-sizing:border-box}' +
    'html,body{background:transparent;overflow:hidden;user-select:none}' +
    'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}' +
    '.card{margin:6px;background:rgba(22,22,26,0.97);border-radius:14px;border:1px solid rgba(255,255,255,0.08);' +
    'box-shadow:0 12px 48px rgba(0,0,0,0.55),0 4px 12px rgba(0,0,0,0.3);overflow:hidden;' +
    'animation:slideIn .4s cubic-bezier(.16,1,.3,1)}' +
    '@keyframes slideIn{from{transform:translateY(30px) scale(.96);opacity:0}to{transform:translateY(0) scale(1);opacity:1}}' +
    '.accent{height:3px;background:linear-gradient(90deg,' + c.from + ',' + c.to + ')}' +
    '.close{position:absolute;top:10px;right:10px;background:rgba(255,255,255,.06);border:none;color:rgba(255,255,255,.35);' +
    'cursor:pointer;padding:5px;border-radius:7px;display:flex;align-items:center;justify-content:center;transition:all .15s;z-index:2}' +
    '.close:hover{background:rgba(255,255,255,.12);color:rgba(255,255,255,.7)}' +
    '.body{display:flex;padding:12px 14px 8px;gap:12px;position:relative}' +
    '.thumb{width:72px;height:72px;border-radius:10px;object-fit:cover;flex-shrink:0;background:rgba(255,255,255,.04)}' +
    '.no-thumb{width:52px;height:52px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:' + c.bg + '}' +
    '.info{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:3px;padding-right:24px}' +
    '.platform{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:' + c.text + '}' +
    '.title{font-size:13px;font-weight:600;color:rgba(255,255,255,.93);overflow:hidden;text-overflow:ellipsis;' +
    'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.35}' +
    '.url{font-size:10px;color:rgba(255,255,255,.28);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.actions{padding:4px 14px 12px}' +
    '.dl-btn{display:flex;width:100%;align-items:center;justify-content:center;gap:7px;' +
    'padding:9px 14px;border-radius:10px;border:none;' +
    'background:linear-gradient(135deg,' + c.from + ',' + c.to + ');' +
    'color:#fff;font-size:12.5px;font-weight:600;cursor:pointer;transition:all .15s;letter-spacing:.2px}' +
    '.dl-btn:hover{filter:brightness(1.15);transform:translateY(-1px)}' +
    '.dl-btn:active{transform:scale(.97)}' +
    '.progress{height:2px;background:rgba(255,255,255,.04);overflow:hidden}' +
    '.progress-bar{height:100%;background:' + c.from + ';animation:shrink 20s linear forwards}' +
    '@keyframes shrink{from{width:100%}to{width:0%}}' +
    '</style></head><body>' +
    '<div class="card" style="position:relative">' +
    '<div class="accent"></div>' +
    '<button class="close" onclick="console.log(\'__DISMISS\')">' +
    '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>' +
    '</button>' +
    '<div class="body">' +
    visual +
    '<div class="info">' +
    '<div class="platform">' + escHtml(platformLabel) + '</div>' +
    '<div class="title">' + escHtml(titleText) + '</div>' +
    '<div class="url">' + escHtml(shortUrl) + '</div>' +
    '</div></div>' +
    '<div class="actions">' +
    '<button class="dl-btn" onclick="console.log(\'__DOWNLOAD\')">' +
    '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>' +
    'Herunterladen</button></div>' +
    '<div class="progress"><div class="progress-bar"></div></div>' +
    '</div></body></html>'
}

function showClipboardNotification(url, platform, title, thumbnailUrl) {
  if (notifWindow && !notifWindow.isDestroyed()) {
    notifWindow.close()
  }

  const { screen } = require('electron')
  const display = screen.getPrimaryDisplay()
  const { width, height } = display.workAreaSize

  const notifWidth = 380
  const notifHeight = thumbnailUrl ? 230 : 200
  const margin = 12

  notifData = { url, platform }

  notifWindow = new BrowserWindow({
    width: notifWidth,
    height: notifHeight,
    x: width - notifWidth - margin,
    y: height - notifHeight - margin,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  notifWindow.webContents.on('console-message', (_event, _level, message) => {
    if (message === '__DOWNLOAD') {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('clipboard-url', { url: notifData.url, platform: notifData.platform })
        mainWindow.show()
        mainWindow.focus()
      }
      if (notifWindow && !notifWindow.isDestroyed()) notifWindow.close()
      notifWindow = null
    } else if (message === '__DISMISS') {
      if (notifWindow && !notifWindow.isDestroyed()) notifWindow.close()
      notifWindow = null
    }
  })

  notifWindow.once('ready-to-show', () => {
    if (notifWindow && !notifWindow.isDestroyed()) notifWindow.showInactive()
  })

  const html = buildNotificationHtml(url, platform, title, thumbnailUrl)
  notifWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))

  // Auto-close after 20s
  setTimeout(() => {
    if (notifWindow && !notifWindow.isDestroyed()) {
      notifWindow.close()
      notifWindow = null
    }
  }, 20000)
}

app.setAppUserModelId('com.lorus.musikmacher')

app.whenReady().then(() => {
  // Stream audio directly from disk cache — no IPC buffer transfer
  // Manual Range request handling (net.fetch + file:// doesn't support Range)
  protocol.handle('media-cache', (request) => {
    const url = new URL(request.url)
    const trackId = url.pathname.slice(1)
    const filePath = path.join(audioCacheDir, trackId)
    if (!fs.existsSync(filePath)) {
      return new Response('Not found', { status: 404 })
    }
    const stat = fs.statSync(filePath)
    const fileSize = stat.size

    // Detect content type from file extension or default to audio/mpeg
    const ext = path.extname(filePath).toLowerCase()
    const mimeMap = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.flac': 'audio/flac', '.webm': 'audio/webm' }
    const contentType = mimeMap[ext] || 'audio/mpeg'

    const rangeHeader = request.headers.get('range')
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
      if (match) {
        const start = parseInt(match[1])
        const end = match[2] ? parseInt(match[2]) : fileSize - 1
        const chunkSize = end - start + 1
        const buffer = Buffer.alloc(chunkSize)
        const fd = fs.openSync(filePath, 'r')
        fs.readSync(fd, buffer, 0, chunkSize, start)
        fs.closeSync(fd)
        return new Response(buffer, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': contentType,
          },
        })
      }
    }
    // Full file response
    const data = fs.readFileSync(filePath)
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
      },
    })
  })

  createWindow()

  if (!isDev) {
    setupAutoUpdater()
  }

  // --- Clipboard watcher: detect YouTube/SoundCloud/Spotify URLs ---
  let lastClipboardText = ''
  let lastSentUrl = ''
  setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const text = clipboard.readText().trim()
    if (!text || text === lastClipboardText) return
    lastClipboardText = text
    // Check against known platform patterns
    let platform = null
    if (/youtube\.com\/watch|youtu\.be\//i.test(text)) platform = 'youtube'
    else if (/soundcloud\.com\//i.test(text)) platform = 'soundcloud'
    else if (/open\.spotify\.com\//i.test(text)) platform = 'spotify'
    if (platform && text !== lastSentUrl) {
      lastSentUrl = text
      // Fetch metadata (title + thumbnail) then show custom notification popup
      fetchOembedQuick(text, platform).then(meta => {
        showClipboardNotification(text, platform, meta?.title || null, meta?.thumbnail_url || null)
      })
    }
  }, 1500)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Clean up temp files on quit
app.on('will-quit', () => {
  // Close all file watchers
  for (const [, watcher] of activeWatchers) {
    try { watcher.close() } catch {}
  }
  activeWatchers.clear()

  try {
    const tempDir = path.join(os.tmpdir(), 'lorus-musik-macher')
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
    const downloadDir = path.join(app.getPath('temp'), 'lorus-downloads')
    if (fs.existsSync(downloadDir)) {
      fs.rmSync(downloadDir, { recursive: true, force: true })
    }
  } catch {
    // Ignore cleanup errors
  }
})
