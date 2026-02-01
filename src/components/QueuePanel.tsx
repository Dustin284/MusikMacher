import { usePlayerStore } from '../store/usePlayerStore'
import { useTranslation } from '../i18n/useTranslation'
import { formatTime } from '../utils/formatTime'

export default function QueuePanel() {
  const queue = usePlayerStore(s => s.queue)
  const removeFromQueue = usePlayerStore(s => s.removeFromQueue)
  const clearQueue = usePlayerStore(s => s.clearQueue)
  const play = usePlayerStore(s => s.play)
  const { t } = useTranslation()

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface-200/60 dark:border-surface-700/60">
        <span className="text-[12px] font-semibold text-surface-500 uppercase tracking-wider">
          {t('player.queue')} ({queue.length})
        </span>
        {queue.length > 0 && (
          <button
            onClick={clearQueue}
            className="text-[11px] text-red-500 hover:text-red-600 font-medium transition-colors"
          >
            {t('player.queueClear')}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {queue.length === 0 ? (
          <div className="flex items-center justify-center h-full text-surface-400 text-[13px]">
            {t('player.queueEmpty')}
          </div>
        ) : (
          <div className="divide-y divide-surface-200/40 dark:divide-surface-800/40">
            {queue.map((item, idx) => (
              <div
                key={`${item.trackId}-${idx}`}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-100/60 dark:hover:bg-surface-800/40 group cursor-pointer"
                onDoubleClick={() => {
                  removeFromQueue(idx)
                  play(item.track)
                }}
              >
                <span className="text-[11px] text-surface-400 w-5 text-right font-mono">{idx + 1}</span>
                <div className="w-6 h-6 rounded bg-surface-200 dark:bg-surface-700 flex items-center justify-center overflow-hidden shrink-0">
                  {item.track.artworkUrl ? (
                    <img src={item.track.artworkUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-3 h-3 text-surface-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                  )}
                </div>
                <span className="text-[13px] truncate flex-1">{item.track.name}</span>
                <span className="text-[11px] text-surface-400 font-mono tabular-nums">{formatTime(item.track.length)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFromQueue(idx) }}
                  className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-surface-200 dark:hover:bg-surface-700 transition-all"
                >
                  <svg className="w-3 h-3 text-surface-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
