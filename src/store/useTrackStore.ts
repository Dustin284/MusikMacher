import { create } from 'zustand'
import type { Track, Tag, CuePoint, WaveformNote } from '../types'
import { CATEGORY_TRACKS } from '../types'
import { db, getTracks, getTags, addTag, updateTag, deleteTag, updateTrack, addTrack, storeAudioBlob, deleteTrack as dbDeleteTrack, getAudioBlob } from '../db/database'
import { useUndoStore } from './useUndoStore'

interface TrackStore {
  tracks: Track[]
  tags: Tag[]
  category: number
  searchTerm: string
  tagSearch: string
  showHidden: boolean
  showHiddenTags: boolean

  setCategory: (cat: number) => void
  setSearchTerm: (term: string) => void
  setTagSearch: (term: string) => void
  setShowHidden: (show: boolean) => void
  setShowHiddenTags: (show: boolean) => void

  loadTracks: (category: number) => Promise<void>
  loadTags: (category: number) => Promise<void>

  addNewTag: (name: string) => Promise<void>
  toggleTag: (id: number) => Promise<void>
  renameTag: (id: number, name: string) => Promise<void>
  toggleTagHidden: (id: number) => Promise<void>
  toggleTagFavorite: (id: number) => Promise<void>
  removeTag: (id: number) => Promise<void>
  resetTags: () => Promise<void>
  addTrackToTag: (trackId: number, tagId: number) => Promise<void>
  removeTrackFromTag: (trackId: number, tagId: number) => Promise<void>

  hideTrack: (id: number) => Promise<void>
  unhideTrack: (id: number) => Promise<void>
  deleteTrack: (id: number) => Promise<void>
  updateTrackComment: (id: number, comment: string) => Promise<void>
  updateTrackBPM: (id: number, bpm: number) => Promise<void>
  updateTrackKey: (id: number, key: string) => Promise<void>
  updateTrackCuePoints: (id: number, cuePoints: CuePoint[]) => Promise<void>
  updateTrackLyrics: (id: number, lyrics: string, lrcLyrics?: string) => Promise<void>
  updateTrackRating: (id: number, rating: number) => Promise<void>
  toggleFavorite: (id: number) => Promise<void>
  addTrackNote: (trackId: number, time: number, text: string) => Promise<void>
  updateTrackNote: (trackId: number, noteId: string, text: string) => Promise<void>
  deleteTrackNote: (trackId: number, noteId: string) => Promise<void>

  importTracks: (files: FileList, category: number, subfoldersTag: boolean) => Promise<string>
  importDownloadedTrack: (fileData: ArrayBuffer, fileName: string, filePath: string, category: number) => Promise<{ trackId: number | null; log: string }>

  getFilteredTracks: (andMode: boolean) => Track[]
  getFilteredTags: () => Tag[]

  getAudioBuffer: (trackId: number) => Promise<AudioBuffer | null>
  findDuplicates: () => { groups: Track[][] }
}

export const useTrackStore = create<TrackStore>((set, get) => ({
  tracks: [],
  tags: [],
  category: CATEGORY_TRACKS,
  searchTerm: '',
  tagSearch: '',
  showHidden: false,
  showHiddenTags: false,

  setCategory: (cat) => set({ category: cat }),
  setSearchTerm: (term) => set({ searchTerm: term }),
  setTagSearch: (term) => set({ tagSearch: term }),
  setShowHidden: (show) => set({ showHidden: show }),
  setShowHiddenTags: (show) => set({ showHiddenTags: show }),

  loadTracks: async (category) => {
    const tracks = await getTracks(category)
    set({ tracks, category })
  },

  loadTags: async (category) => {
    const tags = await getTags(category)
    set({ tags })
  },

  addNewTag: async (name) => {
    const { category, tags } = get()
    const id = await addTag({ name, isChecked: false, isHidden: false, isFavorite: false, category })
    set({ tags: [...tags, { id, name, isChecked: false, isHidden: false, isFavorite: false, category }] })
  },

  toggleTag: async (id) => {
    const { tags } = get()
    const tag = tags.find(t => t.id === id)
    if (!tag) return
    const newChecked = !tag.isChecked
    set({ tags: tags.map(t => t.id === id ? { ...t, isChecked: newChecked } : t) })
    updateTag(id, { isChecked: newChecked })
  },

  renameTag: async (id, name) => {
    const { tags } = get()
    set({ tags: tags.map(t => t.id === id ? { ...t, name } : t) })
    updateTag(id, { name })
  },

  toggleTagHidden: async (id) => {
    const { tags } = get()
    const tag = tags.find(t => t.id === id)
    if (!tag) return
    const newHidden = !tag.isHidden
    set({ tags: tags.map(t => t.id === id ? { ...t, isHidden: newHidden } : t) })
    updateTag(id, { isHidden: newHidden })
  },

  toggleTagFavorite: async (id) => {
    const { tags } = get()
    const tag = tags.find(t => t.id === id)
    if (!tag) return
    const newFav = !tag.isFavorite
    set({ tags: tags.map(t => t.id === id ? { ...t, isFavorite: newFav } : t) })
    updateTag(id, { isFavorite: newFav })
  },

  removeTag: async (id) => {
    const { tags, tracks } = get()
    set({
      tags: tags.filter(t => t.id !== id),
      tracks: tracks.map(t =>
        t.tagIds.includes(id) ? { ...t, tagIds: t.tagIds.filter(tid => tid !== id) } : t
      ),
    })
    deleteTag(id)
    for (const track of tracks) {
      if (track.tagIds.includes(id)) {
        updateTrack(track.id!, { tagIds: track.tagIds.filter(tid => tid !== id) })
      }
    }
  },

  resetTags: async () => {
    const { tags } = get()
    const checkedIds = tags.filter(t => t.isChecked).map(t => t.id!)
    if (checkedIds.length === 0) return
    set({ tags: tags.map(t => t.isChecked ? { ...t, isChecked: false } : t) })
    for (const id of checkedIds) {
      updateTag(id, { isChecked: false })
    }
  },

  addTrackToTag: async (trackId, tagId) => {
    const { tracks } = get()
    const track = tracks.find(t => t.id === trackId)
    if (!track || track.tagIds.includes(tagId)) return
    const newTagIds = [...track.tagIds, tagId]
    useUndoStore.getState().pushAction({ type: 'addTag', trackId, previousValue: [...track.tagIds], newValue: newTagIds })
    set({ tracks: tracks.map(t => t.id === trackId ? { ...t, tagIds: newTagIds } : t) })
    await updateTrack(trackId, { tagIds: newTagIds })
  },

  removeTrackFromTag: async (trackId, tagId) => {
    const { tracks } = get()
    const track = tracks.find(t => t.id === trackId)
    if (!track) return
    const newTagIds = track.tagIds.filter(id => id !== tagId)
    useUndoStore.getState().pushAction({ type: 'removeTag', trackId, previousValue: [...track.tagIds], newValue: newTagIds })
    set({ tracks: tracks.map(t => t.id === trackId ? { ...t, tagIds: newTagIds } : t) })
    await updateTrack(trackId, { tagIds: newTagIds })
  },

  hideTrack: async (id) => {
    const { tracks } = get()
    useUndoStore.getState().pushAction({ type: 'hideTrack', trackId: id, previousValue: false, newValue: true })
    set({ tracks: tracks.map(t => t.id === id ? { ...t, isHidden: true } : t) })
    updateTrack(id, { isHidden: true })
  },

  unhideTrack: async (id) => {
    const { tracks } = get()
    useUndoStore.getState().pushAction({ type: 'hideTrack', trackId: id, previousValue: true, newValue: false })
    set({ tracks: tracks.map(t => t.id === id ? { ...t, isHidden: false } : t) })
    updateTrack(id, { isHidden: false })
  },

  deleteTrack: async (id) => {
    const { tracks } = get()
    const track = tracks.find(t => t.id === id)
    if (track) {
      // Snapshot track + audio for undo
      const audioBlob = await getAudioBlob(id).catch(() => undefined)
      useUndoStore.getState().pushAction({
        type: 'deleteTrack',
        trackId: id,
        previousValue: null,
        newValue: null,
        trackSnapshot: { ...track },
        audioBlob: audioBlob,
      })
    }
    set({ tracks: tracks.filter(t => t.id !== id) })
    await dbDeleteTrack(id)
  },

  updateTrackComment: async (id, comment) => {
    const { tracks } = get()
    const prev = tracks.find(t => t.id === id)
    if (prev) useUndoStore.getState().pushAction({ type: 'updateComment', trackId: id, previousValue: prev.comment, newValue: comment })
    set({ tracks: tracks.map(t => t.id === id ? { ...t, comment } : t) })
    updateTrack(id, { comment })
  },

  updateTrackBPM: async (id, bpm) => {
    const { tracks } = get()
    const prev = tracks.find(t => t.id === id)
    if (prev) useUndoStore.getState().pushAction({ type: 'updateBPM', trackId: id, previousValue: prev.bpm ?? 0, newValue: bpm })
    set({ tracks: tracks.map(t => t.id === id ? { ...t, bpm } : t) })
    updateTrack(id, { bpm })
  },

  updateTrackKey: async (id, key) => {
    const { tracks } = get()
    const prev = tracks.find(t => t.id === id)
    if (prev) useUndoStore.getState().pushAction({ type: 'updateKey', trackId: id, previousValue: prev.musicalKey ?? '', newValue: key })
    set({ tracks: tracks.map(t => t.id === id ? { ...t, musicalKey: key } : t) })
    updateTrack(id, { musicalKey: key })
  },

  updateTrackCuePoints: async (id, cuePoints) => {
    const { tracks } = get()
    set({ tracks: tracks.map(t => t.id === id ? { ...t, cuePoints } : t) })
    updateTrack(id, { cuePoints })
  },

  updateTrackLyrics: async (id, lyrics, lrcLyrics) => {
    const { tracks } = get()
    const changes: Partial<Track> = { lyrics }
    if (lrcLyrics !== undefined) changes.lrcLyrics = lrcLyrics
    set({ tracks: tracks.map(t => t.id === id ? { ...t, ...changes } : t) })
    updateTrack(id, changes)
  },

  updateTrackRating: async (id, rating) => {
    const { tracks } = get()
    const prev = tracks.find(t => t.id === id)
    if (prev) useUndoStore.getState().pushAction({ type: 'updateRating', trackId: id, previousValue: prev.rating ?? 0, newValue: rating })
    set({ tracks: tracks.map(t => t.id === id ? { ...t, rating } : t) })
    updateTrack(id, { rating })
  },

  toggleFavorite: async (id) => {
    const { tracks } = get()
    const track = tracks.find(t => t.id === id)
    if (!track) return
    const newFav = !track.isFavorite
    useUndoStore.getState().pushAction({ type: 'toggleFavorite', trackId: id, previousValue: !!track.isFavorite, newValue: newFav })
    set({ tracks: tracks.map(t => t.id === id ? { ...t, isFavorite: newFav } : t) })
    updateTrack(id, { isFavorite: newFav })
  },

  addTrackNote: async (trackId, time, text) => {
    const { tracks } = get()
    const track = tracks.find(t => t.id === trackId)
    if (!track) return
    const note: WaveformNote = { id: crypto.randomUUID(), time, text }
    const notes = [...(track.notes || []), note].sort((a, b) => a.time - b.time)
    set({ tracks: tracks.map(t => t.id === trackId ? { ...t, notes } : t) })
    updateTrack(trackId, { notes })
  },

  updateTrackNote: async (trackId, noteId, text) => {
    const { tracks } = get()
    const track = tracks.find(t => t.id === trackId)
    if (!track) return
    const notes = (track.notes || []).map(n => n.id === noteId ? { ...n, text } : n)
    set({ tracks: tracks.map(t => t.id === trackId ? { ...t, notes } : t) })
    updateTrack(trackId, { notes })
  },

  deleteTrackNote: async (trackId, noteId) => {
    const { tracks } = get()
    const track = tracks.find(t => t.id === trackId)
    if (!track) return
    const notes = (track.notes || []).filter(n => n.id !== noteId)
    set({ tracks: tracks.map(t => t.id === trackId ? { ...t, notes } : t) })
    updateTrack(trackId, { notes })
  },

  importTracks: async (files, category, subfoldersTag) => {
    let log = ''
    const audioExts = ['.mp3', '.m4a', '.mp4', '.wav', '.ogg', '.flac', '.webm']
    let added = 0
    let skipped = 0

    for (const file of Array.from(files)) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!audioExts.includes(ext)) {
        skipped++
        continue
      }

      // Skip if a track with this name already exists in ANY library
      // (prevents overwriting downloaded songs or creating duplicates)
      const existing = await db.tracks.where('name').equals(file.name).first()
      if (existing) {
        log += `Skipped (exists): ${file.name}\n`
        skipped++
        continue
      }

      // Also check normalized name (without extension, case-insensitive) to catch duplicates
      const normalizedName = file.name.replace(/\.[^.]+$/, '').toLowerCase().trim()
      const allTracks = get().tracks
      const similarExists = allTracks.some(t => {
        const tNorm = t.name.replace(/\.[^.]+$/, '').toLowerCase().trim()
        return tNorm === normalizedName
      })
      if (similarExists) {
        log += `Skipped (similar): ${file.name}\n`
        skipped++
        continue
      }

      const duration = await getAudioDuration(file)

      const trackData: Omit<Track, 'id'> = {
        name: file.name,
        path: '',
        length: duration,
        createdAt: new Date(file.lastModified).toISOString(),
        comment: '',
        isHidden: false,
        category,
        tagIds: [],
      }

      if (subfoldersTag && file.webkitRelativePath) {
        const parts = file.webkitRelativePath.split('/')
        if (parts.length > 2) {
          const folderName = parts[parts.length - 2]
          let tag = (await getTags(category)).find(t => t.name === folderName)
          if (!tag) {
            const tagId = await addTag({
              name: folderName,
              isChecked: false,
              isHidden: false,
              isFavorite: false,
              category,
            })
            trackData.tagIds = [tagId]
          } else {
            trackData.tagIds = [tag.id!]
          }
        }
      }

      const artworkBlob = await extractArtwork(file)
      if (artworkBlob) {
        trackData.artworkBlob = await artworkBlob.arrayBuffer() as unknown as Blob
      }

      const trackId = await addTrack(trackData)
      await storeAudioBlob(trackId, file)

      added++
      log += `Added: ${file.name}\n`
      // Yield to UI thread to prevent freezing during bulk imports
      // BPM, key & waveform analysis is deferred to first playback (loadAndPlayTrack)
      await new Promise(r => setTimeout(r, 0))
    }

    log += `\nDone. Added: ${added}, Skipped: ${skipped}\n`

    const tracks = await getTracks(category)
    const tags = await getTags(category)
    set({ tracks, tags })

    return log
  },

  importDownloadedTrack: async (fileData, fileName, filePath, category) => {
    // Check duplicate
    const existing = await db.tracks.where('name').equals(fileName).first()
    if (existing) {
      return { trackId: null, log: `Skipped (exists): ${fileName}` }
    }

    const file = new File([fileData], fileName, { type: 'audio/mpeg', lastModified: Date.now() })
    const duration = await getAudioDuration(file)

    const trackData: Omit<Track, 'id'> = {
      name: fileName,
      path: '',
      length: duration,
      createdAt: new Date().toISOString(),
      comment: '',
      isHidden: false,
      category,
      tagIds: [],
    }

    const artworkBlob = await extractArtwork(file)
    if (artworkBlob) {
      trackData.artworkBlob = await artworkBlob.arrayBuffer() as unknown as Blob
    }

    const trackId = await addTrack(trackData)

    // Store in IndexedDB as fallback
    await db.audioFiles.put({ trackId, blob: fileData as unknown as Blob })

    // Cache on disk directly from the downloaded file (no large IPC data transfer)
    if (filePath && window.electronAPI?.cacheAudioFromPath) {
      await window.electronAPI.cacheAudioFromPath(filePath, trackId).catch(() => {})
    } else if (window.electronAPI?.cacheAudio) {
      window.electronAPI.cacheAudio(trackId, fileData).catch(() => {})
    }

    const tracks = await getTracks(category)
    const tags = await getTags(category)
    set({ tracks, tags })

    return { trackId, log: `Added: ${fileName}` }
  },

  getFilteredTracks: (andMode) => {
    const { tracks, tags, searchTerm, showHidden } = get()
    const activeTags = tags.filter(t => t.isChecked)
    const terms = searchTerm.toLowerCase().split(/\s+/).filter(Boolean)

    return tracks.filter(track => {
      if (!showHidden && track.isHidden) return false

      if (terms.length > 0) {
        const nameLC = track.name.toLowerCase()
        const commentLC = track.comment.toLowerCase()
        const matches = terms.every(t => nameLC.includes(t) || commentLC.includes(t))
        if (!matches) return false
      }

      if (activeTags.length > 0) {
        if (andMode) {
          return activeTags.every(tag => track.tagIds.includes(tag.id!))
        } else {
          return activeTags.some(tag => track.tagIds.includes(tag.id!))
        }
      }

      return true
    })
  },

  getFilteredTags: () => {
    const { tags, tagSearch, showHiddenTags } = get()
    const term = tagSearch.toLowerCase()

    return tags
      .filter(tag => {
        if (!showHiddenTags && tag.isHidden) return false
        if (term && !tag.name.toLowerCase().includes(term)) return false
        return true
      })
      .sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  },

  getAudioBuffer: async (trackId) => {
    const blob = await getAudioBlob(trackId)
    if (!blob) return null
    try {
      const arrayBuffer = await blob.arrayBuffer()
      const audioContext = new AudioContext()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      audioContext.close()
      return audioBuffer
    } catch {
      return null
    }
  },

  findDuplicates: () => {
    const { tracks } = get()
    // Group by normalized name (remove extension, lowercase, trim)
    const nameMap = new Map<string, Track[]>()
    for (const track of tracks) {
      const normalized = track.name.replace(/\.[^.]+$/, '').toLowerCase().trim()
      const group = nameMap.get(normalized) || []
      group.push(track)
      nameMap.set(normalized, group)
    }
    // Also check by similar duration (within 2 seconds) as secondary signal
    const groups: Track[][] = []
    for (const [, group] of nameMap) {
      if (group.length > 1) groups.push(group)
    }
    return { groups }
  },
}))

async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio()
    audio.preload = 'metadata'
    const url = URL.createObjectURL(file)
    audio.src = url
    audio.onloadedmetadata = () => {
      resolve(audio.duration)
      URL.revokeObjectURL(url)
    }
    audio.onerror = () => {
      resolve(0)
      URL.revokeObjectURL(url)
    }
  })
}

async function extractArtwork(file: File): Promise<Blob | undefined> {
  try {
    const buffer = await file.arrayBuffer()
    const view = new DataView(buffer)

    if (
      buffer.byteLength > 10 &&
      view.getUint8(0) === 0x49 &&
      view.getUint8(1) === 0x44 &&
      view.getUint8(2) === 0x33
    ) {
      return extractID3Artwork(buffer, view)
    }
  } catch {
    // Artwork extraction failed
  }
  return undefined
}

function extractID3Artwork(buffer: ArrayBuffer, view: DataView): Blob | undefined {
  const version = view.getUint8(3)
  const tagSize =
    (view.getUint8(6) << 21) |
    (view.getUint8(7) << 14) |
    (view.getUint8(8) << 7) |
    view.getUint8(9)

  let offset = 10
  const end = Math.min(offset + tagSize, buffer.byteLength)

  while (offset + 10 < end) {
    const frameId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    )

    let frameSize: number
    if (version === 4) {
      frameSize =
        (view.getUint8(offset + 4) << 21) |
        (view.getUint8(offset + 5) << 14) |
        (view.getUint8(offset + 6) << 7) |
        view.getUint8(offset + 7)
    } else {
      frameSize = view.getUint32(offset + 4)
    }

    if (frameSize <= 0 || frameSize > buffer.byteLength) break

    offset += 10

    if (frameId === 'APIC') {
      const encoding = view.getUint8(offset)
      let pos = offset + 1

      let mime = ''
      while (pos < offset + frameSize && view.getUint8(pos) !== 0) {
        mime += String.fromCharCode(view.getUint8(pos))
        pos++
      }
      pos++
      pos++ // skip picture type

      if (encoding === 0 || encoding === 3) {
        while (pos < offset + frameSize && view.getUint8(pos) !== 0) pos++
        pos++
      } else {
        while (pos + 1 < offset + frameSize) {
          if (view.getUint8(pos) === 0 && view.getUint8(pos + 1) === 0) break
          pos += 2
        }
        pos += 2
      }

      if (pos < offset + frameSize) {
        const imageData = buffer.slice(pos, offset + frameSize)
        return new Blob([imageData], { type: mime || 'image/jpeg' })
      }
    }

    offset += frameSize
  }
  return undefined
}
