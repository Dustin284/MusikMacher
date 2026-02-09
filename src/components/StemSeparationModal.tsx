import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogPanel, DialogTitle, RadioGroup } from '@headlessui/react'
import { useTranslation } from '../i18n/useTranslation'
import { useTrackStore } from '../store/useTrackStore'
import { create } from 'zustand'
import type { Track } from '../types'

interface Props {
  isOpen: boolean
  onClose: () => void
  track: Track | null
  category: number
}

type StemModel = '2' | '4' | '6'
type ProgressPhase = 'idle' | 'checking' | 'installing' | 'separating' | 'selecting' | 'importing' | 'complete' | 'error'

interface StemData {
  type: string
  fileName: string
  data: ArrayBuffer
}

interface StemSelection {
  type: string
  originalName: string
  customName: string
  selected: boolean
  data: ArrayBuffer
}

// Zustand store for progress - useState doesn't re-render from Electron
// contextBridge IPC callbacks, but Zustand's useSyncExternalStore does
const useStemProgress = create<{ value: number }>(() => ({ value: 0 }))

export default function StemSeparationModal({ isOpen, onClose, track, category }: Props) {
  const { t } = useTranslation()
  const importDownloadedTrack = useTrackStore(s => s.importDownloadedTrack)
  const progress = useStemProgress(s => s.value)

  const [model, setModel] = useState<StemModel>('4')
  const [phase, setPhase] = useState<ProgressPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [hasPython, setHasPython] = useState<boolean | null>(null)
  const [hasDemucs, setHasDemucs] = useState<boolean | null>(null)
  const [cudaInfo, setCudaInfo] = useState<{ available: boolean; device?: string | null } | null>(null)
  const [stemSelections, setStemSelections] = useState<StemSelection[]>([])

  // Check if Python, Demucs, and CUDA are installed
  useEffect(() => {
    if (isOpen && window.electronAPI) {
      window.electronAPI.checkPython?.().then(setHasPython)
      window.electronAPI.checkDemucs?.().then(setHasDemucs)
      window.electronAPI.checkCuda?.().then(setCudaInfo)
    }
  }, [isOpen])

  // Setup progress listeners
  const [installPhaseText, setInstallPhaseText] = useState<string>('')

  useEffect(() => {
    if (!window.electronAPI) return

    window.electronAPI.onDemucsProgress?.((data: { percent: number; phase: string }) => {
      console.log('[Demucs Progress]', data)
      useStemProgress.setState({ value: data.percent })
      setInstallPhaseText(data.phase)
      // Set phase to installing for any installation-related phase
      if (data.phase.includes('install') || data.phase.includes('Install') ||
          data.phase === 'downloading' || data.phase === 'extracting' || data.phase === 'verifying') {
        setPhase('installing')
      }
      if (data.phase === 'done') {
        setPhase('idle')
      }
    })

    window.electronAPI.onSeparationProgress?.((data: { percent: number; phase: string }) => {
      console.log('[Separation Progress]', data)
      useStemProgress.setState({ value: data.percent })
      if (data.phase === 'separating' || data.phase.includes('starting')) setPhase('separating')
      if (data.phase === 'done') setPhase('selecting')
    })
  }, [])

  const handleInstallDemucs = useCallback(async () => {
    if (!window.electronAPI?.installDemucs) return

    setPhase('installing')
    useStemProgress.setState({ value: 0 })
    setError(null)

    try {
      const result = await window.electronAPI.installDemucs()
      // Handle both old (boolean) and new (object) return format
      const success = typeof result === 'object' ? result.success : result
      const errorMsg = typeof result === 'object' ? result.error : null

      if (success) {
        setHasDemucs(true)
        setPhase('idle')
        // Refresh CUDA info after installation
        window.electronAPI.checkCuda?.().then(setCudaInfo)
      } else {
        setError(errorMsg || 'Installation fehlgeschlagen')
        setPhase('error')
      }
    } catch (err) {
      setError(String(err))
      setPhase('error')
    }
  }, [])

  const handleSeparate = useCallback(async () => {
    if (!track?.id || !window.electronAPI?.separateStems) return

    setPhase('separating')
    useStemProgress.setState({ value: 0 })
    setError(null)

    try {
      const result = await window.electronAPI.separateStems(track.id, model)

      if (result.success && result.stems) {
        // Prepare stem selections for user to choose
        const baseName = track.name.replace(/\.[^.]+$/, '')
        const selections: StemSelection[] = (result.stems as StemData[]).map(stem => ({
          type: stem.type,
          originalName: stem.fileName,
          customName: `${baseName} (${stem.type})`,
          selected: true,
          data: stem.data,
        }))

        setStemSelections(selections)
        setPhase('selecting')
        useStemProgress.setState({ value: 100 })
      } else {
        setError(result.error || 'Separation failed')
        setPhase('error')
      }
    } catch (err) {
      setError(String(err))
      setPhase('error')
    }
  }, [track, model])

  // Import selected stems with custom names
  const handleImportSelected = useCallback(async () => {
    const selectedStems = stemSelections.filter(s => s.selected)
    if (selectedStems.length === 0) return

    setPhase('importing')
    useStemProgress.setState({ value: 0 })

    try {
      for (let i = 0; i < selectedStems.length; i++) {
        const stem = selectedStems[i]
        const fileName = `${stem.customName}.mp3`
        await importDownloadedTrack(stem.data, fileName, '', category)
        useStemProgress.setState({ value: Math.round(((i + 1) / selectedStems.length) * 100) })
      }

      setPhase('complete')
      useStemProgress.setState({ value: 100 })

      // Auto-close after success
      setTimeout(() => {
        onClose()
        setPhase('idle')
        useStemProgress.setState({ value: 0 })
        setStemSelections([])
      }, 1500)
    } catch (err) {
      setError(String(err))
      setPhase('error')
    }
  }, [stemSelections, category, importDownloadedTrack, onClose])

  // Toggle stem selection
  const toggleStemSelection = useCallback((index: number) => {
    setStemSelections(prev => prev.map((s, i) =>
      i === index ? { ...s, selected: !s.selected } : s
    ))
  }, [])

  // Update custom name
  const updateStemName = useCallback((index: number, name: string) => {
    setStemSelections(prev => prev.map((s, i) =>
      i === index ? { ...s, customName: name } : s
    ))
  }, [])

  const handleClose = useCallback(() => {
    if (phase === 'separating' || phase === 'installing' || phase === 'importing') return // Don't close during processing
    onClose()
    setPhase('idle')
    useStemProgress.setState({ value: 0 })
    setError(null)
    setStemSelections([])
  }, [phase, onClose])

  const isProcessing = phase === 'checking' || phase === 'installing' || phase === 'separating' || phase === 'importing'

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/20 backdrop-blur-lg" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-2xl bg-white/98 dark:bg-surface-850/98 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.12)]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b separator-sonoma">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              {t('stemSeparation.title')}
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
                  <div className="text-xs text-surface-500">{t('stemSeparation.trackToSeparate')}</div>
                </div>
              </div>
            )}

            {/* Python not found */}
            {hasPython === false && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1">
                    <div className="font-medium text-red-600 dark:text-red-400">{t('stemSeparation.noPython')}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Demucs installation check */}
            {hasPython && hasDemucs === false && phase !== 'installing' && (
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="flex-1">
                    <div className="font-medium text-amber-600 dark:text-amber-400">{t('stemSeparation.needsInstall')}</div>
                    <div className="text-sm text-surface-600 dark:text-surface-400 mt-1">{t('stemSeparation.installDesc')}</div>
                    <button
                      onClick={handleInstallDemucs}
                      className="mt-3 px-4 py-2 text-sm rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors"
                    >
                      {t('stemSeparation.installDemucs')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Model selection */}
            {hasPython && hasDemucs && phase === 'idle' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('stemSeparation.selectModel')}</label>
                  <RadioGroup value={model} onChange={setModel} className="space-y-2">
                    <RadioGroup.Option value="2">
                      {({ checked }) => (
                        <div className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          checked
                            ? 'border-primary-500 bg-primary-500/10'
                            : 'border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800'
                        }`}>
                          <div className="font-medium">{t('stemSeparation.model2')}</div>
                          <div className="text-xs text-surface-500 mt-0.5">Vocals, Instrumental</div>
                        </div>
                      )}
                    </RadioGroup.Option>
                    <RadioGroup.Option value="4">
                      {({ checked }) => (
                        <div className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          checked
                            ? 'border-primary-500 bg-primary-500/10'
                            : 'border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800'
                        }`}>
                          <div className="font-medium">{t('stemSeparation.model4')}</div>
                          <div className="text-xs text-surface-500 mt-0.5">Vocals, Drums, Bass, Other</div>
                        </div>
                      )}
                    </RadioGroup.Option>
                    <RadioGroup.Option value="6">
                      {({ checked }) => (
                        <div className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          checked
                            ? 'border-primary-500 bg-primary-500/10'
                            : 'border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800'
                        }`}>
                          <div className="font-medium">{t('stemSeparation.model6')}</div>
                          <div className="text-xs text-surface-500 mt-0.5">+ Guitar, Piano</div>
                        </div>
                      )}
                    </RadioGroup.Option>
                  </RadioGroup>
                </div>

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

            {/* Stem Selection */}
            {phase === 'selecting' && stemSelections.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-medium">{t('stemSeparation.selectStems')}</div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {stemSelections.map((stem, index) => (
                    <div
                      key={stem.type}
                      className={`p-3 rounded-lg border transition-all ${
                        stem.selected
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-surface-200 dark:border-surface-700 opacity-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleStemSelection(index)}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            stem.selected
                              ? 'bg-primary-500 border-primary-500'
                              : 'border-surface-300 dark:border-surface-600'
                          }`}
                        >
                          {stem.selected && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>

                        {/* Stem type label */}
                        <div className="w-16 text-xs font-medium uppercase text-surface-500">
                          {stem.type}
                        </div>

                        {/* Custom name input */}
                        <input
                          type="text"
                          value={stem.customName}
                          onChange={(e) => updateStemName(index, e.target.value)}
                          disabled={!stem.selected}
                          className={`flex-1 px-2 py-1 text-sm rounded border bg-transparent transition-colors ${
                            stem.selected
                              ? 'border-surface-300 dark:border-surface-600 focus:border-primary-500 focus:outline-none'
                              : 'border-transparent'
                          }`}
                          placeholder={stem.originalName}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-surface-500 text-center">
                  {stemSelections.filter(s => s.selected).length} von {stemSelections.length} ausgewählt
                </div>
              </div>
            )}

            {/* Progress */}
            {isProcessing && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium">
                    {phase === 'installing' && t('stemSeparation.installing')}
                    {phase === 'separating' && t('stemSeparation.separating')}
                    {phase === 'importing' && t('stemSeparation.importing')}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-200 dark:bg-surface-700 overflow-hidden">
                  <div
                    className="h-full bg-primary-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="text-xs text-surface-500 text-center">{Math.round(progress)}%</div>
              </div>
            )}

            {/* Success */}
            {phase === 'complete' && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">{t('stemSeparation.complete')}</span>
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
                    <div className="font-medium">{t('stemSeparation.error')}</div>
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
            {hasPython && hasDemucs && phase === 'idle' && (
              <button
                onClick={handleSeparate}
                className="px-5 py-2.5 text-[14px] rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors"
              >
                {t('stemSeparation.start')}
              </button>
            )}
            {phase === 'selecting' && (
              <button
                onClick={handleImportSelected}
                disabled={stemSelections.filter(s => s.selected).length === 0}
                className="px-5 py-2.5 text-[14px] rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('stemSeparation.importSelected')} ({stemSelections.filter(s => s.selected).length})
              </button>
            )}
            {phase === 'error' && (
              <button
                onClick={() => { setPhase('idle'); setError(null); setStemSelections([]) }}
                className="px-5 py-2.5 text-[14px] rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors"
              >
                {t('stemSeparation.tryAgain')}
              </button>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
