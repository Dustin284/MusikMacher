import { create } from 'zustand'

interface TwitchState {
  connected: boolean
  channel: string
  currentDownload: string | null
}

export const useTwitchStore = create<TwitchState>(() => ({
  connected: false,
  channel: '',
  currentDownload: null,
}))
