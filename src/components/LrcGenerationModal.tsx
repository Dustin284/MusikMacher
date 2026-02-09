import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { useTranslation } from '../i18n/useTranslation'
import { useTrackStore } from '../store/useTrackStore'
import { create } from 'zustand'
import type { Track } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  track: Track | null
}

type ProgressPhase = 'idle' | 'checking' | 'installing' | 'generating' | 'complete' | 'error'

// Zustand store for progress — useState doesn't re-render from Electron
// contextBridge IPC callbacks, but Zustand's useSyncExternalStore does
const useLrcProgress = create<{ value: number }>(() => ({ value: 0 }))

export default function LrcGenerationModal({ isOpen, onClose, track }: Props) {
  const { t } = useTranslation()
  const updateTrackLyrics = useTrackStore(s => s.updateTrackLyrics)
  const progress = useLrcProgress(s => s.value)

  const [phase, setPhase] = useState<ProgressPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [hasWhisper, setHasWhisper] = useState<boolean | null>(null)
  const [cudaInfo, setCudaInfo] = useState<{ available: boolean; device?: string | null } | null>(null)
  const [installPhaseText, setInstallPhaseText] = useState('')

  // Check if Whisper and CUDA are available
  useEffect(() => {
    if (isOpen && window.electronAPI) {
      window.electronAPI.checkWhisper?.().then(setHasWhisper)
      window.electronAPI.checkCuda?.().then(setCudaInfo)
    }
  }, [isOpen])

  // Setup progress listener
  useEffect(() => {
    if (!window.electronAPI) return

    window.electronAPI.onLrcProgress?.((data: { percent: number; phase: string }) => {
      useLrcProgress.setState({ value: data.percent })
      setInstallPhaseText(data.phase)
      if (data.phase.includes('install') || data.phase.includes('Install') ||
          data.phase === 'downloading' || data.phase === 'extracting' || data.phase === 'verifying') {
        setPhase('installing')
      }
      if (data.phase === 'transcribing' || data.phase === 'loading') {
        setPhase('generating')
      }
      if (data.phase === 'done' && phase === 'installing') {
        setPhase('idle')
      }
    })
  }, [phase])

  const handleInstallWhisper = useCallback(async () => {
    if (!window.electronAPI?.installWhisper) return

    setPhase('installing')
    useLrcProgress.setState({ value: 0 })
    setError(null)

    try {
      const result = await window.electronAPI.installWhisper()
      const success = typeof result === 'object' ? result.success : result
      const errorMsg = typeof result === 'object' ? result.error : null

      if (success) {
        setHasWhisper(true)
        setPhase('idle')
      } else {
        setError(errorMsg || 'Installation fehlgeschlagen')
        setPhase('error')
      }
    } catch (err) {
      setError(String(err))
      setPhase('error')
    }
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!track?.id || !window.electronAPI?.generateLrc) return

    setPhase('generating')
    useLrcProgress.setState({ value: 0 })
    setError(null)

    try {
      const result = await window.electronAPI.generateLrc(track.id)

      if (result.success && result.lrc) {
        // Parse LRC to extract plain text lyrics
        const plainText = result.lrc
          .split('\n')
          .map((line: string) => line.replace(/^\[\d{2}:\d{2}\.\d{2,3}\]/, '').trim())
          .filter(Boolean)
          .join('\n')

        // Save both LRC and plain text
        await updateTrackLyrics(track.id, plainText, result.lrc)

        setPhase('complete')
        useLrcProgress.setState({ value: 100 })

        // Auto-close after success
        setTimeout(() => {
          onClose()
          setPhase('idle')
          useLrcProgress.setState({ value: 0 })
        }, 1500)
      } else {
        setError(result.error || 'LRC-Generierung fehlgeschlagen')
        setPhase('error')
      }
    } catch (err) {
      setError(String(err))
      setPhase('error')
    }
  }, [track, updateTrackLyrics, onClose])

  const handleClose = useCallback(() => {
    if (phase === 'generating' || phase === 'installing') return
    onClose()
    setPhase('idle')
    useLrcProgress.setState({ value: 0 })
    setError(null)
  }, [phase, onClose])

  const isProcessing = phase === 'checking' || phase === 'installing' || phase === 'generating'

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/20 backdrop-blur-lg" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-2xl bg-white/98 dark:bg-surface-850/98 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.12)]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b separator-sonoma">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              {t('lrc.title')}
            </DialogTitle>
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4">
            {/* Track info */}
            {track && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-100/50 dark:bg-surface-800/50">
                {track.artworkUrl ? (
                  <img src={track.artworkUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-surface-200 dark:bg-surface-700 flex items-center justify-center">
                    <svg className="w-6 h-6 text-surface-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{track.name}</div>
                  <div className="text-xs text-surface-500">{t('lrc.trackToTranscribe')}</div>
                </div>
              </div>
            )}

            {/* Whisper not installed */}
            {hasWhisper === false && phase !== 'installing' && (
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1">
                    <div className="font-medium text-amber-600 dark:text-amber-400">{t('lrc.needsInstall')}</div>
                    <div className="text-sm text-surface-600 dark:text-surface-400 mt-1">{t('lrc.installDesc')}</div>
                    <button
                      onClick={handleInstallWhisper}
                      className="mt-3 px-4 py-2 text-sm rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors"
                    >
                      {t('lrc.installWhisper')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Ready to generate */}
            {hasWhisper && phase === 'idle' && (
              <div className="space-y-3">
                {/* GPU Status */}
                <div className={`p-3 rounded-lg flex items-center gap-2 ${
                  cudaInfo?.available
                    ? 'bg-green-500/10 border border-green-500/20'
                    : 'bg-surface-100/50 dark:bg-surface-800/50'
                }`}>
                  {cudaInfo?.available ? (
                    <>
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <div className="text-sm font-medium text-green-600 dark:text-green-400">GPU-Beschleunigung aktiv</div>
                        <div className="text-xs text-surface-500">{cudaInfo.device}</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 text-surface-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <div className="text-sm font-medium">CPU-Modus</div>
                        <div className="text-xs text-surface-500">Keine NVIDIA GPU erkannt</div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Progress */}
            {isProcessing && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium">
                    {phase === 'installing' && t('lrc.installing')}
                    {phase === 'generating' && t('lrc.generating')}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
                  <div
                    className="h-full bg-primary-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-xs text-surface-500 text-center">
                  {Math.round(progress)}%
                  {installPhaseText && <span className="ml-2 opacity-70">({installPhaseText})</span>}
                </div>
              </div>
            )}

            {/* Success */}
            {phase === 'complete' && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">{t('lrc.complete')}</span>
              </div>
            )}

            {/* Error */}
            {phase === 'error' && error && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-start gap-2 text-red-600 dark:text-red-400">
                  <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <div className="font-medium">{t('lrc.error')}</div>
                    <div className="text-sm opacity-80 mt-0.5">{error}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 p-4 border-t separator-sonoma">
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className="px-5 py-2.5 text-[14px] rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors disabled:opacity-50"
            >
              {t('confirm.cancel')}
            </button>
            {hasWhisper && phase === 'idle' && (
              <button
                onClick={handleGenerate}
                className="px-5 py-2.5 text-[14px] rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors"
              >
                {t('lrc.start')}
              </button>
            )}
            {phase === 'error' && (
              <button
                onClick={() => { setPhase('idle'); setError(null) }}
                className="px-5 py-2.5 text-[14px] rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors"
              >
                {t('lrc.tryAgain')}
              </button>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
