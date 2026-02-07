import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useTrackStore } from '../store/useTrackStore'
import { usePlayerStore } from '../store/usePlayerStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { useProjectStore } from '../store/useProjectStore'
import { useSmartPlaylistStore } from '../store/useSmartPlaylistStore'
import { useTranslation } from '../i18n/useTranslation'
import { formatTime } from '../utils/formatTime'
import { getAudioBlob, getFavoriteTracks, updateTrack as dbUpdateTrack } from '../db/database'
import TagAssignmentPopover from './TagAssignmentPopover'
import TrackContextMenu from './TrackContextMenu'
import StemSeparationModal from './StemSeparationModal'
import CompatibleTracksModal from './CompatibleTracksModal'
import SimilarTracksModal from './SimilarTracksModal'
import type { Track } from '../types'

const ROW_HEIGHT = 41
const OVERSCAN = 20

type SortField = 'name' | 'length' | 'createdAt' | 'comment' | 'bpm' | 'musicalKey' | 'rating' | 'energy' | 'artist' | 'album' | 'year'

interface TrackGridProps {
  category: number
  isActive: boolean
}

export default function TrackGrid({ category, isActive }: TrackGridProps) {
  const tracks = useTrackStore(s => s.tracks)
  const tags = useTrackStore(s => s.tags)
  const searchTerm = useTrackStore(s => s.searchTerm)
  const setSearchTerm = useTrackStore(s => s.setSearchTerm)
  const showHidden = useTrackStore(s => s.showHidden)
  const setShowHidden = useTrackStore(s => s.setShowHidden)
  const updateTrackComment = useTrackStore(s => s.updateTrackComment)
  const hideTrack = useTrackStore(s => s.hideTrack)
  const unhideTrack = useTrackStore(s => s.unhideTrack)
  const deleteTrackFromStore = useTrackStore(s => s.deleteTrack)
  const updateTrackBPM = useTrackStore(s => s.updateTrackBPM)
  const updateTrackKey = useTrackStore(s => s.updateTrackKey)
  const updateTrackRating = useTrackStore(s => s.updateTrackRating)
  const updateTrackCuePoints = useTrackStore(s => s.updateTrackCuePoints)
  const updateTrackEnergy = useTrackStore(s => s.updateTrackEnergy)
  const updateTrackAudioFeatures = useTrackStore(s => s.updateTrackAudioFeatures)
  const updateTrackArtist = useTrackStore(s => s.updateTrackArtist)
  const updateTrackAlbum = useTrackStore(s => s.updateTrackAlbum)
  const updateTrackYear = useTrackStore(s => s.updateTrackYear)
  const analyzeTrack = useTrackStore(s => s.analyzeTrack)
  const addNewTag = useTrackStore(s => s.addNewTag)
  const addTrackToTag = useTrackStore(s => s.addTrackToTag)
  const removeTrackFromTag = useTrackStore(s => s.removeTrackFromTag)
  const importTracks = useTrackStore(s => s.importTracks)
  const findDuplicates = useTrackStore(s => s.findDuplicates)
  const settings = useSettingsStore(s => s.settings)
  const updateSettings = useSettingsStore(s => s.update)
  const toggleFavorite = useTrackStore(s => s.toggleFavorite)
  const setTrackProject = useTrackStore(s => s.setTrackProject)
  const selectedProjectId = useProjectStore(s => s.selectedProjectId)
  const projects = useProjectStore(s => s.projects)
  const { playlists, activePlaylistId, evaluatePlaylist } = useSmartPlaylistStore()
  const activePlaylist = playlists.find(p => p.id === activePlaylistId)
  const play = usePlayerStore(s => s.play)
  const addToQueue = usePlayerStore(s => s.addToQueue)
  const currentTrackId = usePlayerStore(s => s.currentTrack?.id)
  const isPlaying = usePlayerStore(s => s.isPlaying)
  const { t, language } = useTranslation()

  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null)
  const [editingComment, setEditingComment] = useState('')
  const [editingArtistId, setEditingArtistId] = useState<number | null>(null)
  const [editingArtist, setEditingArtist] = useState('')
  const [editingAlbumId, setEditingAlbumId] = useState<number | null>(null)
  const [editingAlbum, setEditingAlbum] = useState('')
  const [editingYearId, setEditingYearId] = useState<number | null>(null)
  const [editingYear, setEditingYear] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track: Track } | null>(null)
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<number>>(new Set())
  const batchMode = selectedTrackIds.size > 0
  const [duplicateIds, setDuplicateIds] = useState<Set<number> | null>(null)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [identifyingTrackId, setIdentifyingTrackId] = useState<number | null>(null)
  const [stemSeparationTrack, setStemSeparationTrack] = useState<Track | null>(null)
  const [compatibleTrack, setCompatibleTrack] = useState<Track | null>(null)
  const [similarTrack, setSimilarTrack] = useState<Track | null>(null)
  const [analyzeProgress, setAnalyzeProgress] = useState<{
    current: number
    total: number
    currentName: string
    startedAt: number
  } | null>(null)
  const analyzeCancelRef = useRef(false)
  const tableRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCountRef = useRef(0)
  const draggingTrackRef = useRef<{ id: number; name: string } | null>(null)
  const nativeDragStartedRef = useRef(false)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewHeight, setViewHeight] = useState(800)

  const tagMap = useMemo(() => new Map(tags.map(t => [t.id!, t])), [tags])

  const visibleColumns = settings.visibleColumns || ['name', 'duration', 'bpm', 'key', 'rating', 'tags', 'comment']
  const isColVisible = (col: string) => visibleColumns.includes(col)

  const filteredTracks = useMemo(() => {
    const activeTags = tags.filter(t => t.isChecked)
    const terms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean)

    // If smart playlist is active, get matching tracks first
    let basePool = tracks
    if (activePlaylist) {
      basePool = evaluatePlaylist(activePlaylist, tracks, tags)
    }

    return basePool.filter(track => {
      if (selectedProjectId !== null && track.projectId !== selectedProjectId) return false
      if (!showHidden && track.isHidden) return false
      if (showFavoritesOnly && !track.isFavorite) return false
      if (terms.length > 0) {
        const nameLC = track.name.toLowerCase()
        const commentLC = track.comment.toLowerCase()
        const artistLC = (track.artist || '').toLowerCase()
        if (!terms.every(t => nameLC.includes(t) || commentLC.includes(t) || artistLC.includes(t))) return false
      }
      if (activeTags.length > 0) {
        if (settings.andTagCombination) {
          return activeTags.every(tag => track.tagIds.includes(tag.id!))
        } else {
          return activeTags.some(tag => track.tagIds.includes(tag.id!))
        }
      }
      return true
    })
  }, [tracks, tags, searchTerm, showHidden, showFavoritesOnly, settings.andTagCombination, selectedProjectId, activePlaylist, evaluatePlaylist])

  const sortedTracks = useMemo(() => {
    const base = duplicateIds ? filteredTracks.filter(t => duplicateIds.has(t.id!)) : filteredTracks
    const sorted = [...base]
    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break
        case 'length': cmp = a.length - b.length; break
        case 'createdAt': cmp = a.createdAt.localeCompare(b.createdAt); break
        case 'comment': cmp = a.comment.localeCompare(b.comment); break
        case 'bpm': cmp = (a.bpm || 0) - (b.bpm || 0); break
        case 'musicalKey': cmp = (a.musicalKey || '').localeCompare(b.musicalKey || ''); break
        case 'rating': cmp = (a.rating || 0) - (b.rating || 0); break
        case 'energy': cmp = (a.energy || 0) - (b.energy || 0); break
        case 'artist': cmp = (a.artist || '').localeCompare(b.artist || ''); break
        case 'album': cmp = (a.album || '').localeCompare(b.album || ''); break
        case 'year': cmp = (a.year || '').localeCompare(b.year || ''); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [filteredTracks, sortField, sortDir, duplicateIds])

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  // Arrow key navigation - only when active
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isActive) return
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const newIdx = Math.min(selectedIndex + 1, sortedTracks.length - 1)
      setSelectedIndex(newIdx)
      if (newIdx >= 0 && newIdx < sortedTracks.length) play(sortedTracks[newIdx])
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const newIdx = Math.max(selectedIndex - 1, 0)
      setSelectedIndex(newIdx)
      if (newIdx >= 0 && newIdx < sortedTracks.length) play(sortedTracks[newIdx])
    } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < sortedTracks.length) {
      e.preventDefault()
      play(sortedTracks[selectedIndex])
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault()
      searchRef.current?.focus()
      searchRef.current?.select()
    }
  }, [sortedTracks, selectedIndex, play, isActive])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Scroll selected row into view (calculated position, no DOM query)
  useEffect(() => {
    if (selectedIndex >= 0 && tableRef.current) {
      const el = tableRef.current
      const targetTop = selectedIndex * ROW_HEIGHT
      const headerH = 36
      if (targetTop < el.scrollTop) {
        el.scrollTop = targetTop
      } else if (targetTop + ROW_HEIGHT > el.scrollTop + el.clientHeight - headerH) {
        el.scrollTop = targetTop + ROW_HEIGHT - el.clientHeight + headerH
      }
    }
  }, [selectedIndex])

  // Track scroll position + container size for virtualization
  useEffect(() => {
    const el = tableRef.current
    if (!el) return
    const onScroll = () => setScrollTop(el.scrollTop)
    const ro = new ResizeObserver((entries) => {
      setViewHeight(entries[0].contentRect.height)
    })
    el.addEventListener('scroll', onScroll, { passive: true })
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
    }
  }, [])

  // Virtual range — only render visible rows + overscan
  const startRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const endRow = Math.min(sortedTracks.length, Math.ceil((scrollTop + viewHeight) / ROW_HEIGHT) + OVERSCAN)
  const padTop = startRow * ROW_HEIGHT
  const padBottom = Math.max(0, (sortedTracks.length - endRow) * ROW_HEIGHT)

  const startEditComment = (track: Track) => {
    setEditingCommentId(track.id!)
    setEditingComment(track.comment)
  }

  const finishEditComment = () => {
    if (editingCommentId !== null) updateTrackComment(editingCommentId, editingComment)
    setEditingCommentId(null)
  }

  const startEditArtist = (track: Track) => {
    setEditingArtistId(track.id!)
    setEditingArtist(track.artist || '')
  }

  const finishEditArtist = () => {
    if (editingArtistId !== null) updateTrackArtist(editingArtistId, editingArtist)
    setEditingArtistId(null)
  }

  const startEditAlbum = (track: Track) => {
    setEditingAlbumId(track.id!)
    setEditingAlbum(track.album || '')
  }

  const finishEditAlbum = () => {
    if (editingAlbumId !== null) updateTrackAlbum(editingAlbumId, editingAlbum)
    setEditingAlbumId(null)
  }

  const startEditYear = (track: Track) => {
    setEditingYearId(track.id!)
    setEditingYear(track.year || '')
  }

  const finishEditYear = () => {
    if (editingYearId !== null) updateTrackYear(editingYearId, editingYear)
    setEditingYearId(null)
  }

  // Prepare drag file on mousedown (main process copies from disk cache, no data transfer)
  const handleTrackMouseDown = (track: Track) => {
    if (!window.electronAPI?.prepareDrag) return
    window.electronAPI.prepareDrag(track.id!, track.name)
  }

  // Drag start - set dataTransfer for internal drops (tag assignment)
  // Electron native drag is triggered later when cursor exits the window
  const handleDragStart = (e: React.DragEvent, track: Track) => {
    draggingTrackRef.current = { id: track.id!, name: track.name }
    nativeDragStartedRef.current = false
    e.dataTransfer.setData('application/x-track-id', String(track.id))
    e.dataTransfer.effectAllowed = 'copyMove'
  }

  const handleDragEnd = useCallback(() => {
    draggingTrackRef.current = null
    nativeDragStartedRef.current = false
  }, [])

  // Detect when drag leaves the browser window -> start Electron native file drag
  useEffect(() => {
    const handleDocDragLeave = (e: DragEvent) => {
      if (!draggingTrackRef.current || nativeDragStartedRef.current) return
      // relatedTarget is null when drag exits the viewport
      if (e.relatedTarget === null && window.electronAPI?.startDrag) {
        nativeDragStartedRef.current = true
        window.electronAPI.startDrag(draggingTrackRef.current.id, draggingTrackRef.current.name)
      }
    }
    document.addEventListener('dragleave', handleDocDragLeave)
    return () => document.removeEventListener('dragleave', handleDocDragLeave)
  }, [])


  const handleExport = async (track: Track) => {
    if (!window.electronAPI) return
    const blob = await getAudioBlob(track.id!)
    if (!blob) return
    const arrayBuffer = await blob.arrayBuffer()
    await window.electronAPI.saveFile(track.name, arrayBuffer)
  }

  const handleAddFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    await importTracks(files, category, false)
  }

  const handleAnalyze = async (track: Track) => {
    await analyzeTrack(track.id!)
  }

  // Batch operations
  const handleBatchDelete = async () => {
    for (const id of selectedTrackIds) {
      if (selectedProjectId !== null) {
        await setTrackProject(id, undefined)
      } else {
        await deleteTrackFromStore(id)
      }
    }
    setSelectedTrackIds(new Set())
  }

  const handleBatchRate = (rating: number) => {
    for (const id of selectedTrackIds) {
      updateTrackRating(id, rating)
    }
  }

  const handleBatchAddToQueue = () => {
    for (const id of selectedTrackIds) {
      const track = tracks.find(t => t.id === id)
      if (track) addToQueue(track)
    }
    setSelectedTrackIds(new Set())
  }

  const handleIdentifyTrack = async (track: Track) => {
    if (!window.electronAPI || !track.id) return
    setIdentifyingTrackId(track.id)
    try {
      const fp = await window.electronAPI.generateFingerprint?.(track.id)
      if (!fp) { setIdentifyingTrackId(null); return }
      const apiKey = settings.acoustidApiKey
      if (!apiKey) { setIdentifyingTrackId(null); return }
      const result = await window.electronAPI.acoustidLookup?.(fp.fingerprint, fp.duration, apiKey)
      if (result?.title && result?.artist) {
        const newName = `${result.artist} - ${result.title}`
        await dbUpdateTrack(track.id, { name: newName })
        const { loadTracks: lt } = useTrackStore.getState()
        lt(category)
      }
    } catch { /* identification failed */ }
    setIdentifyingTrackId(null)
  }

  function formatEta(startedAt: number, current: number, total: number): string {
    if (current < 2) return ''
    const elapsed = Date.now() - startedAt
    const msPerTrack = elapsed / current
    const remaining = msPerTrack * (total - current)
    const seconds = Math.ceil(remaining / 1000)
    if (seconds < 60) return `~${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `~${minutes}m ${secs}s`
  }

  const handleAnalyzeAll = async () => {
    const tracksToAnalyze = sortedTracks
    const total = tracksToAnalyze.length
    if (total === 0) return
    analyzeCancelRef.current = false
    const startedAt = Date.now()
    for (let i = 0; i < total; i++) {
      if (analyzeCancelRef.current) break
      const track = tracksToAnalyze[i]
      setAnalyzeProgress({ current: i + 1, total, currentName: track.name, startedAt })
      await handleAnalyze(track)
    }
    setAnalyzeProgress(null)
  }

  // Event delegation for tbody clicks
  const handleTbodyClick = useCallback((e: React.MouseEvent<HTMLTableSectionElement>) => {
    const tr = (e.target as HTMLElement).closest('tr[data-index]') as HTMLElement | null
    if (!tr) return
    const idx = parseInt(tr.dataset.index!, 10)
    if (isNaN(idx)) return

    // Ctrl+Click for multi-select
    if (e.ctrlKey || e.metaKey) {
      const track = sortedTracks[idx]
      if (track?.id) {
        setSelectedTrackIds(prev => {
          const next = new Set(prev)
          if (next.has(track.id!)) next.delete(track.id!)
          else next.add(track.id!)
          return next
        })
      }
      return
    }

    setSelectedIndex(idx)
  }, [sortedTracks])

  const handleTbodyDoubleClick = useCallback((e: React.MouseEvent<HTMLTableSectionElement>) => {
    const tr = (e.target as HTMLElement).closest('tr[data-index]') as HTMLElement | null
    if (!tr) return
    const idx = parseInt(tr.dataset.index!, 10)
    if (isNaN(idx) || idx >= sortedTracks.length) return
    play(sortedTracks[idx])
  }, [sortedTracks, play])

  const handleTbodyContextMenu = useCallback((e: React.MouseEvent<HTMLTableSectionElement>) => {
    const tr = (e.target as HTMLElement).closest('tr[data-index]') as HTMLElement | null
    if (!tr) return
    const idx = parseInt(tr.dataset.index!, 10)
    if (isNaN(idx) || idx >= sortedTracks.length) return
    e.preventDefault()
    setSelectedIndex(idx)
    setContextMenu({ x: e.clientX, y: e.clientY, track: sortedTracks[idx] })
  }, [sortedTracks])

  const handleFileDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCountRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true)
    }
  }, [])

  const handleFileDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCountRef.current--
    if (dragCountRef.current <= 0) {
      dragCountRef.current = 0
      setIsDragOver(false)
    }
  }, [])

  const handleFileDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCountRef.current = 0
    setIsDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      handleAddFiles(e.dataTransfer.files)
    }
  }, [category])

  const getTagNames = (track: Track) =>
    track.tagIds.map(id => tagMap.get(id)?.name).filter(Boolean).join(', ')

  const dateLocale = language === 'en-US' ? 'en-US' : 'de-DE'
  const searchPlaceholder = category === 2 ? t('browse.searchPlaceholderEffects') : t('browse.searchPlaceholder')
  const noTracksText = category === 2 ? t('browse.noEffects') : t('browse.noTracks')

  const SortHeader = ({ field, children, className = '' }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <th
      className={`px-2.5 py-2 cursor-pointer select-none group/sort transition-colors hover:text-primary-500 ${className}`}
      onClick={() => handleSort(field)}
    >
      <span className="flex items-center gap-1">
        {children}
        <span className={`transition-opacity ${sortField === field ? 'opacity-100 text-primary-500' : 'opacity-0 group-hover/sort:opacity-40'}`}>
          {sortField === field && sortDir === 'desc' ? '\u25BC' : '\u25B2'}
        </span>
      </span>
    </th>
  )

  const addFilesTitle = category === 2 ? t('browse.addFilesEffects') : t('browse.addFiles')

  return (
    <div
      className="flex-1 flex flex-col min-w-0 relative"
      onDragEnter={handleFileDragEnter}
      onDragLeave={handleFileDragLeave}
      onDragOver={handleFileDragOver}
      onDrop={handleFileDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={(e) => { handleAddFiles(e.target.files); e.target.value = '' }}
      />

      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-primary-500/10 dark:bg-primary-500/[0.07] border-2 border-dashed border-primary-500/50 rounded-xl flex items-center justify-center pointer-events-none backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 text-primary-500">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="text-sm font-semibold">{t('browse.dropHere')}</span>
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <TrackContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          track={tracks.find(t => t.id === contextMenu.track.id) ?? contextMenu.track}
          onClose={() => setContextMenu(null)}
          onPlay={(track) => play(track)}
          onExport={(track) => handleExport(track)}
          onEditComment={(track) => startEditComment(track)}
          onToggleHidden={(track) => track.isHidden ? unhideTrack(track.id!) : hideTrack(track.id!)}
          onDelete={(track) => selectedProjectId !== null ? setTrackProject(track.id!, undefined) : deleteTrackFromStore(track.id!)}
          onAnalyze={handleAnalyze}
          onAddToQueue={(track) => addToQueue(track)}
          onRate={(track, rating) => updateTrackRating(track.id!, rating)}
          onToggleFavorite={(track) => toggleFavorite(track.id!)}
          onIdentifyTrack={settings.acoustidApiKey ? handleIdentifyTrack : undefined}
          onSeparateStems={(track) => setStemSeparationTrack(track)}
          onFindCompatible={(track) => setCompatibleTrack(track)}
          onFindSimilar={(track) => setSimilarTrack(track)}
          tags={tags}
          onTagToggle={(trackId, tagId, add) => {
            if (add) addTrackToTag(trackId, tagId)
            else removeTrackFromTag(trackId, tagId)
          }}
          projects={projects}
          onProjectAssign={(trackId, projectId) => setTrackProject(trackId, projectId)}
          inProject={selectedProjectId !== null}
        />
      )}

      {/* Stem Separation Modal */}
      <StemSeparationModal
        isOpen={stemSeparationTrack !== null}
        onClose={() => setStemSeparationTrack(null)}
        track={stemSeparationTrack}
        category={category}
      />

      {/* Compatible Tracks Modal */}
      <CompatibleTracksModal
        isOpen={compatibleTrack !== null}
        onClose={() => setCompatibleTrack(null)}
        track={compatibleTrack}
        allTracks={tracks}
        onPlay={(track) => play(track)}
      />

      {/* Similar Tracks Modal */}
      <SimilarTracksModal
        isOpen={similarTrack !== null}
        onClose={() => setSimilarTrack(null)}
        track={similarTrack}
        allTracks={tracks}
        onPlay={(track) => play(track)}
      />

      {/* Search bar */}
      <div className="p-2.5 flex items-center gap-2.5">
        <div className="relative flex-1">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-[13px] rounded-lg border border-surface-200 dark:border-surface-700 bg-white/80 dark:bg-surface-800/80 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-surface-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-all duration-150 active:scale-95 shadow-sm shadow-primary-500/20 shrink-0"
          title={addFilesTitle}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
        <button
          onClick={() => {
            if (duplicateIds) {
              setDuplicateIds(null)
              return
            }
            const { groups } = findDuplicates()
            const ids = new Set<number>()
            for (const group of groups) {
              for (const track of group) {
                if (track.id) ids.add(track.id)
              }
            }
            setDuplicateIds(ids.size > 0 ? ids : null)
          }}
          className={`p-1.5 rounded-lg transition-all duration-150 active:scale-95 shrink-0 ${
            duplicateIds ? 'bg-amber-500/20 text-amber-500' : 'hover:bg-surface-200/80 dark:hover:bg-surface-800/80 text-surface-400'
          }`}
          title={t('duplicates.title')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
        <button
          onClick={handleAnalyzeAll}
          disabled={analyzeProgress !== null || sortedTracks.length === 0}
          className={`p-1.5 rounded-lg transition-all duration-150 active:scale-95 shrink-0 ${
            analyzeProgress !== null
              ? 'bg-primary-500/20 text-primary-500'
              : 'hover:bg-surface-200/80 dark:hover:bg-surface-800/80 text-surface-400'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          title={t('batch.analyzeAll')}
        >
          {analyzeProgress !== null ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zm0-8v2h14V9H7z" />
            </svg>
          )}
        </button>
        <label className="text-[11px] flex items-center gap-1.5 text-surface-500 cursor-pointer shrink-0">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
          {t('browse.hidden')}
        </label>
        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`p-1.5 rounded-lg transition-all duration-150 active:scale-95 shrink-0 ${
            showFavoritesOnly ? 'bg-red-500/20 text-red-500' : 'hover:bg-surface-200/80 dark:hover:bg-surface-800/80 text-surface-400'
          }`}
          title={t('browse.favorites')}
        >
          <svg className="w-4 h-4" fill={showFavoritesOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
        <div className="relative">
          <button
            onClick={() => setShowColumnSettings(!showColumnSettings)}
            className={`p-1.5 rounded-lg transition-all duration-150 active:scale-95 shrink-0 ${
              showColumnSettings ? 'bg-primary-500/20 text-primary-500' : 'hover:bg-surface-200/80 dark:hover:bg-surface-800/80 text-surface-400'
            }`}
            title={t('browse.columnSettings')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          {showColumnSettings && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-surface-800 rounded-xl shadow-xl ring-1 ring-black/10 dark:ring-white/10 p-3 min-w-[160px]">
              <div className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-2">{t('browse.columns')}</div>
              {[
                { value: 'name', label: t('browse.name') },
                { value: 'artist', label: t('browse.artist') },
                { value: 'album', label: t('browse.album') },
                { value: 'year', label: t('browse.year') },
                { value: 'duration', label: t('browse.duration') },
                { value: 'bpm', label: t('browse.bpm') },
                { value: 'key', label: t('browse.key') },
                { value: 'rating', label: t('browse.rating') },
                { value: 'created', label: t('browse.created') },
                { value: 'tags', label: t('browse.tags') },
                { value: 'energy', label: t('browse.energy') },
                { value: 'comment', label: t('browse.comment') },
              ].map(col => (
                <label key={col.value} className="flex items-center gap-2 py-1 text-[13px] text-surface-600 dark:text-surface-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(col.value)}
                    disabled={col.value === 'name'}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...visibleColumns, col.value]
                        : visibleColumns.filter(c => c !== col.value)
                      updateSettings({ visibleColumns: next })
                    }}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Batch bar or Track count */}
      {batchMode ? (
        <div className="px-3 pb-1.5 flex items-center gap-2">
          <span className="text-[11px] text-primary-500 font-semibold">
            {t('batch.selected', { count: selectedTrackIds.size })}
          </span>
          <button onClick={() => setSelectedTrackIds(new Set())} className="text-[11px] text-surface-400 hover:text-surface-600 transition-colors">
            {t('batch.deselectAll')}
          </button>
          <button onClick={() => setSelectedTrackIds(new Set(sortedTracks.map(t => t.id!)))} className="text-[11px] text-surface-400 hover:text-surface-600 transition-colors">
            {t('batch.selectAll')}
          </button>
          <div className="flex-1" />
          <button onClick={handleBatchAddToQueue} className="px-2 py-0.5 text-[11px] rounded bg-primary-500/10 text-primary-500 hover:bg-primary-500/20 transition-colors font-medium">
            {t('player.queueAdd')}
          </button>
          <div className="flex items-center gap-px">
            {[1, 2, 3, 4, 5].map(star => (
              <button key={star} onClick={() => handleBatchRate(star)} className="p-0">
                <svg className="w-3.5 h-3.5 text-surface-300 dark:text-surface-600 hover:text-amber-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            ))}
          </div>
          <button onClick={handleBatchDelete} className="px-2 py-0.5 text-[11px] rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors font-medium">
            {t('batch.delete')}
          </button>
        </div>
      ) : (
        <div className="px-3 pb-1.5 text-[11px] text-surface-400 dark:text-surface-500 font-medium">
          {sortedTracks.length === 1 ? t('browse.trackCountOne') : t('browse.trackCount', { count: sortedTracks.length })}
        </div>
      )}

      {/* Analyze progress bar */}
      {analyzeProgress && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[12px] text-surface-600 dark:text-surface-400 truncate flex-1">
              {t('batch.analyzing', { current: String(analyzeProgress.current), total: String(analyzeProgress.total), name: analyzeProgress.currentName })}
            </span>
            <span className="text-[12px] text-surface-500 tabular-nums font-mono shrink-0">
              {Math.round((analyzeProgress.current / analyzeProgress.total) * 100)}%
            </span>
            <button
              onClick={() => { analyzeCancelRef.current = true }}
              className="px-2 py-0.5 text-[11px] rounded bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors font-medium shrink-0"
            >
              {t('batch.analyzeCancel')}
            </button>
          </div>
          <div className="w-full h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${(analyzeProgress.current / analyzeProgress.total) * 100}%` }}
            />
          </div>
          {formatEta(analyzeProgress.startedAt, analyzeProgress.current, analyzeProgress.total) && (
            <div className="text-[11px] text-surface-400 mt-0.5">
              {t('batch.analyzeEta', { time: formatEta(analyzeProgress.startedAt, analyzeProgress.current, analyzeProgress.total) })}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto" ref={tableRef}>
        {sortedTracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-surface-400 dark:text-surface-600 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-surface-200/50 dark:bg-surface-800/50 flex items-center justify-center">
              <svg className="w-8 h-8 opacity-50" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <p className="text-sm font-medium">{noTracksText}</p>
            <button
              onClick={() => { setSearchTerm(''); useTrackStore.getState().resetTags() }}
              className="text-xs text-primary-500 hover:text-primary-600 font-medium transition-colors"
            >
              {t('browse.resetFilters')}
            </button>
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 bg-surface-100/90 dark:bg-surface-900/90 backdrop-blur-md border-b border-surface-200/60 dark:border-surface-800/60 z-10">
              <tr className="text-surface-500 text-[11px] font-semibold uppercase tracking-wider">
                <th className="w-9 px-1 py-2" />
                <SortHeader field="name" className="text-left">{t('browse.name')}</SortHeader>
                {isColVisible('artist') && <SortHeader field="artist" className="text-left w-28">{t('browse.artist')}</SortHeader>}
                {isColVisible('album') && <SortHeader field="album" className="text-left w-28">{t('browse.album')}</SortHeader>}
                {isColVisible('year') && <SortHeader field="year" className="text-left w-14">{t('browse.year')}</SortHeader>}
                {isColVisible('duration') && <SortHeader field="length" className="text-right w-20">{t('browse.duration')}</SortHeader>}
                {isColVisible('bpm') && <SortHeader field="bpm" className="text-right w-16">{t('browse.bpm')}</SortHeader>}
                {isColVisible('key') && <SortHeader field="musicalKey" className="text-left w-16">{t('browse.key')}</SortHeader>}
                {isColVisible('energy') && <SortHeader field="energy" className="text-right w-16">{t('browse.energy')}</SortHeader>}
                {isColVisible('rating') && <SortHeader field="rating" className="text-center w-24">{t('browse.rating')}</SortHeader>}
                {isColVisible('created') && <SortHeader field="createdAt" className="text-left w-28">{t('browse.created')}</SortHeader>}
                {isColVisible('tags') && <th className="text-left px-2.5 py-2 w-28">{t('browse.tags')}</th>}
                {isColVisible('comment') && <SortHeader field="comment" className="text-left w-40">{t('browse.comment')}</SortHeader>}
                {window.electronAPI && <th className="w-9 px-1 py-2" />}
              </tr>
            </thead>
            <tbody
              onClick={handleTbodyClick}
              onDoubleClick={handleTbodyDoubleClick}
              onContextMenu={handleTbodyContextMenu}
            >
              {padTop > 0 && <tr><td colSpan={99} style={{ height: padTop, padding: 0, border: 'none' }} /></tr>}
              {sortedTracks.slice(startRow, endRow).map((track, i) => {
                const idx = startRow + i
                const isSelected = idx === selectedIndex
                const isCurrent = currentTrackId === track.id
                const isBatchSelected = selectedTrackIds.has(track.id!)

                return (
                  <tr
                    key={track.id}
                    data-index={idx}
                    draggable
                    onMouseDown={() => handleTrackMouseDown(track)}
                    onDragStart={(e) => handleDragStart(e, track)}
                    onDragEnd={handleDragEnd}
                    className={`group/row border-b border-surface-100/60 dark:border-surface-800/40 cursor-pointer transition-all duration-100 ${
                      isBatchSelected
                        ? 'bg-primary-500/20 dark:bg-primary-500/15'
                        : isCurrent
                        ? 'bg-primary-500/10 dark:bg-primary-500/[0.08]'
                        : isSelected
                        ? 'bg-surface-200/60 dark:bg-surface-800/60'
                        : 'hover:bg-surface-100/80 dark:hover:bg-surface-800/40'
                    } ${track.isHidden ? 'opacity-40' : ''}`}
                  >
                    {/* Artwork */}
                    <td className="px-1.5 py-1">
                      <div className="w-8 h-8 rounded-md bg-surface-200 dark:bg-surface-700 flex items-center justify-center overflow-hidden shadow-sm">
                        {track.artworkUrl ? (
                          <img src={track.artworkUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        ) : (
                          <svg className="w-3.5 h-3.5 text-surface-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                          </svg>
                        )}
                      </div>
                    </td>

                    {/* Name */}
                    <td className="px-2.5 py-1.5 truncate max-w-[300px]">
                      <span className="flex items-center gap-2">
                        {isCurrent && isPlaying && (
                          <span className="flex items-end gap-[2px] h-3 w-3 shrink-0">
                            <span className="w-[2px] rounded-full bg-primary-500 eq-bar-1" />
                            <span className="w-[2px] rounded-full bg-primary-500 eq-bar-2" />
                            <span className="w-[2px] rounded-full bg-primary-500 eq-bar-3" />
                          </span>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(track.id!) }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="p-0 shrink-0"
                        >
                          <svg className={`w-3.5 h-3.5 transition-colors ${track.isFavorite ? 'text-red-500' : 'text-surface-300 dark:text-surface-700 opacity-0 group-hover/row:opacity-100'}`} fill={track.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        </button>
                        <span className={isCurrent ? 'text-primary-600 dark:text-primary-400 font-semibold' : ''}>
                          {track.name}
                        </span>
                      </span>
                    </td>

                    {/* Artist */}
                    {isColVisible('artist') && (
                    <td className="px-2.5 py-1.5" onMouseDown={(e) => e.stopPropagation()} onDragStart={(e) => e.preventDefault()}>
                      {editingArtistId === track.id ? (
                        <input
                          type="text"
                          value={editingArtist}
                          onChange={(e) => setEditingArtist(e.target.value)}
                          onBlur={finishEditArtist}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') finishEditArtist()
                            if (e.key === 'Escape') setEditingArtistId(null)
                          }}
                          autoFocus
                          className="w-full px-1.5 py-0.5 text-[13px] rounded-md border-2 border-primary-500 bg-white dark:bg-surface-800 focus:outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className="text-[12px] text-surface-500 truncate block max-w-[120px] cursor-text"
                          onDoubleClick={(e) => { e.stopPropagation(); startEditArtist(track) }}
                        >
                          {track.artist || <span className="text-surface-300 dark:text-surface-700">&mdash;</span>}
                        </span>
                      )}
                    </td>
                    )}

                    {/* Album */}
                    {isColVisible('album') && (
                    <td className="px-2.5 py-1.5" onMouseDown={(e) => e.stopPropagation()} onDragStart={(e) => e.preventDefault()}>
                      {editingAlbumId === track.id ? (
                        <input
                          type="text"
                          value={editingAlbum}
                          onChange={(e) => setEditingAlbum(e.target.value)}
                          onBlur={finishEditAlbum}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') finishEditAlbum()
                            if (e.key === 'Escape') setEditingAlbumId(null)
                          }}
                          autoFocus
                          className="w-full px-1.5 py-0.5 text-[13px] rounded-md border-2 border-primary-500 bg-white dark:bg-surface-800 focus:outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className="text-[12px] text-surface-500 truncate block max-w-[120px] cursor-text"
                          onDoubleClick={(e) => { e.stopPropagation(); startEditAlbum(track) }}
                        >
                          {track.album || <span className="text-surface-300 dark:text-surface-700">&mdash;</span>}
                        </span>
                      )}
                    </td>
                    )}

                    {/* Year */}
                    {isColVisible('year') && (
                    <td className="px-2.5 py-1.5" onMouseDown={(e) => e.stopPropagation()} onDragStart={(e) => e.preventDefault()}>
                      {editingYearId === track.id ? (
                        <input
                          type="text"
                          value={editingYear}
                          onChange={(e) => setEditingYear(e.target.value)}
                          onBlur={finishEditYear}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') finishEditYear()
                            if (e.key === 'Escape') setEditingYearId(null)
                          }}
                          autoFocus
                          className="w-full px-1.5 py-0.5 text-[13px] rounded-md border-2 border-primary-500 bg-white dark:bg-surface-800 focus:outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className="text-[12px] text-surface-500 tabular-nums cursor-text"
                          onDoubleClick={(e) => { e.stopPropagation(); startEditYear(track) }}
                        >
                          {track.year || <span className="text-surface-300 dark:text-surface-700">&mdash;</span>}
                        </span>
                      )}
                    </td>
                    )}

                    {/* Duration */}
                    {isColVisible('duration') && (
                    <td className="px-2.5 py-1.5 text-right text-surface-500 tabular-nums font-mono text-[12px]">
                      {formatTime(track.length)}
                    </td>
                    )}

                    {/* BPM */}
                    {isColVisible('bpm') && (
                    <td className="px-2.5 py-1.5 text-right text-surface-500 tabular-nums font-mono text-[12px]">
                      {track.bpm ? Math.round(track.bpm) : <span className="text-surface-300 dark:text-surface-700">&mdash;</span>}
                    </td>
                    )}

                    {/* Key */}
                    {isColVisible('key') && (
                    <td className="px-2.5 py-1.5 text-surface-500 text-[12px]">
                      {track.musicalKey || <span className="text-surface-300 dark:text-surface-700">&mdash;</span>}
                    </td>
                    )}

                    {/* Energy */}
                    {isColVisible('energy') && (
                    <td className="px-2.5 py-1.5 text-right tabular-nums font-mono text-[12px]">
                      {track.energy ? (
                        <span className={track.energy >= 7 ? 'text-red-500' : track.energy >= 4 ? 'text-amber-500' : 'text-blue-500'}>
                          {track.energy}
                        </span>
                      ) : (
                        <span className="text-surface-300 dark:text-surface-700">&mdash;</span>
                      )}
                    </td>
                    )}

                    {/* Rating */}
                    {isColVisible('rating') && (
                    <td className="px-2.5 py-1.5" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onDragStart={(e) => e.preventDefault()}>
                      <div className="flex items-center justify-center gap-px">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            onClick={() => updateTrackRating(track.id!, track.rating === star ? 0 : star)}
                            className="p-0 transition-colors"
                          >
                            <svg
                              className={`w-3.5 h-3.5 ${(track.rating || 0) >= star ? 'text-amber-400' : 'text-surface-300 dark:text-surface-700 hover:text-amber-300'}`}
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          </button>
                        ))}
                      </div>
                    </td>
                    )}

                    {/* Created */}
                    {isColVisible('created') && (
                    <td className="px-2.5 py-1.5 text-surface-500 text-[12px]">
                      {new Date(track.createdAt).toLocaleDateString(dateLocale)}
                    </td>
                    )}

                    {/* Tags */}
                    {isColVisible('tags') && (
                    <td className="px-2.5 py-1.5" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onDragStart={(e) => e.preventDefault()}>
                      <TagAssignmentPopover track={track} tags={tags} tagMap={tagMap} />
                    </td>
                    )}

                    {/* Comment */}
                    {isColVisible('comment') && (
                    <td className="px-2.5 py-1.5" onMouseDown={(e) => e.stopPropagation()} onDragStart={(e) => e.preventDefault()}>
                      {editingCommentId === track.id ? (
                        <input
                          type="text"
                          value={editingComment}
                          onChange={(e) => setEditingComment(e.target.value)}
                          onBlur={finishEditComment}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') finishEditComment()
                            if (e.key === 'Escape') setEditingCommentId(null)
                          }}
                          autoFocus
                          className="w-full px-1.5 py-0.5 text-[13px] rounded-md border-2 border-primary-500 bg-white dark:bg-surface-800 focus:outline-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className="text-[12px] text-surface-500 truncate block max-w-[150px] cursor-text"
                          onDoubleClick={(e) => { e.stopPropagation(); startEditComment(track) }}
                        >
                          {track.comment || <span className="text-surface-300 dark:text-surface-700">&mdash;</span>}
                        </span>
                      )}
                    </td>
                    )}

                    {/* Export */}
                    {window.electronAPI && (
                      <td className="px-1 py-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleExport(track) }}
                          className="p-1 rounded-md opacity-0 group-hover/row:opacity-100 hover:bg-surface-200 dark:hover:bg-surface-700 transition-all"
                          title={t('browse.export')}
                        >
                          <svg className="w-3.5 h-3.5 text-surface-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
              {padBottom > 0 && <tr><td colSpan={99} style={{ height: padBottom, padding: 0, border: 'none' }} /></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
