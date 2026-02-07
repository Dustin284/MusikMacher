import { create } from 'zustand'

interface PlaylistProgressState {
  percent: number
  phase: string
  current: number
  total: number
  trackName: string
  reset: () => void
}

export const usePlaylistProgress = create<PlaylistProgressState>((set) => ({
  percent: 0,
  phase: '',
  current: 0,
  total: 0,
  trackName: '',
  reset: () => set({ percent: 0, phase: '', current: 0, total: 0, trackName: '' }),
}))
