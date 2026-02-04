import { create } from 'zustand'
import { getProjects, addProject, updateProject, deleteProject, clearProjectFromTracks } from '../db/database'
import type { Project } from '../types'

interface ProjectStore {
  projects: Project[]
  loaded: boolean
  selectedProjectId: number | null

  loadProjects: () => Promise<void>
  addProject: (name: string, customerName?: string) => Promise<number>
  removeProject: (id: number) => Promise<void>
  updateProject: (id: number, changes: Partial<Project>) => Promise<void>
  selectProject: (id: number | null) => void
  setSelectedProject: (id: number | null) => void
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  loaded: false,
  selectedProjectId: null,

  loadProjects: async () => {
    const projects = await getProjects()
    set({ projects, loaded: true })
  },

  addProject: async (name: string, customerName?: string) => {
    const { projects } = get()
    // New project gets order after the last one
    const maxOrder = projects.reduce((max, p) => Math.max(max, p.order), -1)

    const id = await addProject({
      name,
      customerName,
      order: maxOrder + 1,
    })

    const newProject: Project = {
      id,
      name,
      customerName,
      order: maxOrder + 1,
    }
    set({ projects: [...projects, newProject] })
    return id
  },

  removeProject: async (id: number) => {
    const { projects, selectedProjectId } = get()
    await clearProjectFromTracks(id)
    await deleteProject(id)
    set({
      projects: projects.filter((p) => p.id !== id),
      // Deselect if the removed project was selected
      selectedProjectId: selectedProjectId === id ? null : selectedProjectId,
    })
  },

  updateProject: async (id: number, changes: Partial<Project>) => {
    const { projects } = get()
    await updateProject(id, changes)
    set({
      projects: projects.map((p) =>
        p.id === id ? { ...p, ...changes } : p,
      ),
    })
  },

  selectProject: (id: number | null) => {
    set({ selectedProjectId: id })
  },

  setSelectedProject: (id: number | null) => {
    set({ selectedProjectId: id })
  },
}))
