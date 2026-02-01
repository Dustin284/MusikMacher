const { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu } = require('electron')
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
        } else {
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
