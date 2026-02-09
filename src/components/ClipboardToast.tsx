import { useEffect, useState } from 'react'

interface ClipboardToastProps {
  url: string
  platform: string
  onDownload: () => void
  onDismiss: () => void
}

export default function ClipboardToast({ url, platform, onDownload, onDismiss }: ClipboardToastProps) {
  const [visible, setVisible] = useState(false)

  // Slide in on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Auto-dismiss after 8s
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300)
    }, 8000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  const handleDismiss = () => {
    setVisible(false)
    setTimeout(onDismiss, 300)
  }

  const handleDownload = () => {
    setVisible(false)
    setTimeout(onDownload, 300)
  }

  const platformLabel = platform === 'youtube' ? 'YouTube' : platform === 'soundcloud' ? 'SoundCloud' : 'Spotify'

  // Shorten URL for display
  const shortUrl = url.length > 50 ? url.slice(0, 50) + '...' : url

  return (
    <div
      className={`fixed bottom-5 right-5 z-50 max-w-sm w-full transition-all duration-300 ease-out ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-sonoma border-0 p-4 backdrop-blur-xl">
        {/* Header row */}
        <div className="flex items-start gap-3">
          {/* Platform icon */}
          <div className="shrink-0 mt-0.5">
            {platform === 'youtube' && (
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <svg className="w-4.5 h-4.5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </div>
            )}
            {platform === 'soundcloud' && (
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <svg className="w-4.5 h-4.5 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.05-.1-.1-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.172 1.282c.013.06.045.094.104.094.058 0 .09-.038.104-.094l.209-1.282-.209-1.332c-.014-.057-.046-.094-.104-.094m1.79-1.065c-.067 0-.12.054-.127.12l-.215 2.37.215 2.313c.007.066.06.12.126.12.066 0 .12-.054.127-.12l.248-2.313-.248-2.37c-.007-.066-.06-.12-.127-.12m.899-.213c-.077 0-.135.063-.142.14l-.197 2.583.197 2.529c.007.077.065.14.142.14s.135-.063.142-.14l.225-2.529-.225-2.583c-.007-.077-.065-.14-.142-.14m.904-.068c-.085 0-.15.07-.157.155l-.183 2.651.183 2.604c.007.085.072.155.157.155.084 0 .149-.07.156-.155l.21-2.604-.21-2.651c-.007-.085-.072-.155-.156-.155m.977-.133c-.096 0-.168.08-.176.175l-.162 2.784.162 2.736c.008.095.08.175.176.175.095 0 .168-.08.175-.175l.186-2.736-.186-2.784c-.007-.095-.08-.175-.175-.175m.99-.143c-.104 0-.183.088-.19.192l-.148 2.927.148 2.871c.007.104.086.192.19.192s.183-.088.19-.192l.169-2.871-.169-2.927c-.007-.104-.086-.192-.19-.192m1.063-.143c-.114 0-.2.096-.207.21l-.13 3.07.13 2.986c.007.114.093.21.207.21.113 0 .2-.096.206-.21l.15-2.986-.15-3.07c-.006-.114-.093-.21-.206-.21m1.048-.048c-.12 0-.213.103-.22.224l-.12 3.118.12 3.033c.007.12.1.224.22.224.12 0 .213-.104.22-.224l.138-3.033-.138-3.118c-.007-.12-.1-.224-.22-.224m1.06.015c-.13 0-.233.112-.24.243l-.103 3.103.103 3.026c.007.13.11.242.24.242.129 0 .232-.112.239-.242l.118-3.026-.118-3.103c-.007-.13-.11-.243-.24-.243m1.063-.088c-.14 0-.247.12-.254.259l-.09 3.191.09 3.074c.007.14.114.259.254.259.14 0 .247-.12.254-.259l.102-3.074-.102-3.191c-.007-.14-.114-.259-.254-.259m1.12-.182c-.148 0-.262.127-.27.275l-.073 3.373.074 3.18c.007.15.12.276.269.276.148 0 .262-.127.269-.276l.084-3.18-.084-3.373c-.007-.148-.121-.275-.269-.275m1.062.098c-.158 0-.278.136-.285.294l-.059 3.275.059 3.112c.007.158.127.294.285.294.157 0 .277-.136.285-.294l.068-3.112-.068-3.275c-.008-.158-.128-.294-.285-.294m1.13-.406c-.033 0-.065.003-.097.008a5.326 5.326 0 00-5.273-4.525c-.675 0-1.337.12-1.93.36-.227.092-.288.185-.288.368v8.887c.008.188.158.341.346.354h7.242a2.638 2.638 0 002.636-2.636 2.638 2.638 0 00-2.636-2.636" />
                </svg>
              </div>
            )}
            {platform === 'spotify' && (
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <svg className="w-4.5 h-4.5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-surface-800 dark:text-surface-200">
              {platformLabel}-Link erkannt
            </p>
            <p className="text-[11px] text-surface-500 truncate mt-0.5" title={url}>
              {shortUrl}
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="shrink-0 p-1 rounded-lg hover:bg-surface-200/80 dark:hover:bg-surface-700/80 transition-colors text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Download button */}
        <button
          onClick={handleDownload}
          className="w-full mt-3 flex items-center justify-center gap-2 px-3 py-2.5 text-[13px] font-semibold rounded-xl bg-primary-500 hover:bg-primary-600 text-white transition-all duration-200 active:scale-[0.98] shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Herunterladen
        </button>
      </div>
    </div>
  )
}
