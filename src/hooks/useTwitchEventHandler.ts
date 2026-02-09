import { useEffect } from 'react'
import { useTwitchStore } from '../store/useTwitchStore'
import { usePlayerStore } from '../store/usePlayerStore'
import { useTrackStore } from '../store/useTrackStore'
import { useSettingsStore } from '../store/useSettingsStore'
import { db } from '../db/database'
import { CATEGORY_TRACKS } from '../types'

/** Normalize a string for fuzzy matching: strip special chars, fullwidth→ASCII, lowercase */
function normalizeForMatch(str: string): string {
  return str
    .replace(/\.(mp3|wav|m4a|ogg|flac|webm|opus|aac|wma)$/i, '')
    .replace(/\s+by\s+.+$/i, '')
    // Fullwidth Unicode chars (｜ etc.) → ASCII equivalents
    .replace(/[\uFF01-\uFF5E]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    // Strip everything except letters, numbers, whitespace
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function useTwitchEventHandler() {
  // Listen for Twitch events from main process
  useEffect(() => {
    if (!window.electronAPI?.onTwitchEvent) return
    window.electronAPI.onTwitchEvent((data) => {
      switch (data.type) {
        case 'connected':
          useTwitchStore.setState({ connected: true, channel: data.channel || '' })
          break
        case 'disconnected':
          useTwitchStore.setState({ connected: false })
          break
        case 'skip':
        case 'voteskip-reached': {
          const store = usePlayerStore.getState()
          if (store.queue.length > 0) {
            store.playNext()
          } else {
            // No queue — skip to next in track list or stop
            const { trackList, currentTrack, playbackMode } = store
            if (trackList.length > 0 && currentTrack) {
              if (playbackMode === 'shuffle') {
                const others = trackList.filter(t => t.id !== currentTrack.id)
                if (others.length > 0) store.play(others[Math.floor(Math.random() * others.length)])
                else store.stop()
              } else {
                const idx = trackList.findIndex(t => t.id === currentTrack.id)
                if (idx >= 0 && idx < trackList.length - 1) store.play(trackList[idx + 1])
                else store.play(trackList[0]) // wrap around
              }
            } else {
              store.stop()
            }
          }
          break
        }
        case 'song-query': {
          const { currentTrack } = usePlayerStore.getState()
          if (currentTrack) {
            const artist = currentTrack.artist ? `${currentTrack.artist} - ` : ''
            window.electronAPI?.twitchSay?.(`Aktueller Song: ${artist}${currentTrack.name}`)
          } else {
            window.electronAPI?.twitchSay?.('Gerade wird nichts abgespielt.')
          }
          break
        }
        case 'sr-downloading':
          useTwitchStore.setState({ currentDownload: data.username || null })
          break
      }
    })
  }, [])

  // Title resolved — check DB for existing track before downloading
  useEffect(() => {
    if (!window.electronAPI?.onTwitchSrResolved) return
    window.electronAPI.onTwitchSrResolved(async (data) => {
      const { title, downloadUrl, username } = data

      if (title) {
        const normalizedTitle = normalizeForMatch(title)

        // Search DB for existing track — compare normalized name and "artist name" combo
        const allTracks = await db.tracks.toArray()
        const existing = allTracks.find(t => {
          const nameNorm = normalizeForMatch(t.name)
          // Reconstruct full "artist name" as yt-dlp would title it
          const fullNorm = t.artist ? normalizeForMatch(`${t.artist} ${t.name}`) : nameNorm

          // Exact match on name-only or full artist+name
          if (nameNorm === normalizedTitle || fullNorm === normalizedTitle) return true
          // Substring match (min 4 chars to avoid false positives)
          if (nameNorm.length >= 4 && normalizedTitle.includes(nameNorm)) return true
          if (normalizedTitle.length >= 4 && nameNorm.includes(normalizedTitle)) return true
          if (fullNorm !== nameNorm && fullNorm.length >= 4 && normalizedTitle.includes(fullNorm)) return true
          return false
        })

        if (existing) {
          usePlayerStore.getState().addToQueue(existing)
          const artist = existing.artist ? `${existing.artist} - ` : ''
          window.electronAPI?.twitchSay?.(`@${username} Song existiert bereits, hinzugefuegt: ${artist}${existing.name}`)
          useTwitchStore.setState({ currentDownload: null })
          return
        }
      }

      // Not found in DB — proceed with download
      window.electronAPI?.twitchDownloadSr?.(downloadUrl, username)
    })
  }, [])

  // Download complete — import track without contaminating current category view
  useEffect(() => {
    if (!window.electronAPI?.onTwitchSrReady) return
    window.electronAPI.onTwitchSrReady(async (data) => {
      useTwitchStore.setState({ currentDownload: null })

      // Save current store state before import (importDownloadedTrack overwrites with CATEGORY_TRACKS)
      const prevTracks = useTrackStore.getState().tracks
      const prevTags = useTrackStore.getState().tags

      const srCategory = useSettingsStore.getState().settings.twitchSrCategory ?? CATEGORY_TRACKS
      const { trackId } = await useTrackStore.getState().importDownloadedTrack(
        data.fileData, data.fileName, data.filePath, srCategory
      )

      // Restore store to prevent category contamination in Browse view
      useTrackStore.setState({ tracks: prevTracks, tags: prevTags })

      if (trackId) {
        // Get track directly from DB (not from store)
        const track = await db.tracks.get(trackId)
        if (track) {
          usePlayerStore.getState().addToQueue(track)
        }
      }
    })
  }, [])

  // Reset voteskip on track change
  useEffect(() => {
    let lastTrackId: number | undefined = undefined
    const unsub = usePlayerStore.subscribe((state) => {
      const trackId = state.currentTrack?.id
      if (trackId !== lastTrackId) {
        lastTrackId = trackId
        window.electronAPI?.twitchResetVoteskip?.()
      }
    })
    return unsub
  }, [])
}
