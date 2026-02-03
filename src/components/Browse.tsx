import { useEffect, useCallback, useState } from 'react'
import { useTrackStore } from '../store/useTrackStore'
import { usePlayerStore } from '../store/usePlayerStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { DEFAULT_SHORTCUTS } from '../types'
import { useUndoStore } from '../store/useUndoStore'
import TagSidebar from './TagSidebar'
import TrackGrid from './TrackGrid'
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
  const settings = useSettingsStore(s => s.settings)

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
    <div className="flex flex-col h-full">
      <div className="flex flex-1 min-h-0">
        <TagSidebar />
        <TrackGrid category={category} isActive={isActive} />
      </div>
      <Player />
    </div>
  )
}
