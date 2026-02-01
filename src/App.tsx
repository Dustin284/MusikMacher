import { useEffect, useRef, useState } from 'react'
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import { useSettingsStore } from './store/useSettingsStore'
import { useLibraryStore } from './store/useLibraryStore'
import { useProjectStore } from './store/useProjectStore'
import { useTranslation } from './i18n/useTranslation'
import { CATEGORY_TRACKS, CATEGORY_EFFECTS, DEFAULT_SHORTCUTS } from './types'
import Browse from './components/Browse'
import Import from './components/Import'
import PremiereLoader from './components/PremiereLoader'
import Settings from './components/Settings'

const fixedTabIcons = [
  'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
  'M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z',
  'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
]

const fixedTabKeys = ['tabs.import', 'tabs.premiere', 'tabs.settings'] as const

const libraryIcons: Record<string, string> = {
  music: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3',
  speaker: 'M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z',
  folder: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  star: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
}

export default function App() {
  const settings = useSettingsStore(s => s.settings)
  const loaded = useSettingsStore(s => s.loaded)
  const load = useSettingsStore(s => s.load)
  const libraries = useLibraryStore(s => s.libraries)
  const librariesLoaded = useLibraryStore(s => s.loaded)
  const loadLibraries = useLibraryStore(s => s.loadLibraries)
  const addLib = useLibraryStore(s => s.addLibrary)
  const removeLib = useLibraryStore(s => s.removeLibrary)
  const projects = useProjectStore(s => s.projects)
  const loadProjects = useProjectStore(s => s.loadProjects)
  const selectedProjectId = useProjectStore(s => s.selectedProjectId)
  const setSelectedProject = useProjectStore(s => s.setSelectedProject)
  const addProj = useProjectStore(s => s.addProject)
  const { t } = useTranslation()
  const [selectedTab, setSelectedTab] = useState(0)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [githubUpdateUrl, setGithubUpdateUrl] = useState<string | null>(null)
  const [githubUpdateVersion, setGithubUpdateVersion] = useState<string | null>(null)
  const [githubChangelog, setGithubChangelog] = useState<string | null>(null)
  const [showChangelog, setShowChangelog] = useState(false)
  const [promptDialog, setPromptDialog] = useState<{ title: string; onSubmit: (v: string) => void } | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)

  useEffect(() => {
    // Request persistent storage so IndexedDB data survives between sessions
    navigator.storage?.persist?.().catch(() => {})
    load()
  }, [])

  useEffect(() => {
    if (loaded) {
      loadLibraries()
      loadProjects()
    }
  }, [loaded])

  useEffect(() => {
    document.title = settings.windowTitle || 'Lorus Musik Macher'
  }, [settings.windowTitle])

  // Listen for auto-update events
  useEffect(() => {
    if (window.electronAPI?.onUpdateAvailable) {
      window.electronAPI.onUpdateAvailable(() => setUpdateAvailable(true))
    }
  }, [])

  // Ensure default libraries exist on first load with empty DB
  useEffect(() => {
    if (librariesLoaded && libraries.length === 0) {
      addLib('Songs').then(() => addLib('Effekte'))
    }
  }, [librariesLoaded])

  // Check GitHub releases on startup
  useEffect(() => {
    if (!loaded || !window.electronAPI?.checkGithubUpdate) return
    window.electronAPI.checkGithubUpdate('Dustin284/MusikMacher').then(result => {
      if (result.hasUpdate && result.downloadUrl) {
        setUpdateAvailable(true)
        setGithubUpdateUrl(result.downloadUrl)
        setGithubUpdateVersion(result.latestVersion || null)
        if (result.body) {
          setGithubChangelog(result.body)
          setShowChangelog(true)
        }
      }
    }).catch(() => {})
  }, [loaded])

  // Shortcuts overlay toggle (Shift + ?)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && e.shiftKey) {
        setShowShortcuts(s => !s)
      }
      if (e.key === 'Escape' && showShortcuts) {
        setShowShortcuts(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showShortcuts])

  if (!loaded) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
          <span className="text-surface-400 text-sm">{t('app.loading')}</span>
        </div>
      </div>
    )
  }

  // Build tab list: libraries first, then fixed tabs (Import, Premiere, Settings)
  const libraryTabs = libraries.length > 0 ? libraries : [
    { id: CATEGORY_TRACKS, name: 'Songs', icon: 'music', order: 0, isOpen: true },
    { id: CATEGORY_EFFECTS, name: 'Effekte', icon: 'speaker', order: 1, isOpen: true },
  ]

  const totalTabs = libraryTabs.length + fixedTabKeys.length

  return (
    <div className="h-full flex flex-col bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-100 noise relative overflow-hidden">
      {/* Ambient gradient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-1/2 -right-1/4 w-[600px] h-[600px] rounded-full bg-primary-500/5 dark:bg-primary-500/[0.03] blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/4 w-[500px] h-[500px] rounded-full bg-accent-500/5 dark:bg-accent-500/[0.02] blur-3xl" />
      </div>

      {/* Update banner */}
      {updateAvailable && (
        <div className="bg-primary-500 text-white text-[12px] text-center py-1 px-3 z-20 relative flex items-center justify-center gap-3">
          <span
            className="cursor-pointer hover:underline"
            onClick={() => {
              if (githubUpdateUrl) {
                window.electronAPI?.openExternal?.(githubUpdateUrl)
              } else {
                window.electronAPI?.installUpdate?.()
              }
            }}
          >
            {githubUpdateVersion
              ? `${t('app.updateAvailable')} (v${githubUpdateVersion})`
              : t('app.updateAvailable')
            }
          </span>
          {githubChangelog && (
            <button
              onClick={() => setShowChangelog(true)}
              className="px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 text-[11px] font-medium transition-colors"
            >
              Changelog
            </button>
          )}
        </div>
      )}

      {/* Title bar */}
      <div className="h-11 shrink-0 flex items-center px-4 border-b border-surface-200/80 dark:border-surface-800/80 bg-white/60 dark:bg-surface-900/60 backdrop-blur-xl select-none relative z-10"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-sm">
            <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
          <span className="text-[13px] font-semibold tracking-tight">{settings.windowTitle}</span>
        </div>

        {/* Project selector */}
        <div className="ml-4 flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <select
            value={selectedProjectId ?? ''}
            onChange={(e) => setSelectedProject(e.target.value ? Number(e.target.value) : null)}
            className="text-[11px] bg-transparent border border-surface-300/60 dark:border-surface-700/60 rounded-md px-2 py-0.5 text-surface-600 dark:text-surface-400 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
          >
            <option value="">{t('project.all')}</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={() => setPromptDialog({ title: t('project.name'), onSubmit: (name) => addProj(name) })}
            className="p-0.5 rounded hover:bg-surface-200/80 dark:hover:bg-surface-800/80 transition-colors text-surface-400"
            title={t('project.new')}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>

      </div>

      {/* Tab layout - using static panels so Browse stays mounted */}
      <TabGroup selectedIndex={selectedTab} onChange={(idx) => {
        setSelectedTab(idx)
        requestAnimationFrame(() => (document.activeElement as HTMLElement)?.blur())
      }} manual className="flex-1 flex flex-col min-h-0 relative z-10">
        <TabList className="flex shrink-0 border-b border-surface-200/60 dark:border-surface-800/60 bg-white/40 dark:bg-surface-900/40 backdrop-blur-lg px-1 gap-0.5">
          {/* Library tabs */}
          {libraryTabs.map((lib, idx) => (
            <Tab
              key={`lib-${lib.id}`}
              className="group relative px-3 py-2.5 text-[13px] font-medium outline-none transition-all duration-200
                data-[selected]:text-primary-600 dark:data-[selected]:text-primary-400
                text-surface-500 hover:text-surface-700 dark:hover:text-surface-300
                focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded-lg my-1"
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 opacity-60 group-data-[selected]:opacity-100 transition-opacity" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={libraryIcons[lib.icon || 'music'] || libraryIcons.music} />
                </svg>
                {lib.name}
                {libraries.length > 1 && lib.id !== 1 && lib.id !== 2 && (
                  <span
                    role="button"
                    onMouseDown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      removeLib(lib.id!)
                      if (selectedTab >= libraries.length - 1) setSelectedTab(Math.max(0, selectedTab - 1))
                    }}
                    className="ml-0.5 p-0.5 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-surface-200/80 dark:hover:bg-surface-700/80 transition-all cursor-pointer"
                    title={t('app.removeLibrary')}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </span>
                )}
              </span>
              <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary-500 scale-x-0 group-data-[selected]:scale-x-100 transition-transform duration-200 origin-center" />
            </Tab>
          ))}

          {/* Add library button */}
          <button
            onClick={() => setPromptDialog({ title: t('app.newLibraryName'), onSubmit: (name) => addLib(name) })}
            className="px-2 py-2.5 text-surface-400 hover:text-primary-500 transition-colors my-1"
            title={t('app.newLibrary')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>

          {/* Separator */}
          <div className="w-px bg-surface-200/60 dark:bg-surface-800/60 my-2 mx-1" />

          {/* Fixed tabs: Import, Premiere, Settings */}
          {fixedTabKeys.map((key, idx) => (
            <Tab
              key={key}
              className="group relative px-3 py-2.5 text-[13px] font-medium outline-none transition-all duration-200
                data-[selected]:text-primary-600 dark:data-[selected]:text-primary-400
                text-surface-500 hover:text-surface-700 dark:hover:text-surface-300
                focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded-lg my-1"
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4 opacity-60 group-data-[selected]:opacity-100 transition-opacity" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={fixedTabIcons[idx]} />
                </svg>
                {t(key)}
              </span>
              <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary-500 scale-x-0 group-data-[selected]:scale-x-100 transition-transform duration-200 origin-center" />
            </Tab>
          ))}
        </TabList>

        <TabPanels className="flex-1 min-h-0">
          {/* Library panels - static so keyboard listeners survive tab switches */}
          {libraryTabs.map((lib, idx) => (
            <TabPanel key={`panel-${lib.id}`} static className={`h-full ${selectedTab !== idx ? 'hidden' : ''}`}>
              <Browse category={lib.id!} isActive={selectedTab === idx} />
            </TabPanel>
          ))}

          {/* Fixed panels - also static */}
          <TabPanel static className={`h-full ${selectedTab !== libraryTabs.length ? 'hidden' : ''}`}>
            <Import />
          </TabPanel>
          <TabPanel static className={`h-full ${selectedTab !== libraryTabs.length + 1 ? 'hidden' : ''}`}>
            <PremiereLoader />
          </TabPanel>
          <TabPanel static className={`h-full ${selectedTab !== libraryTabs.length + 2 ? 'hidden' : ''}`}>
            <Settings />
          </TabPanel>
        </TabPanels>
      </TabGroup>

      {/* Prompt dialog (replaces window.prompt which is blocked in Electron) */}
      {promptDialog && (
        <PromptDialog
          title={promptDialog.title}
          onSubmit={(value) => { promptDialog.onSubmit(value); setPromptDialog(null) }}
          onCancel={() => setPromptDialog(null)}
        />
      )}

      {/* Changelog modal */}
      {showChangelog && githubChangelog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowChangelog(false)}>
          <div
            className="bg-white dark:bg-surface-800 rounded-xl shadow-2xl border border-surface-200/60 dark:border-surface-700/60 p-6 w-[480px] max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold">
                {githubUpdateVersion ? `Changelog — v${githubUpdateVersion}` : 'Changelog'}
              </h2>
              <button onClick={() => setShowChangelog(false)} className="p-1 rounded-lg hover:bg-surface-200/80 dark:hover:bg-surface-700/80 transition-colors">
                <svg className="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto text-[13px] text-surface-700 dark:text-surface-300 whitespace-pre-wrap leading-relaxed">
              {githubChangelog}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowChangelog(false)}
                className="px-3 py-1.5 text-[12px] rounded-lg border border-surface-300/60 dark:border-surface-600/60 text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700/50 transition-colors"
              >
                {t('app.close')}
              </button>
              {githubUpdateUrl && (
                <button
                  onClick={() => window.electronAPI?.openExternal?.(githubUpdateUrl)}
                  className="px-3 py-1.5 text-[12px] rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                >
                  {t('app.updateAvailable')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Keyboard shortcuts overlay (Shift+?) */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
          <div
            className="bg-white dark:bg-surface-800 rounded-xl shadow-2xl border border-surface-200/60 dark:border-surface-700/60 p-6 w-96 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold">{t('settings.shortcuts')}</h2>
              <button onClick={() => setShowShortcuts(false)} className="p-1 rounded-lg hover:bg-surface-200/80 dark:hover:bg-surface-700/80 transition-colors">
                <svg className="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5">
              {(settings.customShortcuts?.length > 0 ? settings.customShortcuts : DEFAULT_SHORTCUTS)
                .filter(s => !s.action.match(/^(set)?cue[2-9]$/))
                .map(s => (
                <div key={s.action} className="contents">
                  <span className="text-[13px] text-surface-600 dark:text-surface-400">{s.action}</span>
                  <kbd className="px-2 py-0.5 rounded bg-surface-200/60 dark:bg-surface-700/60 text-[11px] font-mono text-surface-600 dark:text-surface-400 text-right">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-surface-400 mt-4 text-center">
              Shift+? to toggle
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function PromptDialog({ title, onSubmit, onCancel }: { title: string; onSubmit: (v: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (trimmed) onSubmit(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="bg-white dark:bg-surface-800 rounded-xl shadow-2xl border border-surface-200/60 dark:border-surface-700/60 p-5 w-80"
        onClick={(e) => e.stopPropagation()}
      >
        <label className="block text-[13px] font-medium text-surface-700 dark:text-surface-300 mb-2">{title}</label>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onCancel() }}
          className="w-full px-3 py-2 text-[13px] rounded-lg border border-surface-200 dark:border-surface-700 bg-white/80 dark:bg-surface-900/80 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="px-3 py-1.5 text-[13px] rounded-lg text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors">
            {/* Cancel */}
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="px-4 py-1.5 text-[13px] font-medium rounded-lg bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-40 transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
