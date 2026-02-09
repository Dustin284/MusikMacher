import { useMemo } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { useTranslation } from '../i18n/useTranslation'
import { cosineSimilarity } from '../utils/audioAnalysis'
import type { Track } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  track: Track | null
  allTracks: Track[]
  onPlay: (track: Track) => void
}

export default function SimilarTracksModal({ isOpen, onClose, track, allTracks, onPlay }: Props) {
  const { t } = useTranslation()

  const results = useMemo(() => {
    if (!track?.audioFeatures || track.audioFeatures.length === 0) return []

    return allTracks
      .filter(other => other.id !== track.id && other.audioFeatures && other.audioFeatures.length > 0)
      .map(other => ({
        track: other,
        similarity: cosineSimilarity(track.audioFeatures!, other.audioFeatures!),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10)
  }, [track, allTracks])

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-[9999]">
      <div className="fixed inset-0 bg-black/20 backdrop-blur-lg" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="mx-auto w-full max-w-xl rounded-2xl bg-white/98 dark:bg-surface-850/98 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.12)] ring-1 ring-black/10 dark:ring-white/10 p-7 max-h-[80vh] flex flex-col">
          <DialogTitle className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-1">
            {t('similar.title')}
          </DialogTitle>
          {track && (
            <p className="text-[13px] text-surface-500 mb-4 truncate">
              {track.name}
            </p>
          )}

          {results.length === 0 ? (
            <p className="text-[13px] text-surface-400 text-center py-8">
              {t('similar.noResults')}
            </p>
          ) : (
            <div className="flex-1 overflow-auto -mx-2">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-surface-100/90 dark:bg-surface-700/90 backdrop-blur-md text-surface-500 text-[11px] font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-2 py-1.5">{t('browse.name')}</th>
                    <th className="text-right px-2 py-1.5 w-16">{t('browse.bpm')}</th>
                    <th className="text-left px-2 py-1.5 w-14">{t('browse.key')}</th>
                    <th className="text-right px-2 py-1.5 w-14">{t('browse.energy')}</th>
                    <th className="text-left px-2 py-1.5 w-28">{t('similar.similarity')}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(({ track: other, similarity }) => (
                    <tr
                      key={other.id}
                      className="border-b border-surface-100/60 dark:border-surface-700/40 hover:bg-surface-100/80 dark:hover:bg-surface-700/40 cursor-pointer transition-colors"
                      onDoubleClick={() => { onPlay(other); onClose() }}
                    >
                      <td className="px-2 py-1.5 truncate max-w-[200px]">{other.name}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-mono text-[12px] text-surface-500">
                        {other.bpm ? Math.round(other.bpm) : '\u2014'}
                      </td>
                      <td className="px-2 py-1.5 text-[12px] text-surface-500">{other.musicalKey || '\u2014'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-mono text-[12px] text-surface-500">
                        {other.energy || '\u2014'}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-violet-500"
                              style={{ width: `${Math.round(similarity * 100)}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-surface-400 tabular-nums w-8 text-right">
                            {Math.round(similarity * 100)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end mt-4">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-[13px] font-medium rounded-xl bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600 transition-colors"
            >
              {t('app.close')}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
