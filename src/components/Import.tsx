import { useState, useRef, useEffect } from 'react'
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { useTrackStore } from '../store/useTrackStore'
import { useLibraryStore } from '../store/useLibraryStore'
import { useTranslation } from '../i18n/useTranslation'
import { CATEGORY_TRACKS } from '../types'
import { addImportLocation, getImportLocations, deleteImportLocation, updateImportLocation } from '../db/database'
import type { ImportLocation } from '../types'
import DownloadPanel from './DownloadPanel'
import { log } from '../utils/logger'

export default function Import() {
  const importTracks = useTrackStore(s => s.importTracks)
  const { t } = useTranslation()
  const libraries = useLibraryStore(s => s.libraries)
  const [importInto, setImportInto] = useState<number>(CATEGORY_TRACKS)
  const [subfoldersTag, setSubfoldersTag] = useState(true)
  const [rememberLocation, setRememberLocation] = useState(false)
  const [log_, setLog] = useState('')
  const [importing, setImporting] = useState(false)
  const [savedLocations, setSavedLocations] = useState<ImportLocation[]>([])
  const [syncing, setSyncing] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Load saved import locations
  useEffect(() => {
    getImportLocations().then(setSavedLocations)
  }, [])

  const handleImportFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setImporting(true)
    setLog(t('import.importing'))
    try {
      const result = await importTracks(files, importInto, subfoldersTag)
      setLog(prev => prev + result)
    } catch (err) {
      setLog(prev => prev + t('import.error', { error: String(err) }))
    } finally {
      setImporting(false)
    }
  }

  // Electron folder import with optional location saving
  const handleElectronFolderImport = async () => {
    if (!window.electronAPI?.selectDirectory) {
      folderInputRef.current?.click()
      return
    }

    const dirPath = await window.electronAPI.selectDirectory()
    if (!dirPath) return

    if (rememberLocation) {
      const id = await addImportLocation({
        path: dirPath,
        category: importInto,
        subfoldersTag,
        lastSyncAt: new Date().toISOString(),
      })
      const locations = await getImportLocations()
      setSavedLocations(locations)
      log('info', 'Import location saved', { path: dirPath, id })
    }

    await syncDirectory(dirPath)
  }

  const syncDirectory = async (dirPath: string) => {
    if (!window.electronAPI?.scanDirectory || !window.electronAPI?.readFile) return

    setImporting(true)
    setLog(t('import.importing'))

    try {
      const filePaths = await window.electronAPI.scanDirectory(dirPath)
      setLog(prev => prev + `Found ${filePaths.length} audio files\n`)

      const fileList: File[] = []
      for (const fp of filePaths) {
        const buffer = await window.electronAPI.readFile(fp)
        if (!buffer) continue
        const name = fp.split(/[/\\]/).pop() || 'unknown'
        const blob = new Blob([buffer])
        const file = new File([blob], name, { lastModified: Date.now() })
        fileList.push(file)
      }

      if (fileList.length > 0) {
        const dt = new DataTransfer()
        fileList.forEach(f => dt.items.add(f))
        const result = await importTracks(dt.files, importInto, subfoldersTag)
        setLog(prev => prev + result)
      } else {
        setLog(prev => prev + 'No new files to import.\n')
      }
    } catch (err) {
      setLog(prev => prev + t('import.error', { error: String(err) }))
    } finally {
      setImporting(false)
    }
  }

  const handleSyncLocation = async (loc: ImportLocation) => {
    if (!loc.id) return
    setSyncing(loc.id)
    await syncDirectory(loc.path)
    await updateImportLocation(loc.id, { lastSyncAt: new Date().toISOString() })
    const locations = await getImportLocations()
    setSavedLocations(locations)
    setSyncing(null)
  }

  const handleRemoveLocation = async (id: number) => {
    await deleteImportLocation(id)
    setSavedLocations(prev => prev.filter(l => l.id !== id))
  }

  const categories = libraries.map(lib => ({
    value: lib.id!,
    label: lib.name,
  }))

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI

  return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col gap-5 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold">{t('import.title')}</h2>
          <p className="text-[12px] text-surface-500">{t('import.subtitle')}</p>
        </div>
      </div>

      {/* Import destination */}
      <div className="bg-white/60 dark:bg-surface-800/40 backdrop-blur-sm rounded-xl p-4 border border-surface-200/60 dark:border-surface-800/60 flex flex-col gap-3">
        <div>
          <label className="text-[13px] font-medium mb-1.5 block text-surface-600 dark:text-surface-400">{t('import.importInto')}</label>
          <Listbox value={importInto} onChange={setImportInto}>
            <div className="relative">
              <ListboxButton className="relative w-full cursor-pointer rounded-lg border border-surface-200 dark:border-surface-700 bg-white/80 dark:bg-surface-800/80 py-2 pl-3 pr-10 text-left text-[13px] focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-all">
                <span>{categories.find(c => c.value === importInto)?.label || '—'}</span>
                <span className="absolute inset-y-0 right-0 flex items-center pr-2">
                  <svg className="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                  </svg>
                </span>
              </ListboxButton>
              <ListboxOptions className="absolute z-10 mt-1 w-full rounded-xl bg-white dark:bg-surface-800 shadow-xl ring-1 ring-black/5 dark:ring-white/10 py-1 text-[13px] backdrop-blur-xl">
                {categories.map((cat) => (
                  <ListboxOption key={cat.value} value={cat.value} className="cursor-pointer select-none px-3 py-2 data-[focus]:bg-primary-500/10 data-[selected]:font-semibold transition-colors">
                    {cat.label}
                  </ListboxOption>
                ))}
              </ListboxOptions>
            </div>
          </Listbox>
        </div>

        <label className="flex items-center gap-2 text-[13px] cursor-pointer text-surface-600 dark:text-surface-400">
          <input type="checkbox" checked={subfoldersTag} onChange={(e) => setSubfoldersTag(e.target.checked)} />
          {t('import.subfoldersTag')}
        </label>

        {isElectron && (
          <label className="flex items-center gap-2 text-[13px] cursor-pointer text-surface-600 dark:text-surface-400">
            <input type="checkbox" checked={rememberLocation} onChange={(e) => setRememberLocation(e.target.checked)} />
            {t('import.rememberLocation')}
          </label>
        )}
      </div>

      {/* Import buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-semibold rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 text-white hover:from-primary-500 hover:to-primary-700 disabled:opacity-50 transition-all duration-200 active:scale-[0.98] shadow-lg shadow-primary-500/20"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {t('import.selectFiles')}
        </button>
        <button
          onClick={isElectron ? handleElectronFolderImport : () => folderInputRef.current?.click()}
          disabled={importing}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-[13px] font-semibold rounded-xl border-2 border-surface-200 dark:border-surface-700 hover:border-primary-500/50 hover:bg-primary-500/5 disabled:opacity-50 transition-all duration-200 active:scale-[0.98]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          {t('import.selectFolder')}
        </button>
        <input ref={fileInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={(e) => handleImportFiles(e.target.files)} />
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <input ref={folderInputRef} type="file" {...{ webkitdirectory: '' } as any} multiple className="hidden" onChange={(e) => handleImportFiles(e.target.files)} />
      </div>

      {/* Saved import locations */}
      {savedLocations.length > 0 && (
        <div className="bg-white/60 dark:bg-surface-800/40 backdrop-blur-sm rounded-xl p-4 border border-surface-200/60 dark:border-surface-800/60">
          <h3 className="text-[12px] font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-3">
            {t('import.savedLocations')}
          </h3>
          <div className="space-y-2">
            {savedLocations.map((loc) => (
              <div key={loc.id} className="flex items-center gap-2 text-[13px]">
                <svg className="w-4 h-4 text-surface-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <span className="flex-1 truncate text-surface-700 dark:text-surface-300" title={loc.path}>{loc.path}</span>
                {loc.lastSyncAt && (
                  <span className="text-[10px] text-surface-400 shrink-0">
                    {t('import.lastSync')}: {new Date(loc.lastSyncAt).toLocaleDateString()}
                  </span>
                )}
                <button
                  onClick={() => handleSyncLocation(loc)}
                  disabled={syncing === loc.id}
                  className="px-2 py-1 text-[11px] font-medium rounded-md bg-primary-500/10 text-primary-600 dark:text-primary-400 hover:bg-primary-500/20 transition-colors disabled:opacity-50"
                >
                  {syncing === loc.id ? '...' : t('import.sync')}
                </button>
                <button
                  onClick={() => handleRemoveLocation(loc.id!)}
                  className="p-1 rounded-md text-surface-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Download panel (YouTube/SoundCloud) */}
      <DownloadPanel category={importInto} />

      {/* Log output */}
      <div className="flex-1 min-h-[120px] rounded-xl border border-surface-200/60 dark:border-surface-800/60 bg-surface-950/[0.03] dark:bg-surface-950/30 overflow-auto">
        <div className="p-1.5 border-b border-surface-200/60 dark:border-surface-800/60 flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
          <span className="ml-2 text-[10px] text-surface-400 font-mono">{t('import.logTitle')}</span>
        </div>
        <pre className="p-3 text-[12px] font-mono text-surface-600 dark:text-surface-400 whitespace-pre-wrap leading-relaxed">
          {log_ || t('import.ready')}
        </pre>
      </div>
    </div>
  )
}
