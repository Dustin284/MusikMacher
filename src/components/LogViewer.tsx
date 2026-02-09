import { useState, useEffect, useRef } from 'react'
import { useTranslation } from '../i18n/useTranslation'
import { getLogs, clearLogs, type LogEntry } from '../utils/logger'

export default function LogViewer() {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<LogEntry[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)

  // Poll for new log entries
  useEffect(() => {
    const refresh = () => {
      setEntries(getLogs())
    }

    refresh()
    const interval = setInterval(refresh, 1000)
    return () => clearInterval(interval)
  }, [])

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries.length])

  // Detect if user has scrolled away from bottom
  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 40
  }

  const handleClear = () => {
    clearLogs()
    setEntries([])
  }

  const levelColor = (level: string): string => {
    switch (level) {
      case 'debug':
        return 'text-surface-400 dark:text-surface-500'
      case 'info':
        return 'text-blue-500 dark:text-blue-400'
      case 'warn':
        return 'text-amber-500 dark:text-amber-400'
      case 'error':
        return 'text-red-500 dark:text-red-400'
      default:
        return 'text-surface-500'
    }
  }

  const levelBadgeBg = (level: string): string => {
    switch (level) {
      case 'debug':
        return 'bg-surface-200/30 dark:bg-surface-700/30'
      case 'info':
        return 'bg-blue-500/10'
      case 'warn':
        return 'bg-amber-500/10'
      case 'error':
        return 'bg-red-500/10'
      default:
        return 'bg-surface-200/30 dark:bg-surface-700/30'
    }
  }

  const formatTimestamp = (ts: string): string => {
    try {
      const date = new Date(ts)
      const h = date.getHours().toString().padStart(2, '0')
      const m = date.getMinutes().toString().padStart(2, '0')
      const s = date.getSeconds().toString().padStart(2, '0')
      const ms = date.getMilliseconds().toString().padStart(3, '0')
      return `${h}:${m}:${s}.${ms}`
    } catch {
      return ts
    }
  }

  return (
    <div className="flex flex-col h-full rounded-xl bg-surface-100/50 dark:bg-surface-800/50 border-0 shadow-sonoma overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b separator-sonoma shrink-0">
        <h3 className="text-[13px] font-semibold text-surface-700 dark:text-surface-300">
          {t('log.title')}
        </h3>
        <button
          onClick={handleClear}
          className="px-2.5 py-1 text-[11px] font-medium rounded-xl text-surface-500 hover:bg-surface-200/30 dark:hover:bg-surface-700/30 transition-colors"
        >
          {t('log.clear')}
        </button>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2 space-y-0.5"
      >
        {entries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-surface-400 dark:text-surface-600 text-[12px]">
            {t('log.empty')}
          </div>
        ) : (
          entries.map((entry, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 px-2 py-1 rounded-md hover:bg-surface-200/40 dark:hover:bg-surface-700/30 transition-colors font-mono text-[11px] leading-relaxed"
            >
              {/* Timestamp */}
              <span className="text-surface-400 dark:text-surface-600 shrink-0 tabular-nums">
                {formatTimestamp(entry.timestamp)}
              </span>

              {/* Level badge */}
              <span
                className={`px-1.5 py-0 rounded text-[10px] font-bold uppercase shrink-0 ${levelColor(entry.level)} ${levelBadgeBg(entry.level)}`}
              >
                {entry.level}
              </span>

              {/* Message */}
              <span className="text-surface-700 dark:text-surface-300 break-all">
                {entry.message}
                {entry.data !== undefined && (
                  <span className="text-surface-400 dark:text-surface-600 ml-1.5">
                    {typeof entry.data === 'string'
                      ? entry.data
                      : JSON.stringify(entry.data)}
                  </span>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
