import { create } from 'zustand'
import { getLibraries, addLibrary, updateLibrary, deleteLibrary, countTracks } from '../db/database'
import type { Library } from '../types'

interface LibraryStore {
  libraries: Library[]
  loaded: boolean

  loadLibraries: () => Promise<void>
  addLibrary: (name: string, icon?: string) => Promise<number>
  removeLibrary: (id: number) => Promise<boolean>
  renameLibrary: (id: number, name: string) => Promise<void>
  reorderLibrary: (id: number, newOrder: number) => Promise<void>
  toggleOpen: (id: number) => Promise<void>
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  libraries: [],
  loaded: false,

  loadLibraries: async () => {
    let libraries = await getLibraries()

    // Deduplicate: keep only the first library per name
    const seen = new Map<string, number>()
    const duplicateIds: number[] = []
    for (const lib of libraries) {
      if (seen.has(lib.name)) {
        if (lib.id != null) duplicateIds.push(lib.id)
      } else {
        seen.set(lib.name, lib.id!)
      }
    }
    if (duplicateIds.length > 0) {
      for (const id of duplicateIds) {
        await deleteLibrary(id)
      }
      libraries = libraries.filter(l => !duplicateIds.includes(l.id!))
    }

    set({ libraries, loaded: true })
  },

  addLibrary: async (name: string, icon?: string) => {
    const { libraries } = get()
    // New library gets order after the last one
    const maxOrder = libraries.reduce((max, lib) => Math.max(max, lib.order), -1)
    const id = await addLibrary({
      name,
      icon,
      order: maxOrder + 1,
      isOpen: true,
    })

    const newLib: Library = {
      id,
      name,
      icon,
      order: maxOrder + 1,
      isOpen: true,
    }
    set({ libraries: [...libraries, newLib] })
    return id
  },

  removeLibrary: async (id: number): Promise<boolean> => {
    // Prevent deletion of default libraries (Songs=1, Effekte=2)
    if (id === 1 || id === 2) return false
    // Prevent deletion if library contains tracks
    const count = await countTracks(id)
    if (count > 0) return false
    const { libraries } = get()
    await deleteLibrary(id)
    set({ libraries: libraries.filter((lib) => lib.id !== id) })
    return true
  },

  renameLibrary: async (id: number, name: string) => {
    const { libraries } = get()
    await updateLibrary(id, { name })
    set({
      libraries: libraries.map((lib) =>
        lib.id === id ? { ...lib, name } : lib,
      ),
    })
  },

  reorderLibrary: async (id: number, newOrder: number) => {
    const { libraries } = get()
    const lib = libraries.find((l) => l.id === id)
    if (!lib) return

    const oldOrder = lib.order
    if (oldOrder === newOrder) return

    // Shift other libraries to make room
    const updated = libraries.map((l) => {
      if (l.id === id) {
        return { ...l, order: newOrder }
      }
      // Moving down: shift items in between up
      if (oldOrder < newOrder && l.order > oldOrder && l.order <= newOrder) {
        return { ...l, order: l.order - 1 }
      }
      // Moving up: shift items in between down
      if (oldOrder > newOrder && l.order >= newOrder && l.order < oldOrder) {
        return { ...l, order: l.order + 1 }
      }
      return l
    })

    // Sort by order
    updated.sort((a, b) => a.order - b.order)
    set({ libraries: updated })

    // Persist all changed orders
    for (const l of updated) {
      const original = libraries.find((o) => o.id === l.id)
      if (original && original.order !== l.order) {
        await updateLibrary(l.id!, { order: l.order })
      }
    }
  },

  toggleOpen: async (id: number) => {
    const { libraries } = get()
    const lib = libraries.find((l) => l.id === id)
    if (!lib) return

    const newOpen = !lib.isOpen
    await updateLibrary(id, { isOpen: newOpen })
    set({
      libraries: libraries.map((l) =>
        l.id === id ? { ...l, isOpen: newOpen } : l,
      ),
    })
  },
}))
