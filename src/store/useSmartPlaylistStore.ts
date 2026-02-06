import { create } from 'zustand'
import type { SmartTag, SmartTagRule, Track, Tag } from '../types'
import { getSmartTags, addSmartTag, updateSmartTag, deleteSmartTag } from '../db/database'

interface SmartPlaylistStore {
  playlists: SmartTag[]
  activePlaylistId: number | null

  loadPlaylists: (category: number) => Promise<void>
  createPlaylist: (name: string, rules: SmartTagRule[], match: 'all' | 'any', category: number) => Promise<number>
  updatePlaylist: (id: number, changes: Partial<SmartTag>) => Promise<void>
  deletePlaylist: (id: number) => Promise<void>
  setActivePlaylist: (id: number | null) => void
  evaluatePlaylist: (playlist: SmartTag, tracks: Track[], tags: Tag[]) => Track[]
  evaluateRule: (track: Track, rule: SmartTagRule, tags: Tag[]) => boolean
  getMatchingCount: (playlist: SmartTag, tracks: Track[], tags: Tag[]) => number
}

export const useSmartPlaylistStore = create<SmartPlaylistStore>((set, get) => ({
  playlists: [],
  activePlaylistId: null,

  loadPlaylists: async (category) => {
    const playlists = await getSmartTags(category)
    set({ playlists })
  },

  createPlaylist: async (name, rules, match, category) => {
    const id = await addSmartTag({ name, rules, match, category })
    const playlists = await getSmartTags(category)
    set({ playlists })
    return id
  },

  updatePlaylist: async (id, changes) => {
    await updateSmartTag(id, changes)
    const { playlists } = get()
    set({ playlists: playlists.map(p => p.id === id ? { ...p, ...changes } : p) })
  },

  deletePlaylist: async (id) => {
    await deleteSmartTag(id)
    const { playlists, activePlaylistId } = get()
    set({
      playlists: playlists.filter(p => p.id !== id),
      activePlaylistId: activePlaylistId === id ? null : activePlaylistId,
    })
  },

  setActivePlaylist: (id) => {
    set({ activePlaylistId: id })
  },

  evaluatePlaylist: (playlist, tracks, tags) => {
    const { evaluateRule } = get()
    return tracks.filter(track => {
      if (playlist.match === 'all') {
        return playlist.rules.every(rule => evaluateRule(track, rule, tags))
      } else {
        return playlist.rules.some(rule => evaluateRule(track, rule, tags))
      }
    })
  },

  evaluateRule: (track, rule, tags) => {
    const { field, operator, value, value2 } = rule

    // Get the track value based on field
    let trackValue: string | number | boolean | undefined

    switch (field) {
      case 'bpm':
        trackValue = track.bpm
        break
      case 'musicalKey':
        trackValue = track.musicalKey
        break
      case 'rating':
        trackValue = track.rating
        break
      case 'name':
        trackValue = track.name
        break
      case 'comment':
        trackValue = track.comment
        break
      case 'duration':
        trackValue = track.length
        break
      case 'playCount':
        trackValue = track.playCount ?? 0
        break
      case 'isFavorite':
        trackValue = track.isFavorite ?? false
        break
      case 'lastPlayedAt':
        trackValue = track.lastPlayedAt
        break
      case 'tags':
        // Special handling for tags - value contains comma-separated tag names
        const tagNames = value.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
        const trackTagNames = track.tagIds
          .map(id => tags.find(t => t.id === id)?.name?.toLowerCase())
          .filter(Boolean) as string[]

        if (operator === 'isEmpty') {
          return trackTagNames.length === 0
        }
        if (operator === 'isNotEmpty') {
          return trackTagNames.length > 0
        }
        if (operator === 'contains') {
          // Track has at least one of the specified tags
          return tagNames.some(tn => trackTagNames.includes(tn))
        }
        if (operator === 'equals') {
          // Track has exactly these tags
          return tagNames.length === trackTagNames.length &&
            tagNames.every(tn => trackTagNames.includes(tn))
        }
        return false
    }

    // Handle different operators
    switch (operator) {
      case 'isEmpty':
        return trackValue === undefined || trackValue === null || trackValue === '' || trackValue === 0
      case 'isNotEmpty':
        return trackValue !== undefined && trackValue !== null && trackValue !== '' && trackValue !== 0
      case 'equals':
        if (field === 'isFavorite') {
          return trackValue === (value === 'true')
        }
        if (typeof trackValue === 'number') {
          return trackValue === parseFloat(value)
        }
        return String(trackValue).toLowerCase() === value.toLowerCase()
      case 'contains':
        return String(trackValue ?? '').toLowerCase().includes(value.toLowerCase())
      case 'gt':
        if (typeof trackValue === 'number') {
          return trackValue > parseFloat(value)
        }
        return false
      case 'lt':
        if (typeof trackValue === 'number') {
          return trackValue < parseFloat(value)
        }
        return false
      case 'between':
        if (typeof trackValue === 'number' && value2) {
          const min = parseFloat(value)
          const max = parseFloat(value2)
          return trackValue >= min && trackValue <= max
        }
        return false
      case 'daysAgo':
        // For lastPlayedAt - check if within X days
        if (field === 'lastPlayedAt' && trackValue) {
          const daysAgo = parseInt(value)
          const trackDate = new Date(trackValue as string)
          const cutoff = new Date()
          cutoff.setDate(cutoff.getDate() - daysAgo)
          return trackDate >= cutoff
        }
        return false
      default:
        return false
    }
  },

  getMatchingCount: (playlist, tracks, tags) => {
    const { evaluatePlaylist } = get()
    return evaluatePlaylist(playlist, tracks, tags).length
  },
}))
