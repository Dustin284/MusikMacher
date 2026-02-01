import Dexie, { type Table } from 'dexie'
import type { Track, Tag, AppSettings, AudioFile, ImportLocation, Library, Project, SmartTag } from '../types'
import { DEFAULT_SETTINGS, CATEGORY_TRACKS, CATEGORY_EFFECTS } from '../types'

class MusikMacherDB extends Dexie {
  tracks!: Table<Track, number>
  tags!: Table<Tag, number>
  settings!: Table<{ id: string; data: AppSettings }, string>
  audioFiles!: Table<AudioFile, number>
  importLocations!: Table<ImportLocation, number>
  libraries!: Table<Library, number>
  projects!: Table<Project, number>
  smartTags!: Table<SmartTag, number>

  constructor() {
    super('MusikMacherDB')

    this.version(1).stores({
      tracks: '++id, name, path, category, isHidden, createdAt',
      tags: '++id, name, category, isHidden, isFavorite',
      settings: 'id',
    })

    this.version(2).stores({
      tracks: '++id, name, path, category, isHidden, createdAt',
      tags: '++id, name, category, isHidden, isFavorite',
      settings: 'id',
      audioFiles: 'trackId',
    })

    // v3: Import locations
    this.version(3).stores({
      tracks: '++id, name, path, category, isHidden, createdAt',
      tags: '++id, name, category, isHidden, isFavorite',
      settings: 'id',
      audioFiles: 'trackId',
      importLocations: '++id, path, category',
    })

    // v4: Custom libraries + migrate category string -> number
    this.version(4).stores({
      tracks: '++id, name, path, category, isHidden, createdAt',
      tags: '++id, name, category, isHidden, isFavorite',
      settings: 'id',
      audioFiles: 'trackId',
      importLocations: '++id, path, category',
      libraries: '++id, name, order',
    }).upgrade(async tx => {
      // Create default libraries
      const libTable = tx.table('libraries')
      await libTable.add({ name: 'Songs', icon: 'music', order: 0, isOpen: true })
      await libTable.add({ name: 'Effekte', icon: 'speaker', order: 1, isOpen: true })

      // Migrate tracks: 'tracks' -> 1, 'effects' -> 2
      const trackTable = tx.table('tracks')
      await trackTable.toCollection().modify((track: Record<string, unknown>) => {
        if (track.category === 'tracks') track.category = CATEGORY_TRACKS
        else if (track.category === 'effects') track.category = CATEGORY_EFFECTS
        else if (typeof track.category === 'string') track.category = CATEGORY_TRACKS
      })

      // Migrate tags
      const tagTable = tx.table('tags')
      await tagTable.toCollection().modify((tag: Record<string, unknown>) => {
        if (tag.category === 'tracks') tag.category = CATEGORY_TRACKS
        else if (tag.category === 'effects') tag.category = CATEGORY_EFFECTS
        else if (typeof tag.category === 'string') tag.category = CATEGORY_TRACKS
      })

      // Migrate import locations
      const locTable = tx.table('importLocations')
      await locTable.toCollection().modify((loc: Record<string, unknown>) => {
        if (loc.category === 'tracks') loc.category = CATEGORY_TRACKS
        else if (loc.category === 'effects') loc.category = CATEGORY_EFFECTS
        else if (typeof loc.category === 'string') loc.category = CATEGORY_TRACKS
      })
    })

    // v5: Projects
    this.version(5).stores({
      tracks: '++id, name, path, category, isHidden, createdAt',
      tags: '++id, name, category, isHidden, isFavorite',
      settings: 'id',
      audioFiles: 'trackId',
      importLocations: '++id, path, category',
      libraries: '++id, name, order',
      projects: '++id, name, order',
    })

    // v6: Smart tags + rating index
    this.version(6).stores({
      tracks: '++id, name, path, category, isHidden, createdAt, rating',
      tags: '++id, name, category, isHidden, isFavorite',
      settings: 'id',
      audioFiles: 'trackId',
      importLocations: '++id, path, category',
      libraries: '++id, name, order',
      projects: '++id, name, order',
      smartTags: '++id, name, category',
    })
  }
}

export const db = new MusikMacherDB()

// --- Artwork URL cache: prevents re-creating blob URLs on every getTracks call ---
const artworkUrlCache = new Map<number, string>()

function resolveArtworkUrl(trackId: number, artworkBlob: unknown): string | undefined {
  const cached = artworkUrlCache.get(trackId)
  if (cached) return cached
  try {
    const blob = artworkBlob instanceof Blob
      ? artworkBlob
      : new Blob([artworkBlob as ArrayBuffer])
    if (blob.size > 0) {
      const url = URL.createObjectURL(blob)
      artworkUrlCache.set(trackId, url)
      return url
    }
  } catch { /* ignore invalid artwork */ }
  return undefined
}

export async function getSettings(): Promise<AppSettings> {
  const row = await db.settings.get('app')
  return row?.data ?? { ...DEFAULT_SETTINGS }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await db.settings.put({ id: 'app', data: settings })
}

export async function addTrack(track: Omit<Track, 'id'>): Promise<number> {
  return db.tracks.add(track as Track)
}

export async function updateTrack(id: number, changes: Partial<Track>): Promise<void> {
  await db.tracks.update(id, changes)
}

export async function deleteTrack(id: number): Promise<void> {
  await db.tracks.delete(id)
  await db.audioFiles.delete(id)
  artworkUrlCache.delete(id)
  if (window.electronAPI?.deleteCachedAudio) {
    window.electronAPI.deleteCachedAudio(id).catch(() => {})
  }
}

export async function getTracks(category: number): Promise<Track[]> {
  const tracks = await db.tracks.where('category').equals(category).toArray()
  for (const track of tracks) {
    if (track.artworkBlob && track.id != null) {
      track.artworkUrl = resolveArtworkUrl(track.id, track.artworkBlob)
    }
  }
  return tracks
}

export async function getTrackByName(name: string, category: number): Promise<Track | undefined> {
  return db.tracks.where({ name, category }).first()
}

export async function getAllTracks(): Promise<Track[]> {
  const tracks = await db.tracks.toArray()
  for (const track of tracks) {
    if (track.artworkBlob && track.id != null) {
      track.artworkUrl = resolveArtworkUrl(track.id, track.artworkBlob)
    }
  }
  return tracks
}

export async function addTag(tag: Omit<Tag, 'id'>): Promise<number> {
  return db.tags.add(tag as Tag)
}

export async function getTags(category: number): Promise<Tag[]> {
  return db.tags.where('category').equals(category).toArray()
}

export async function updateTag(id: number, changes: Partial<Tag>): Promise<void> {
  await db.tags.update(id, changes)
}

export async function deleteTag(id: number): Promise<void> {
  await db.tags.delete(id)
}

// Audio file blob storage (IndexedDB + AppData disk cache)
export async function storeAudioBlob(trackId: number, blob: Blob): Promise<void> {
  const buffer = await blob.arrayBuffer()
  await db.audioFiles.put({ trackId, blob: buffer as unknown as Blob })
  // Also cache on disk in Electron for persistence
  if (window.electronAPI?.cacheAudio) {
    window.electronAPI.cacheAudio(trackId, buffer).catch(() => {})
  }
}

export async function getAudioBlob(trackId: number): Promise<Blob | undefined> {
  // In Electron, try disk cache first — native file reads are faster than
  // IndexedDB blob reads, especially with many entries (500+)
  if (window.electronAPI?.getCachedAudio) {
    try {
      const buffer = await window.electronAPI.getCachedAudio(trackId)
      if (buffer) {
        return new Blob([buffer])
      }
    } catch { /* fall through to IndexedDB */ }
  }
  // Fallback: IndexedDB
  const entry = await db.audioFiles.get(trackId)
  if (entry?.blob) {
    try {
      if (entry.blob instanceof Blob) return entry.blob
      return new Blob([entry.blob as unknown as ArrayBuffer])
    } catch { /* ignore */ }
  }
  return undefined
}

// --- Import Locations ---
export async function addImportLocation(loc: Omit<ImportLocation, 'id'>): Promise<number> {
  return db.importLocations.add(loc as ImportLocation)
}

export async function getImportLocations(): Promise<ImportLocation[]> {
  return db.importLocations.toArray()
}

export async function updateImportLocation(id: number, changes: Partial<ImportLocation>): Promise<void> {
  await db.importLocations.update(id, changes)
}

export async function deleteImportLocation(id: number): Promise<void> {
  await db.importLocations.delete(id)
}

// --- Libraries ---
export async function addLibrary(lib: Omit<Library, 'id'>): Promise<number> {
  return db.libraries.add(lib as Library)
}

export async function getLibraries(): Promise<Library[]> {
  return db.libraries.orderBy('order').toArray()
}

export async function updateLibrary(id: number, changes: Partial<Library>): Promise<void> {
  await db.libraries.update(id, changes)
}

export async function deleteLibrary(id: number): Promise<void> {
  await db.libraries.delete(id)
}

// --- Projects ---
export async function addProject(proj: Omit<Project, 'id'>): Promise<number> {
  return db.projects.add(proj as Project)
}

export async function getProjects(): Promise<Project[]> {
  return db.projects.orderBy('order').toArray()
}

export async function updateProject(id: number, changes: Partial<Project>): Promise<void> {
  await db.projects.update(id, changes)
}

export async function deleteProject(id: number): Promise<void> {
  await db.projects.delete(id)
}

// --- Smart Tags ---
export async function addSmartTag(tag: Omit<SmartTag, 'id'>): Promise<number> {
  return db.smartTags.add(tag as SmartTag)
}

export async function getSmartTags(category: number): Promise<SmartTag[]> {
  return db.smartTags.where('category').equals(category).toArray()
}

export async function updateSmartTag(id: number, changes: Partial<SmartTag>): Promise<void> {
  await db.smartTags.update(id, changes)
}

export async function deleteSmartTag(id: number): Promise<void> {
  await db.smartTags.delete(id)
}
