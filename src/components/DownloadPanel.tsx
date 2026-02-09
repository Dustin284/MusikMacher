import { useState, useMemo, useEffect, useRef } from 'react'
import { useTranslation } from '../i18n/useTranslation'
import { useTrackStore } from '../store/useTrackStore'
import { usePlaylistProgress } from '../store/usePlaylistProgress'
import { log } from '../utils/logger'
import type { SearchResult, PlaylistInfo } from '../types'

interface DownloadPanelProps {
  category: number
  initialUrl?: string
  onInitialUrlConsumed?: () => void
}

type DownloadStatus = 'idle' | 'downloading' | 'installing' | 'success' | 'error' | 'playlist-downloading'

function detectPlatform(url: string): 'youtube' | 'soundcloud' | 'spotify' | null {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube'
  if (/soundcloud\.com/i.test(url)) return 'soundcloud'
  if (/open\.spotify\.com/i.test(url)) return 'spotify'
  return null
}

function isUrl(text: string): boolean {
  return detectPlatform(text.trim()) !== null
}

function isPlaylistUrl(url: string): boolean {
  if (/youtube\.com\/playlist\?list=|[?&]list=/i.test(url)) return true
  if (/open\.spotify\.com\/(intl-[a-z]{2}\/)?(playlist|album|artist)\//i.test(url)) return true
  if (/soundcloud\.com\/.+\/sets\//i.test(url)) return true
  return false
}

export default function DownloadPanel({ category, initialUrl, onInitialUrlConsumed }: DownloadPanelProps) {
  const { t } = useTranslation()
  const importDownloadedTrack = useTrackStore(s => s.importDownloadedTrack)
  const analyzeTrack = useTrackStore(s => s.analyzeTrack)

  // Single input for both URL and search
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<DownloadStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  // Playlist state
  const [playlistInfo, setPlaylistInfo] = useState<PlaylistInfo | null>(null)
  const [fetchingPlaylist, setFetchingPlaylist] = useState(false)
  const plProgress = usePlaylistProgress(s => s)

  // Search state
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Accept URL passed from clipboard notification — auto-start download
  useEffect(() => {
    if (initialUrl) {
      setInput(initialUrl)
      onInitialUrlConsumed?.()
      // Don't auto-start for playlists — let user see info first
      if (!isPlaylistUrl(initialUrl)) {
        setTimeout(() => handleDownload(initialUrl), 50)
      }
    }
  }, [initialUrl])

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI
  const platform = useMemo(() => detectPlatform(input), [input])
  const inputIsUrl = useMemo(() => isUrl(input), [input])
  const isPlaylist = useMemo(() => isPlaylistUrl(input), [input])
  const isDownloading = status === 'downloading' || status === 'installing' || status === 'playlist-downloading'

  // Auto-detect playlist and fetch info
  useEffect(() => {
    if (!isElectron || !window.electronAPI?.fetchPlaylistInfo) return

    if (isPlaylist && input.trim()) {
      setFetchingPlaylist(true)
      setPlaylistInfo(null)
      window.electronAPI.fetchPlaylistInfo(input.trim()).then(result => {
        if (result.success && result.playlist) {
          setPlaylistInfo(result.playlist)
        }
        setFetchingPlaylist(false)
      }).catch(() => setFetchingPlaylist(false))
    } else {
      setPlaylistInfo(null)
      setFetchingPlaylist(false)
    }
  }, [input, isPlaylist])

  // Debounced auto-search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = input.trim()
    if (!trimmed || trimmed.length < 3 || isUrl(trimmed) || isDownloading) {
      if (!trimmed) {
        setSearchResults([])
        setSearchError('')
        setHasSearched(false)
      }
      return
    }

    debounceRef.current = setTimeout(() => {
      handleSearch(trimmed)
    }, 500)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [input])

  // Register playlist progress listener (uses Zustand store to avoid IPC/useState bug)
  useEffect(() => {
    if (!window.electronAPI?.onPlaylistProgress) return
    window.electronAPI.onPlaylistProgress((data) => {
      usePlaylistProgress.setState(data)
    })
  }, [])

  // Import each playlist track immediately as it finishes downloading
  const playlistImportCountRef = useRef(0)
  useEffect(() => {
    if (!window.electronAPI?.onPlaylistTrackReady) return
    window.electronAPI.onPlaylistTrackReady(async (data) => {
      if (data.fileData && data.fileName) {
        try {
          const { trackId } = await importDownloadedTrack(
            data.fileData,
            data.fileName,
            data.filePath || '',
            category
          )
          if (trackId) {
            playlistImportCountRef.current++
            analyzeTrack(trackId).catch(() => {})
          }
        } catch { /* skip failed import */ }
      }
    })
  }, [category])

  const getPhaseText = (p: string) => {
    switch (p) {
      case 'downloading': return t('download.downloading')
      case 'converting': return t('download.converting')
      case 'thumbnail':
      case 'metadata': return t('download.embeddingMeta')
      case 'importing': return t('download.importing')
      default: return t('download.downloading')
    }
  }

  const handleDownload = async (urlOverride?: string) => {
    const downloadUrl = (urlOverride || input).trim()
    if (!downloadUrl || !isElectron || !window.electronAPI) return

    const detectedPlatform = detectPlatform(downloadUrl)
    if (!detectedPlatform) return

    setStatus('downloading')
    setProgress(0)
    setPhase('downloading')
    setErrorMessage('')
    setSearchResults([])
    setSearchError('')

    try {
      log('info', 'Starting download', { url: downloadUrl, platform: detectedPlatform })

      const isSpotify = detectedPlatform === 'spotify'

      if (window.electronAPI.checkYtdlp) {
        const hasYtdlp = await window.electronAPI.checkYtdlp()
        if (!hasYtdlp && window.electronAPI.installYtdlp) {
          setStatus('installing')
          await window.electronAPI.installYtdlp()
        }
      }

      setStatus('downloading')

      if (window.electronAPI.onDownloadProgress) {
        window.electronAPI.onDownloadProgress((data) => {
          setProgress(data.percent)
          setPhase(data.phase)
        })
      }

      let result: { success: boolean; filePath?: string; fileName?: string; fileData?: ArrayBuffer; error?: string } | undefined

      if (isSpotify) {
        if (!window.electronAPI.downloadSpotify) throw new Error('Spotify download not available')
        result = await window.electronAPI.downloadSpotify(downloadUrl)
      } else {
        if (!window.electronAPI.downloadAudio) throw new Error('Download API not available')
        result = await window.electronAPI.downloadAudio(downloadUrl)
      }

      if (result?.success && result.fileData && result.fileName) {
        setPhase('importing')
        setProgress(95)

        const { trackId } = await importDownloadedTrack(
          result.fileData,
          result.fileName,
          result.filePath || '',
          category
        )

        if (trackId) {
          setPhase('analyzing')
          analyzeTrack(trackId).catch(() => {})
        }

        setStatus('success')
        setProgress(100)
        setPhase('done')
        log('info', 'Download completed and imported', { url: downloadUrl, fileName: result.fileName, trackId: String(trackId ?? '') })

        setTimeout(() => {
          setStatus('idle')
          setInput('')
          setProgress(0)
          setPhase('')
        }, 2000)
      } else {
        throw new Error(result?.error || 'Unknown error')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStatus('error')
      setErrorMessage(message)
      log('error', 'Download failed', { url: downloadUrl, error: message })
    }
  }

  const handlePlaylistDownload = async () => {
    const downloadUrl = input.trim()
    if (!downloadUrl || !isElectron || !window.electronAPI?.downloadPlaylist) return

    setStatus('playlist-downloading')
    setErrorMessage('')
    setSearchResults([])
    usePlaylistProgress.getState().reset()
    playlistImportCountRef.current = 0

    try {
      log('info', 'Starting playlist download', { url: downloadUrl })

      if (window.electronAPI.checkYtdlp) {
        const hasYtdlp = await window.electronAPI.checkYtdlp()
        if (!hasYtdlp && window.electronAPI.installYtdlp) {
          await window.electronAPI.installYtdlp()
        }
      }

      const result = await window.electronAPI.downloadPlaylist(downloadUrl)

      if (result.success) {
        // Tracks are already imported live via onPlaylistTrackReady
        const importedCount = playlistImportCountRef.current

        setStatus('success')
        setErrorMessage(t('playlist.complete', { count: String(importedCount) }))
        log('info', 'Playlist download completed', { url: downloadUrl, imported: String(importedCount) })

        setTimeout(() => {
          setStatus('idle')
          setInput('')
          setErrorMessage('')
          setPlaylistInfo(null)
          usePlaylistProgress.getState().reset()
        }, 3000)
      } else {
        throw new Error(result.error || 'Unknown error')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setStatus('error')
      setErrorMessage(message)
      log('error', 'Playlist download failed', { url: downloadUrl, error: message })
    }
  }

  const handleCancelPlaylist = () => {
    window.electronAPI?.cancelPlaylistDownload?.()
    setStatus('idle')
    usePlaylistProgress.getState().reset()
  }

  const handleSearch = async (query: string) => {
    if (!isElectron || !window.electronAPI?.searchAudio) return

    setIsSearching(true)
    setSearchError('')
    setHasSearched(true)

    try {
      if (window.electronAPI.checkYtdlp) {
        const hasYtdlp = await window.electronAPI.checkYtdlp()
        if (!hasYtdlp && window.electronAPI.installYtdlp) {
          await window.electronAPI.installYtdlp()
        }
      }

      const res = await window.electronAPI.searchAudio(query, 'both', 10)
      if (res.success && res.results) {
        setSearchResults(res.results)
      } else {
        setSearchError(res.error || 'Unknown error')
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSearching(false)
    }
  }

  const handleDownloadResult = (result: SearchResult) => {
    setInput(result.url)
    setTimeout(() => handleDownload(result.url), 50)
  }

  // Non-Electron fallback
  if (!isElectron) {
    return (
      <div className="p-4 rounded-2xl bg-surface-100/50 dark:bg-surface-800/50 border-0 shadow-sm">
        <div className="flex items-center gap-3 text-surface-500">
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span className="text-[13px]">{t('download.notAvailable')}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 rounded-2xl bg-surface-100/50 dark:bg-surface-800/50 border-0 shadow-sonoma">
      {/* Smart input with platform icon */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          {/* Platform icon — only show when URL detected */}
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2">
            {platform === 'youtube' ? (
              <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            ) : platform === 'spotify' ? (
              <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
            ) : platform === 'soundcloud' ? (
              <svg className="w-4 h-4 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.05-.1-.1-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.172 1.282c.013.06.045.094.104.094.058 0 .09-.038.104-.094l.209-1.282-.209-1.332c-.014-.057-.046-.094-.104-.094m1.79-1.065c-.067 0-.12.054-.127.12l-.215 2.37.215 2.313c.007.066.06.12.126.12.066 0 .12-.054.127-.12l.248-2.313-.248-2.37c-.007-.066-.06-.12-.127-.12m.899-.213c-.077 0-.135.063-.142.14l-.197 2.583.197 2.529c.007.077.065.14.142.14s.135-.063.142-.14l.225-2.529-.225-2.583c-.007-.077-.065-.14-.142-.14m.904-.068c-.085 0-.15.07-.157.155l-.183 2.651.183 2.604c.007.085.072.155.157.155.084 0 .149-.07.156-.155l.21-2.604-.21-2.651c-.007-.085-.072-.155-.156-.155m.977-.133c-.096 0-.168.08-.176.175l-.162 2.784.162 2.736c.008.095.08.175.176.175.095 0 .168-.08.175-.175l.186-2.736-.186-2.784c-.007-.095-.08-.175-.175-.175m.99-.143c-.104 0-.183.088-.19.192l-.148 2.927.148 2.871c.007.104.086.192.19.192s.183-.088.19-.192l.169-2.871-.169-2.927c-.007-.104-.086-.192-.19-.192m1.063-.143c-.114 0-.2.096-.207.21l-.13 3.07.13 2.986c.007.114.093.21.207.21.113 0 .2-.096.206-.21l.15-2.986-.15-3.07c-.006-.114-.093-.21-.206-.21m1.048-.048c-.12 0-.213.103-.22.224l-.12 3.118.12 3.033c.007.12.1.224.22.224.12 0 .213-.104.22-.224l.138-3.033-.138-3.118c-.007-.12-.1-.224-.22-.224m1.06.015c-.13 0-.233.112-.24.243l-.103 3.103.103 3.026c.007.13.11.242.24.242.129 0 .232-.112.239-.242l.118-3.026-.118-3.103c-.007-.13-.11-.243-.24-.243m1.063-.088c-.14 0-.247.12-.254.259l-.09 3.191.09 3.074c.007.14.114.259.254.259.14 0 .247-.12.254-.259l.102-3.074-.102-3.191c-.007-.14-.114-.259-.254-.259m1.12-.182c-.148 0-.262.127-.27.275l-.073 3.373.074 3.18c.007.15.12.276.269.276.148 0 .262-.127.269-.276l.084-3.18-.084-3.373c-.007-.148-.121-.275-.269-.275m1.062.098c-.158 0-.278.136-.285.294l-.059 3.275.059 3.112c.007.158.127.294.285.294.157 0 .277-.136.285-.294l.068-3.112-.068-3.275c-.008-.158-.128-.294-.285-.294m1.13-.406c-.033 0-.065.003-.097.008a5.326 5.326 0 00-5.273-4.525c-.675 0-1.337.12-1.93.36-.227.092-.288.185-.288.368v8.887c.008.188.158.341.346.354h7.242a2.638 2.638 0 002.636-2.636 2.638 2.638 0 00-2.636-2.636" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            )}
          </div>
          <input
            type="text"
            placeholder={t('download.urlPlaceholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isDownloading}
            className="w-full pl-9 pr-3 py-3 text-[13px] rounded-xl border-0 bg-surface-200/50 dark:bg-surface-800/50 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all disabled:opacity-50"
          />
        </div>

        {/* Download button — only show for non-playlist URLs */}
        {inputIsUrl && !isPlaylist && (
          <button
            onClick={() => handleDownload()}
            disabled={!input.trim() || !platform || isDownloading}
            className="px-5 py-2.5 text-[13px] font-medium rounded-xl bg-primary-500 hover:bg-primary-600 text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {isDownloading ? t('download.downloading') : t('download.download')}
          </button>
        )}
      </div>

      {/* Playlist info card */}
      {isPlaylist && !isDownloading && (
        <div className="mb-3">
          {fetchingPlaylist ? (
            <div className="flex items-center gap-2 text-surface-500 text-[13px] py-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {t('playlist.fetchingInfo')}
            </div>
          ) : playlistInfo ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary-500/10 border border-primary-500/10">
              <div className="flex items-center gap-2 min-w-0">
                <svg className="w-5 h-5 text-primary-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                </svg>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-surface-800 dark:text-surface-200 truncate">
                    {playlistInfo.title}
                  </p>
                  {playlistInfo.trackCount > 0 && (
                    <p className="text-[11px] text-surface-500">
                      {t('playlist.detected', { count: String(playlistInfo.trackCount) })}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handlePlaylistDownload}
                className="px-5 py-2.5 text-[13px] font-medium rounded-xl bg-primary-500 hover:bg-primary-600 text-white shadow-sm transition-all active:scale-[0.98] shrink-0 ml-3"
              >
                {t('playlist.downloadAll')}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Playlist download progress */}
      {status === 'playlist-downloading' && (
        <div className="mb-3">
          <div className="h-1.5 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary-500 transition-all duration-500 ease-out"
              style={{ width: `${Math.max(plProgress.percent, 2)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[11px] text-surface-500">
              {plProgress.total > 0
                ? t('playlist.downloading', {
                    current: String(plProgress.current),
                    total: String(plProgress.total),
                    name: plProgress.trackName,
                  })
                : t('download.downloading')
              }
            </p>
            <button
              onClick={handleCancelPlaylist}
              className="text-[11px] text-red-500 hover:text-red-600 font-medium transition-colors"
            >
              {t('playlist.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Single track progress bar */}
      {(status === 'downloading' || status === 'installing') && (
        <div className="mb-3">
          <div className="h-1.5 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary-500 transition-all duration-500 ease-out"
              style={{ width: `${Math.max(progress, 2)}%` }}
            />
          </div>
          <p className="text-[11px] text-surface-500 mt-1.5">
            {status === 'installing' ? t('download.installing') : `${getPhaseText(phase)} ${Math.round(progress)}%`}
          </p>
        </div>
      )}

      {/* Status messages */}
      {status === 'success' && (
        <div className="flex items-center gap-2 text-green-500 text-[13px] mb-3">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {errorMessage || t('download.success')}
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 text-red-500 text-[13px] mb-3">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {t('download.error', { error: errorMessage })}
        </div>
      )}

      {/* Searching spinner */}
      {isSearching && (
        <div className="flex items-center gap-2 text-surface-500 text-[13px] py-4 justify-center">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {t('search.searching')}
        </div>
      )}

      {/* Search error */}
      {searchError && (
        <div className="flex items-center gap-2 text-red-500 text-[13px] mb-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {t('search.error', { error: searchError })}
        </div>
      )}

      {/* No results */}
      {!isSearching && !searchError && hasSearched && searchResults.length === 0 && input.trim().length >= 3 && !inputIsUrl && (
        <p className="text-[12px] text-surface-500 text-center py-3">{t('search.noResults')}</p>
      )}

      {/* Results list */}
      {searchResults.length > 0 && !isDownloading && (
        <div className="max-h-[320px] overflow-y-auto space-y-1">
          {searchResults.map((result) => (
            <div
              key={`${result.platform}-${result.id}`}
              className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-surface-200/50 dark:hover:bg-surface-700/50 transition-colors group cursor-pointer"
              onClick={() => handleDownloadResult(result)}
            >
              {/* Thumbnail with platform badge */}
              <div className="relative w-12 h-9 rounded overflow-hidden bg-surface-200 dark:bg-surface-700 shrink-0">
                {result.thumbnail ? (
                  <img
                    src={result.thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-surface-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                    </svg>
                  </div>
                )}
                {/* Platform badge */}
                <div className="absolute bottom-0 right-0 p-0.5 rounded-tl bg-black/60">
                  {result.platform === 'youtube' ? (
                    <svg className="w-2.5 h-2.5 text-red-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  ) : (
                    <svg className="w-2.5 h-2.5 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.05-.1-.1-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.172 1.282c.013.06.045.094.104.094.058 0 .09-.038.104-.094l.209-1.282-.209-1.332c-.014-.057-.046-.094-.104-.094m1.79-1.065c-.067 0-.12.054-.127.12l-.215 2.37.215 2.313c.007.066.06.12.126.12.066 0 .12-.054.127-.12l.248-2.313-.248-2.37c-.007-.066-.06-.12-.127-.12m.899-.213c-.077 0-.135.063-.142.14l-.197 2.583.197 2.529c.007.077.065.14.142.14s.135-.063.142-.14l.225-2.529-.225-2.583c-.007-.077-.065-.14-.142-.14m.904-.068c-.085 0-.15.07-.157.155l-.183 2.651.183 2.604c.007.085.072.155.157.155.084 0 .149-.07.156-.155l.21-2.604-.21-2.651c-.007-.085-.072-.155-.156-.155m.977-.133c-.096 0-.168.08-.176.175l-.162 2.784.162 2.736c.008.095.08.175.176.175.095 0 .168-.08.175-.175l.186-2.736-.186-2.784c-.007-.095-.08-.175-.175-.175m.99-.143c-.104 0-.183.088-.19.192l-.148 2.927.148 2.871c.007.104.086.192.19.192s.183-.088.19-.192l.169-2.871-.169-2.927c-.007-.104-.086-.192-.19-.192m1.063-.143c-.114 0-.2.096-.207.21l-.13 3.07.13 2.986c.007.114.093.21.207.21.113 0 .2-.096.206-.21l.15-2.986-.15-3.07c-.006-.114-.093-.21-.206-.21m1.048-.048c-.12 0-.213.103-.22.224l-.12 3.118.12 3.033c.007.12.1.224.22.224.12 0 .213-.104.22-.224l.138-3.033-.138-3.118c-.007-.12-.1-.224-.22-.224m1.06.015c-.13 0-.233.112-.24.243l-.103 3.103.103 3.026c.007.13.11.242.24.242.129 0 .232-.112.239-.242l.118-3.026-.118-3.103c-.007-.13-.11-.243-.24-.243m1.063-.088c-.14 0-.247.12-.254.259l-.09 3.191.09 3.074c.007.14.114.259.254.259.14 0 .247-.12.254-.259l.102-3.074-.102-3.191c-.007-.14-.114-.259-.254-.259m1.12-.182c-.148 0-.262.127-.27.275l-.073 3.373.074 3.18c.007.15.12.276.269.276.148 0 .262-.127.269-.276l.084-3.18-.084-3.373c-.007-.148-.121-.275-.269-.275m1.062.098c-.158 0-.278.136-.285.294l-.059 3.275.059 3.112c.007.158.127.294.285.294.157 0 .277-.136.285-.294l.068-3.112-.068-3.275c-.008-.158-.128-.294-.285-.294m1.13-.406c-.033 0-.065.003-.097.008a5.326 5.326 0 00-5.273-4.525c-.675 0-1.337.12-1.93.36-.227.092-.288.185-.288.368v8.887c.008.188.158.341.346.354h7.242a2.638 2.638 0 002.636-2.636 2.638 2.638 0 00-2.636-2.636" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Title + Channel with verified badge */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-surface-800 dark:text-surface-200 truncate leading-tight">
                  {result.title}
                </p>
                <p className="text-[11px] text-surface-500 truncate leading-tight mt-0.5 flex items-center gap-1">
                  <span className="truncate">{result.channel}</span>
                  {result.verified && (
                    <svg className="w-3 h-3 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" />
                    </svg>
                  )}
                </p>
              </div>

              {/* Duration */}
              <span className="text-[12px] text-surface-500 tabular-nums shrink-0">
                {result.durationString}
              </span>

              {/* Download button */}
              <button
                onClick={(e) => { e.stopPropagation(); handleDownloadResult(result) }}
                className="p-1.5 rounded-md text-surface-400 hover:text-primary-500 hover:bg-primary-500/10 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                title={t('download.download')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
