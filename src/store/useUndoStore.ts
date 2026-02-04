import { create } from 'zustand'
import type { Track } from '../types'
import { updateTrack, addTrack, storeAudioBlob, deleteTrack as dbDeleteTrack, getAudioBlob } from '../db/database'

interface UndoAction {
  type: string
  trackId: number
  previousValue: unknown
  newValue: unknown
  timestamp: number
  trackSnapshot?: Track  // for delete undo
  audioBlob?: Blob       // for delete undo
}

interface UndoStore {
  undoStack: UndoAction[]
  redoStack: UndoAction[]
  pushAction: (action: Omit<UndoAction, 'timestamp'>) => void
  undo: () => Promise<string | null>
  redo: () => Promise<string | null>
  canUndo: () => boolean
  canRedo: () => boolean
}

const MAX_UNDO = 50

export const useUndoStore = create<UndoStore>((set, get) => ({
  undoStack: [],
  redoStack: [],

  pushAction: (action) => {
    const full: UndoAction = { ...action, timestamp: Date.now() }
    set(s => ({
      undoStack: [...s.undoStack.slice(-MAX_UNDO + 1), full],
      redoStack: [],
    }))
  },

  undo: async () => {
    const { undoStack } = get()
    if (undoStack.length === 0) return null
    const action = undoStack[undoStack.length - 1]
    set(s => ({
      undoStack: s.undoStack.slice(0, -1),
      redoStack: [...s.redoStack, action],
    }))

    // Apply reverse operation
    try {
      switch (action.type) {
        case 'deleteTrack': {
          if (action.trackSnapshot) {
            const snap = action.trackSnapshot
            const newId = await addTrack({
              name: snap.name,
              path: snap.path,
              length: snap.length,
              createdAt: snap.createdAt,
              comment: snap.comment,
              isHidden: snap.isHidden,
              category: snap.category,
              tagIds: snap.tagIds,
              waveformData: snap.waveformData,
              cuePoints: snap.cuePoints,
              bpm: snap.bpm,
              musicalKey: snap.musicalKey,
              lyrics: snap.lyrics,
              lrcLyrics: snap.lrcLyrics,
              rating: snap.rating,
              playCount: snap.playCount,
              lastPlayedAt: snap.lastPlayedAt,
              isFavorite: snap.isFavorite,
              notes: snap.notes,
              projectId: snap.projectId,
              artworkBlob: snap.artworkBlob,
            })
            if (action.audioBlob) {
              await storeAudioBlob(newId, action.audioBlob)
            }
            // Update the action's trackId for redo
            action.trackId = newId
          }
          break
        }
        case 'updateRating':
          await updateTrack(action.trackId, { rating: action.previousValue as number })
          break
        case 'updateComment':
          await updateTrack(action.trackId, { comment: action.previousValue as string })
          break
        case 'hideTrack':
          await updateTrack(action.trackId, { isHidden: action.previousValue as boolean })
          break
        case 'updateBPM':
          await updateTrack(action.trackId, { bpm: action.previousValue as number })
          break
        case 'updateKey':
          await updateTrack(action.trackId, { musicalKey: action.previousValue as string })
          break
        case 'addTag':
          await updateTrack(action.trackId, { tagIds: action.previousValue as number[] })
          break
        case 'removeTag':
          await updateTrack(action.trackId, { tagIds: action.previousValue as number[] })
          break
        case 'toggleFavorite':
          await updateTrack(action.trackId, { isFavorite: action.previousValue as boolean })
          break
        case 'setProject':
          await updateTrack(action.trackId, { projectId: action.previousValue as number | undefined })
          break
      }
    } catch { /* undo failed */ }

    return action.type
  },

  redo: async () => {
    const { redoStack } = get()
    if (redoStack.length === 0) return null
    const action = redoStack[redoStack.length - 1]
    set(s => ({
      redoStack: s.redoStack.slice(0, -1),
      undoStack: [...s.undoStack, action],
    }))

    try {
      switch (action.type) {
        case 'deleteTrack':
          await dbDeleteTrack(action.trackId)
          break
        case 'updateRating':
          await updateTrack(action.trackId, { rating: action.newValue as number })
          break
        case 'updateComment':
          await updateTrack(action.trackId, { comment: action.newValue as string })
          break
        case 'hideTrack':
          await updateTrack(action.trackId, { isHidden: action.newValue as boolean })
          break
        case 'updateBPM':
          await updateTrack(action.trackId, { bpm: action.newValue as number })
          break
        case 'updateKey':
          await updateTrack(action.trackId, { musicalKey: action.newValue as string })
          break
        case 'addTag':
          await updateTrack(action.trackId, { tagIds: action.newValue as number[] })
          break
        case 'removeTag':
          await updateTrack(action.trackId, { tagIds: action.newValue as number[] })
          break
        case 'toggleFavorite':
          await updateTrack(action.trackId, { isFavorite: action.newValue as boolean })
          break
        case 'setProject':
          await updateTrack(action.trackId, { projectId: action.newValue as number | undefined })
          break
      }
    } catch { /* redo failed */ }

    return action.type
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,
}))
