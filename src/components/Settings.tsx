import { useState, useEffect, useRef } from 'react'
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { useSettingsStore } from '../store/useSettingsStore'
import { useTranslation } from '../i18n/useTranslation'
import type { TranslationKey } from '../i18n/translations'
import { DEFAULT_SHORTCUTS, DEFAULT_VISIBLE_COLUMNS } from '../types'
import type { KeyboardShortcut, AppSettings } from '../types'
import LogViewer from './LogViewer'

// Shortcut action display names
const SHORTCUT_ACTIONS: { action: string; labelKey: string }[] = [
  { action: 'playPause', labelKey: 'shortcut.playPause' },
  { action: 'skipForward', labelKey: 'shortcut.skipForward' },
  { action: 'skipBackward', labelKey: 'shortcut.skipBackward' },
  { action: 'volumeUp', labelKey: 'shortcut.volumeUp' },
  { action: 'volumeDown', labelKey: 'shortcut.volumeDown' },
  { action: 'toggleQueue', labelKey: 'shortcut.toggleQueue' },
  { action: 'toggleLyrics', labelKey: 'shortcut.toggleLyrics' },
  { action: 'speedUp', labelKey: 'shortcut.speedUp' },
  { action: 'speedDown', labelKey: 'shortcut.speedDown' },
  { action: 'speedReset', labelKey: 'shortcut.speedReset' },
  { action: 'abLoopSet', labelKey: 'shortcut.abLoopSet' },
  { action: 'toggleEq', labelKey: 'shortcut.toggleEq' },
  { action: 'pitchUp', labelKey: 'shortcut.pitchUp' },
  { action: 'pitchDown', labelKey: 'shortcut.pitchDown' },
  { action: 'pitchReset', labelKey: 'shortcut.pitchReset' },
  { action: 'search', labelKey: 'shortcut.search' },
]
for (let i = 1; i <= 9; i++) {
  SHORTCUT_ACTIONS.push({ action: `cue${i}`, labelKey: `shortcut.cue` })
  SHORTCUT_ACTIONS.push({ action: `setCue${i}`, labelKey: `shortcut.setCue` })
}

const COLUMN_OPTIONS = [
  { value: 'name', labelKey: 'browse.name' },
  { value: 'duration', labelKey: 'browse.duration' },
  { value: 'bpm', labelKey: 'browse.bpm' },
  { value: 'key', labelKey: 'browse.key' },
  { value: 'rating', labelKey: 'browse.rating' },
  { value: 'created', labelKey: 'browse.created' },
  { value: 'tags', labelKey: 'browse.tags' },
  { value: 'comment', labelKey: 'browse.comment' },
]

export default function Settings() {
  const settings = useSettingsStore(s => s.settings)
  const update = useSettingsStore(s => s.update)
  const { t } = useTranslation()

  const [showLogs, setShowLogs] = useState(false)
  const [recordingAction, setRecordingAction] = useState<string | null>(null)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'none' | 'error'>('idle')
  const [updateInfo, setUpdateInfo] = useState<{ version?: string; url?: string } | null>(null)
  const [exportImportStatus, setExportImportStatus] = useState<'idle' | 'exported' | 'imported' | 'error'>('idle')

  const themes = [
    { value: 'dark' as const, label: t('settings.themeDark'), icon: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z' },
    { value: 'light' as const, label: t('settings.themeLight'), icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z' },
    { value: 'system' as const, label: t('settings.themeSystem'), icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  ]

  const languages = [
    { value: 'de-DE' as const, label: 'Deutsch' },
    { value: 'en-US' as const, label: 'English' },
  ]

  const tagModes = [
    { value: false, label: t('settings.tagModeOr') },
    { value: true, label: t('settings.tagModeAnd') },
  ]

  return (
    <div className="p-6 max-w-xl mx-auto overflow-y-auto h-full">
      <div className="flex flex-col gap-5">

        {/* Theme */}
        <Section title={t('settings.design')} icon="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01">
          <label className="text-[13px] font-medium mb-2 block text-surface-600 dark:text-surface-400">{t('settings.colorScheme')}</label>
          <div className="grid grid-cols-3 gap-2">
            {themes.map((th) => (
              <button
                key={th.value}
                onClick={() => update({ theme: th.value })}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 ${
                  settings.theme === th.value
                    ? 'border-primary-500 bg-primary-500/10 shadow-sm shadow-primary-500/10'
                    : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                }`}
              >
                <svg className={`w-5 h-5 ${settings.theme === th.value ? 'text-primary-500' : 'text-surface-400'}`} fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={th.icon} />
                </svg>
                <span className={`text-[12px] font-medium ${settings.theme === th.value ? 'text-primary-600 dark:text-primary-400' : 'text-surface-500'}`}>
                  {th.label}
                </span>
              </button>
            ))}
          </div>
        </Section>

        {/* Playback */}
        <Section title={t('settings.playback')} icon="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z">
          <div className="flex flex-col gap-4">
            <SliderField
              label={t('settings.startPosition')}
              value={settings.skipPosition}
              min={0} max={1} step={0.01}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => update({ skipPosition: v })}
            />
            <SliderField
              label={t('settings.skipDistance')}
              value={settings.skipPositionMovement}
              min={0.01} max={0.5} step={0.01}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => update({ skipPositionMovement: v })}
            />
            <Toggle label={t('settings.playEffectsFromStart')} checked={settings.playEffectsFromBeginning} onChange={(v) => update({ playEffectsFromBeginning: v })} />
            <Toggle label={t('settings.continuePlayback')} checked={settings.continuePlayback} onChange={(v) => update({ continuePlayback: v })} />
          </div>
        </Section>

        {/* Tags */}
        <Section title={t('settings.tags')} icon="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z">
          <SelectField
            value={settings.andTagCombination}
            options={tagModes}
            onChange={(v) => update({ andTagCombination: v })}
          />
        </Section>

        {/* Appearance */}
        <Section title={t('settings.appearance')} icon="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z">
          <label className="text-[13px] text-surface-500 mb-1.5 block">{t('settings.windowTitle')}</label>
          <input
            type="text"
            value={settings.windowTitle}
            onChange={(e) => update({ windowTitle: e.target.value })}
            className="w-full px-3 py-2 text-[13px] rounded-lg border border-surface-200 dark:border-surface-700 bg-white/80 dark:bg-surface-800/80 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
          />
        </Section>

        {/* Language */}
        <Section title={t('settings.language')} icon="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129">
          <SelectField
            value={settings.language}
            options={languages}
            onChange={(v) => update({ language: v })}
          />
        </Section>

        {/* Options */}
        <Section title={t('settings.options')} icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z">
          <div className="flex flex-col gap-4">
            <Toggle label={t('settings.loadCovers')} checked={settings.loadCovers} onChange={(v) => update({ loadCovers: v })} />
            <SliderField
              label={t('settings.crossfadeDuration')}
              value={settings.crossfadeDuration ?? 0}
              min={0} max={10} step={0.5}
              format={(v) => v === 0 ? t('settings.crossfadeOff') : `${(v ?? 0).toFixed(1)}s`}
              onChange={(v) => update({ crossfadeDuration: v })}
            />
          </div>
        </Section>

        {/* Keyboard Shortcuts */}
        <Section title={t('settings.shortcuts')} icon="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707">
          <ShortcutEditor
            shortcuts={settings.customShortcuts?.length > 0 ? settings.customShortcuts : DEFAULT_SHORTCUTS}
            recordingAction={recordingAction}
            setRecordingAction={setRecordingAction}
            onUpdate={(shortcuts) => update({ customShortcuts: shortcuts })}
            onReset={() => update({ customShortcuts: [] })}
            t={t}
          />
        </Section>

        {/* Auto Update */}
        <Section title={t('settings.autoUpdate')} icon="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  if (!window.electronAPI?.checkGithubUpdate) return
                  setUpdateStatus('checking')
                  try {
                    const result = await window.electronAPI.checkGithubUpdate('Dustin284/MusikMacher')
                    if (result.hasUpdate) {
                      setUpdateStatus('available')
                      setUpdateInfo({ version: result.latestVersion, url: result.downloadUrl })
                    } else if (result.error) {
                      setUpdateStatus('error')
                    } else {
                      setUpdateStatus('none')
                    }
                  } catch {
                    setUpdateStatus('error')
                  }
                  setTimeout(() => setUpdateStatus('idle'), 5000)
                }}
                disabled={updateStatus === 'checking'}
                className="px-3 py-1.5 text-[13px] font-medium rounded-lg bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-40 transition-colors"
              >
                {updateStatus === 'checking' ? '...' : t('settings.checkUpdate')}
              </button>
              {updateStatus === 'available' && updateInfo && (
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-green-500 font-medium">
                    v{updateInfo.version}
                  </span>
                  {updateInfo.url && (
                    <button
                      onClick={() => window.electronAPI?.openExternal?.(updateInfo.url!)}
                      className="text-[12px] text-primary-500 hover:text-primary-600 font-medium underline"
                    >
                      Download
                    </button>
                  )}
                </div>
              )}
              {updateStatus === 'none' && (
                <span className="text-[13px] text-surface-400">{t('settings.noUpdate')}</span>
              )}
              {updateStatus === 'error' && (
                <span className="text-[13px] text-red-500">{t('settings.updateError')}</span>
              )}
            </div>
          </div>
        </Section>

        {/* Export / Import */}
        <Section title={t('settings.exportImport')} icon="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4">
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-surface-500">{t('settings.exportImportDesc')}</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const json = JSON.stringify(settings, null, 2)
                  const blob = new Blob([json], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = `lorus-settings-${new Date().toISOString().slice(0, 10)}.json`
                  document.body.appendChild(link)
                  link.click()
                  document.body.removeChild(link)
                  URL.revokeObjectURL(url)
                  setExportImportStatus('exported')
                  setTimeout(() => setExportImportStatus('idle'), 3000)
                }}
                className="px-3 py-1.5 text-[13px] font-medium rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors"
              >
                {t('settings.exportBtn')}
              </button>
              <button
                onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = '.json'
                  input.onchange = async () => {
                    const file = input.files?.[0]
                    if (!file) return
                    try {
                      const text = await file.text()
                      const parsed = JSON.parse(text)
                      if (typeof parsed !== 'object' || parsed === null ||
                          typeof parsed.windowTitle !== 'string' ||
                          typeof parsed.language !== 'string' ||
                          typeof parsed.theme !== 'string' ||
                          typeof parsed.skipPosition !== 'number') {
                        setExportImportStatus('error')
                        setTimeout(() => setExportImportStatus('idle'), 3000)
                        return
                      }
                      await update(parsed as AppSettings)
                      setExportImportStatus('imported')
                      setTimeout(() => setExportImportStatus('idle'), 3000)
                    } catch {
                      setExportImportStatus('error')
                      setTimeout(() => setExportImportStatus('idle'), 3000)
                    }
                  }
                  input.click()
                }}
                className="px-3 py-1.5 text-[13px] font-medium rounded-lg border border-primary-500 text-primary-500 hover:bg-primary-500/10 transition-colors"
              >
                {t('settings.importBtn')}
              </button>
            </div>
            {exportImportStatus === 'exported' && (
              <span className="text-[13px] text-green-500 font-medium">{t('settings.exportSuccess')}</span>
            )}
            {exportImportStatus === 'imported' && (
              <span className="text-[13px] text-green-500 font-medium">{t('settings.importSuccess')}</span>
            )}
            {exportImportStatus === 'error' && (
              <span className="text-[13px] text-red-500 font-medium">{t('settings.importError')}</span>
            )}
          </div>
        </Section>

        {/* Logs */}
        <Section title={t('settings.logs')} icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="text-[13px] text-primary-500 hover:text-primary-600 transition-colors font-medium"
          >
            {showLogs ? t('settings.logs') : t('settings.showLogs')}
          </button>
          {showLogs && (
            <div className="mt-3 h-64">
              <LogViewer />
            </div>
          )}
        </Section>

        {/* Version */}
        <div className="text-center py-4">
          <p className="text-[13px] text-surface-500 font-medium">{t('settings.version')}</p>
          <p className="text-[11px] text-surface-400 mt-0.5">{t('settings.techStack')}</p>
        </div>
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
        <h3 className="text-[12px] font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
          {title}
        </h3>
      </div>
      <div className="bg-white/60 dark:bg-surface-800/40 backdrop-blur-sm rounded-xl p-4 border border-surface-200/60 dark:border-surface-800/60">
        {children}
      </div>
    </div>
  )
}

function SliderField({ label, value, min, max, step, format, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <label className="text-[13px] text-surface-600 dark:text-surface-400">{label}</label>
        <span className="text-[12px] font-mono text-primary-500 font-medium">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full" />
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-[13px] text-surface-600 dark:text-surface-400">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
          checked ? 'bg-primary-500' : 'bg-surface-300 dark:bg-surface-600'
        }`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`} />
      </button>
    </label>
  )
}

function SelectField<T>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void
}) {
  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative">
        <ListboxButton className="relative w-full cursor-pointer rounded-lg border border-surface-200 dark:border-surface-700 bg-white/80 dark:bg-surface-800/80 py-2 pl-3 pr-10 text-left text-[13px] focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all">
          <span>{options.find(o => o.value === value)?.label}</span>
          <span className="absolute inset-y-0 right-0 flex items-center pr-2">
            <svg className="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
            </svg>
          </span>
        </ListboxButton>
        <ListboxOptions className="absolute z-10 mt-1 w-full rounded-xl bg-white dark:bg-surface-800 shadow-xl ring-1 ring-black/5 dark:ring-white/10 py-1 text-[13px] max-h-60 overflow-auto focus:outline-none backdrop-blur-xl">
          {options.map((o, i) => (
            <ListboxOption key={i} value={o.value} className="cursor-pointer select-none px-3 py-2 data-[focus]:bg-primary-500/10 data-[selected]:font-semibold data-[selected]:text-primary-600 dark:data-[selected]:text-primary-400 transition-colors">
              {o.label}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  )
}

function ShortcutEditor({ shortcuts, recordingAction, setRecordingAction, onUpdate, onReset, t }: {
  shortcuts: KeyboardShortcut[]
  recordingAction: string | null
  setRecordingAction: (a: string | null) => void
  onUpdate: (shortcuts: KeyboardShortcut[]) => void
  onReset: () => void
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
}) {
  const recordRef = useRef<HTMLButtonElement>(null)

  // Listen for key input when recording
  useEffect(() => {
    if (!recordingAction) return
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const parts: string[] = []
      if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
      if (e.altKey) parts.push('Alt')
      if (e.shiftKey) parts.push('Shift')
      let key = e.key
      if (key === ' ') key = 'Space'
      // Normalize Shift+digit: e.key gives '!' instead of '1', use e.code
      if (e.shiftKey && e.code && /^Digit\d$/.test(e.code)) {
        key = e.code[5]
      }
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return
      parts.push(key)
      const combo = parts.join('+')

      const updated = shortcuts.map(s =>
        s.action === recordingAction ? { ...s, key: combo } : s
      )
      onUpdate(updated)
      setRecordingAction(null)
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [recordingAction, shortcuts, onUpdate, setRecordingAction])

  // Only show the most common shortcuts (not all cue variants)
  const mainShortcuts = SHORTCUT_ACTIONS.filter(a =>
    !a.action.match(/^(set)?cue[2-9]$/)
  )

  const getActionLabel = (action: string) => {
    const def = SHORTCUT_ACTIONS.find(a => a.action === action)
    if (!def) return action
    const n = action.match(/\d+$/)?.[0] || ''
    return t(def.labelKey as TranslationKey, { n })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="max-h-64 overflow-y-auto -mx-1">
        {mainShortcuts.map(({ action }) => {
          const shortcut = shortcuts.find(s => s.action === action)
          const key = shortcut?.key || ''
          const isRecording = recordingAction === action

          return (
            <div key={action} className="flex items-center justify-between py-1.5 px-1 hover:bg-surface-100/60 dark:hover:bg-surface-800/40 rounded-lg">
              <span className="text-[13px] text-surface-600 dark:text-surface-400">
                {getActionLabel(action)}
              </span>
              <button
                ref={isRecording ? recordRef : undefined}
                onClick={() => setRecordingAction(isRecording ? null : action)}
                className={`px-2 py-0.5 rounded-md text-[12px] font-mono min-w-[80px] text-center transition-all ${
                  isRecording
                    ? 'bg-primary-500/20 text-primary-500 ring-2 ring-primary-500/30 animate-pulse'
                    : 'bg-surface-200/60 dark:bg-surface-700/60 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                }`}
              >
                {isRecording ? t('settings.shortcutRecord') : key || '---'}
              </button>
            </div>
          )
        })}
      </div>
      <button
        onClick={onReset}
        className="text-[12px] text-primary-500 hover:text-primary-600 font-medium self-start transition-colors"
      >
        {t('settings.shortcutReset')}
      </button>
    </div>
  )
}
