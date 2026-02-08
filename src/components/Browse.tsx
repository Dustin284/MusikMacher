import { useEffect, useCallback, useState } from 'react'
import { useTrackStore } from '../store/useTrackStore'
import { usePlayerStore } from '../store/usePlayerStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { DEFAULT_SHORTCUTS } from '../types'
import { useUndoStore } from '../store/useUndoStore'
import { useTranslation } from '../i18n/useTranslation'
import TagSidebar from './TagSidebar'
import TrackGrid from './TrackGrid'
import MediaBrowser from './MediaBrowser'
import Player from './Player'

// Convert a keyboard event into our shortcut key string format
function eventToKey(e: KeyboardEvent): string {
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')

  let key = e.key
  if (key === ' ') key = 'Space'
  // Avoid adding modifier keys themselves
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return ''
  parts.push(key)
  return parts.join('+')
}

interface BrowseProps {
  category: number
  isActive: boolean
}

export default function Browse({ category, isActive }: BrowseProps) {
  const loadTracks = useTrackStore(s => s.loadTracks)
  const loadTags = useTrackStore(s => s.loadTags)
  const setCategory = useTrackStore(s => s.setCategory)
  const getFilteredTracks = useTrackStore(s => s.getFilteredTracks)
  const settings = useSettingsStore(s => s.settings)
  const { t } = useTranslation()
  const [viewMode, setViewMode] = useState<'list' | 'media'>('list')

  useEffect(() => {
    if (!isActive) return
    setCategory(category)
    loadTracks(category)
    loadTags(category)
  }, [category, isActive])

  // Custom keyboard shortcuts - only when active
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isActive) return
    const target = e.target as HTMLElement
    const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
    // Allow Ctrl+Z / Ctrl+Shift+Z through even when in an input (global undo/redo)
    const isUndoRedo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z'
    if (isInInput && !isUndoRedo) return

    // Bare digit keys (1-9) → jump to cue point
    if (!e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const digit = e.code?.match(/^Digit([1-9])$/)?.[1] ?? (/^[1-9]$/.test(e.key) ? e.key : null)
      if (digit) {
        e.preventDefault()
        usePlayerStore.getState().jumpToCuePoint(parseInt(digit))
        return
      }
    }

    const pressedKey = eventToKey(e)
    if (!pressedKey) return

    // Build shortcut map: custom overrides + any new defaults that aren't in custom yet
    const base = settings.customShortcuts?.length > 0 ? settings.customShortcuts : DEFAULT_SHORTCUTS
    const shortcuts = [...base, ...DEFAULT_SHORTCUTS.filter(d => !base.some(s => s.action === d.action))]
    const match = shortcuts.find(s => s.key.toLowerCase() === pressedKey.toLowerCase())
    if (!match) return

    e.preventDefault()
    const store = usePlayerStore.getState()
    const { skipPositionMovement } = settings

    switch (match.action) {
      case 'playPause': store.playPause(); break
      case 'skipForward': store.skipForward(skipPositionMovement); break
      case 'skipBackward': store.skipBackward(skipPositionMovement); break
      case 'volumeUp': store.setVolume(Math.min(1, store.volume + 0.05)); break
      case 'volumeDown': store.setVolume(Math.max(0, store.volume - 0.05)); break
      case 'toggleQueue': store.toggleQueue(); break
      case 'toggleLyrics': store.toggleLyrics(); break
      case 'speedUp': store.speedUp(); break
      case 'speedDown': store.speedDown(); break
      case 'speedReset': store.speedReset(); break
      case 'abLoopSet': store.toggleABLoop(); break
      case 'toggleEq': store.toggleEq(); break
      case 'pitchUp': store.setPitchSemitones(store.pitchSemitones + 1); break
      case 'pitchDown': store.setPitchSemitones(store.pitchSemitones - 1); break
      case 'pitchReset': store.resetPitch(); break
      case 'playRandom': {
        const trackStore = useTrackStore.getState()
        const filtered = trackStore.getFilteredTracks(settings.andTagCombination)
        if (filtered.length > 0) {
          store.setTrackList(filtered)
          const randomTrack = filtered[Math.floor(Math.random() * filtered.length)]
          store.play(randomTrack)
        }
        break
      }
      case 'toggleFavorite': {
        const ct = store.currentTrack
        if (ct?.id) {
          useTrackStore.getState().toggleFavorite(ct.id)
        }
        break
      }
      case 'nextTrack': {
        const { trackList, currentTrack, playbackMode } = store
        if (trackList.length > 0 && currentTrack) {
          if (playbackMode === 'shuffle') {
            const others = trackList.filter(t => t.id !== currentTrack.id)
            if (others.length > 0) store.play(others[Math.floor(Math.random() * others.length)])
          } else {
            const idx = trackList.findIndex(t => t.id === currentTrack.id)
            if (idx >= 0 && idx < trackList.length - 1) store.play(trackList[idx + 1])
            else if (trackList.length > 0) store.play(trackList[0])
          }
        }
        break
      }
      case 'previousTrack': {
        const { trackList: tl, currentTrack: ct } = store
        if (tl.length > 0 && ct) {
          const idx = tl.findIndex(t => t.id === ct.id)
          if (idx > 0) store.play(tl[idx - 1])
          else if (tl.length > 0) store.play(tl[tl.length - 1])
        }
        break
      }
      case 'undo': {
        useUndoStore.getState().undo().then(type => {
          if (type) {
            // Reload tracks to reflect undo
            useTrackStore.getState().loadTracks(category)
          }
        })
        break
      }
      case 'redo': {
        useUndoStore.getState().redo().then(type => {
          if (type) {
            useTrackStore.getState().loadTracks(category)
          }
        })
        break
      }
      default: {
        // Cue points: cue1-9
        const cueMatch = match.action.match(/^cue(\d)$/)
        if (cueMatch) { store.jumpToCuePoint(parseInt(cueMatch[1])); break }
      }
    }
  }, [isActive, settings])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <TagSidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* View toggle */}
          <div className="flex items-center gap-1 px-3 pt-2 shrink-0">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'list'
                  ? 'bg-primary-500/10 text-primary-500'
                  : 'text-surface-400 hover:bg-surface-200/60 dark:hover:bg-surface-800/60'
              }`}
              title={t('mediaBrowser.listView')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('media')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'media'
                  ? 'bg-primary-500/10 text-primary-500'
                  : 'text-surface-400 hover:bg-surface-200/60 dark:hover:bg-surface-800/60'
              }`}
              title={t('mediaBrowser.gridView')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
          </div>

          {/* Content */}
          {viewMode === 'media' ? (
            <MediaBrowser tracks={getFilteredTracks(settings.andTagCombination)} />
          ) : (
            <TrackGrid category={category} isActive={isActive} />
          )}
        </div>
      </div>
      <div className="shrink-0">
        <Player />
      </div>
    </div>
  )
}
