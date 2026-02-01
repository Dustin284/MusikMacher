import { useState, useMemo } from 'react'
import { useTranslation } from '../i18n/useTranslation'
import { useTrackStore } from '../store/useTrackStore'
import { log } from '../utils/logger'

interface DownloadPanelProps {
  category: number
}

type DownloadStatus = 'idle' | 'downloading' | 'installing' | 'success' | 'error'

function detectPlatform(url: string): 'youtube' | 'soundcloud' | 'spotify' | null {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube'
  if (/soundcloud\.com/i.test(url)) return 'soundcloud'
  if (/open\.spotify\.com/i.test(url)) return 'spotify'
  return null
}

export default function DownloadPanel({ category }: DownloadPanelProps) {
  const { t } = useTranslation()
  const importDownloadedTrack = useTrackStore(s => s.importDownloadedTrack)

  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<DownloadStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI
  const platform = useMemo(() => detectPlatform(url), [url])

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

  const handleDownload = async () => {
    if (!url.trim() || !isElectron || !window.electronAPI) return

    const detectedPlatform = detectPlatform(url)
    if (!detectedPlatform) return

    setStatus('downloading')
    setProgress(0)
    setPhase('downloading')
    setErrorMessage('')

    try {
      log('info', 'Starting download', { url, platform: detectedPlatform })

      const isSpotify = detectedPlatform === 'spotify'

      // All platforms need yt-dlp + ffmpeg (Spotify resolves via oEmbed then uses yt-dlp)
      if (window.electronAPI.checkYtdlp) {
        const hasYtdlp = await window.electronAPI.checkYtdlp()
        if (!hasYtdlp && window.electronAPI.installYtdlp) {
          setStatus('installing')
          await window.electronAPI.installYtdlp()
        }
      }

      setStatus('downloading')

      // Listen for progress updates (cleans up old listeners automatically)
      if (window.electronAPI.onDownloadProgress) {
        window.electronAPI.onDownloadProgress((data) => {
          setProgress(data.percent)
          setPhase(data.phase)
        })
      }

      // Start the download via the appropriate backend
      let result: { success: boolean; filePath?: string; fileName?: string; fileData?: ArrayBuffer; error?: string } | undefined

      if (isSpotify) {
        if (!window.electronAPI.downloadSpotify) throw new Error('Spotify download not available')
        result = await window.electronAPI.downloadSpotify(url.trim())
      } else {
        if (!window.electronAPI.downloadAudio) throw new Error('Download API not available')
        result = await window.electronAPI.downloadAudio(url.trim())
      }

      if (result?.success && result.fileData && result.fileName) {
        // Import downloaded file into the database
        setPhase('importing')
        setProgress(95)

        const { trackId } = await importDownloadedTrack(
          result.fileData,
          result.fileName,
          result.filePath || '',
          category
        )

        setStatus('success')
        setProgress(100)
        setPhase('done')
        log('info', 'Download completed and imported', { url, fileName: result.fileName, trackId: String(trackId ?? '') })

        // Reset after showing success
        setTimeout(() => {
          setStatus('idle')
          setUrl('')
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
      log('error', 'Download failed', { url, error: message })
    }
  }

  // Non-Electron fallback
  if (!isElectron) {
    return (
      <div className="p-4 rounded-xl bg-surface-100/50 dark:bg-surface-800/50 border border-surface-200/60 dark:border-surface-700/60">
        <div className="flex items-center gap-3 text-surface-500">
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span className="text-[13px]">{t('download.notAvailable')}</span>
        </div>
      </div>
    )
  }

  const isDownloading = status === 'downloading' || status === 'installing'

  return (
    <div className="p-4 rounded-xl bg-surface-100/50 dark:bg-surface-800/50 border border-surface-200/60 dark:border-surface-700/60">
      <h3 className="text-[13px] font-semibold mb-3 text-surface-700 dark:text-surface-300">
        {t('download.title')}
      </h3>

      {/* URL input with platform icon */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          {/* Platform icon */}
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.51a4.5 4.5 0 00-1.242-7.244l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
              </svg>
            )}
          </div>
          <input
            type="text"
            placeholder={t('download.urlPlaceholder')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isDownloading}
            className="w-full pl-9 pr-3 py-2 text-[13px] rounded-lg border border-surface-200 dark:border-surface-700 bg-white/80 dark:bg-surface-800/80 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all disabled:opacity-50"
          />
        </div>

        <button
          onClick={handleDownload}
          disabled={!url.trim() || !platform || isDownloading}
          className="px-4 py-2 text-[13px] font-medium rounded-lg bg-primary-500 hover:bg-primary-600 text-white shadow-sm shadow-primary-500/20 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {isDownloading ? t('download.downloading') : t('download.download')}
        </button>
      </div>

      {/* Progress bar */}
      {isDownloading && (
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
        <div className="flex items-center gap-2 text-green-500 text-[13px]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t('download.success')}
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 text-red-500 text-[13px]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          {t('download.error', { error: errorMessage })}
        </div>
      )}
    </div>
  )
}
