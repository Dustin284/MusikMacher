import { useState, useMemo, useCallback, useRef } from 'react'
import { usePlayerStore } from '../store/usePlayerStore'
import { useTrackStore } from '../store/useTrackStore'
import { useTranslation } from '../i18n/useTranslation'
import { formatTime } from '../utils/formatTime'
import type { Track } from '../types'

type View = 'artists' | 'albums' | 'artistDetail' | 'albumDetail'

interface MediaBrowserProps {
  tracks: Track[]
}

interface ArtistInfo {
  name: string
  trackCount: number
  albumCount: number
  artwork?: string
  trackIds: number[]
}

interface AlbumInfo {
  name: string
  artist: string
  year?: string
  trackCount: number
  artwork?: string
  trackIds: number[]
}

export default function MediaBrowser({ tracks }: MediaBrowserProps) {
  const { t } = useTranslation()
  const play = usePlayerStore(s => s.play)
  const setTrackList = usePlayerStore(s => s.setTrackList)
  const currentTrackId = usePlayerStore(s => s.currentTrack?.id)
  const isPlaying = usePlayerStore(s => s.isPlaying)
  const updateTrackArtwork = useTrackStore(s => s.updateTrackArtwork)
  const updateMultipleTracksArtwork = useTrackStore(s => s.updateMultipleTracksArtwork)

  const [view, setView] = useState<View>('artists')
  const [selectedArtist, setSelectedArtist] = useState<string>('')
  const [selectedAlbum, setSelectedAlbum] = useState<{ name: string; artist: string }>({ name: '', artist: '' })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingArtworkTargetRef = useRef<number[]>([])

  const unknownArtist = t('mediaBrowser.unknownArtist')
  const unknownAlbum = t('mediaBrowser.unknownAlbum')

  // Pick artwork image via file input
  const pickArtwork = useCallback((targetTrackIds: number[]) => {
    pendingArtworkTargetRef.current = targetTrackIds
    fileInputRef.current?.click()
  }, [])

  const handleArtworkFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || pendingArtworkTargetRef.current.length === 0) return
    const blob = new Blob([await file.arrayBuffer()], { type: file.type })
    await updateMultipleTracksArtwork(pendingArtworkTargetRef.current, blob)
    pendingArtworkTargetRef.current = []
  }, [updateMultipleTracksArtwork])

  // Group by artist
  const artists = useMemo((): ArtistInfo[] => {
    const map = new Map<string, { tracks: Track[]; albums: Set<string> }>()
    for (const track of tracks) {
      const artist = track.artist || unknownArtist
      let entry = map.get(artist)
      if (!entry) {
        entry = { tracks: [], albums: new Set() }
        map.set(artist, entry)
      }
      entry.tracks.push(track)
      entry.albums.add(track.album || unknownAlbum)
    }
    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        trackCount: data.tracks.length,
        albumCount: data.albums.size,
        artwork: data.tracks.find(t => t.artworkUrl)?.artworkUrl,
        trackIds: data.tracks.map(t => t.id!),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [tracks, unknownArtist, unknownAlbum])

  // Group by album
  const albums = useMemo((): AlbumInfo[] => {
    const map = new Map<string, { tracks: Track[]; artist: string; year?: string }>()
    for (const track of tracks) {
      const album = track.album || unknownAlbum
      const artist = track.artist || unknownArtist
      const key = `${artist}|||${album}`
      let entry = map.get(key)
      if (!entry) {
        entry = { tracks: [], artist, year: track.year }
        map.set(key, entry)
      }
      entry.tracks.push(track)
    }
    return Array.from(map.entries())
      .map(([, data]) => ({
        name: data.tracks[0].album || unknownAlbum,
        artist: data.artist,
        year: data.year,
        trackCount: data.tracks.length,
        artwork: data.tracks.find(t => t.artworkUrl)?.artworkUrl,
        trackIds: data.tracks.map(t => t.id!),
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [tracks, unknownArtist, unknownAlbum])

  // Artist detail: albums + tracks for selected artist
  const artistAlbums = useMemo(() => {
    if (view !== 'artistDetail') return []
    const artistTracks = tracks.filter(t => (t.artist || unknownArtist) === selectedArtist)
    const map = new Map<string, Track[]>()
    for (const track of artistTracks) {
      const album = track.album || unknownAlbum
      let arr = map.get(album)
      if (!arr) { arr = []; map.set(album, arr) }
      arr.push(track)
    }
    return Array.from(map.entries())
      .map(([name, albumTracks]) => ({
        name,
        tracks: albumTracks.sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0)),
        artwork: albumTracks.find(t => t.artworkUrl)?.artworkUrl,
        year: albumTracks[0]?.year,
        trackIds: albumTracks.map(t => t.id!),
      }))
      .sort((a, b) => (a.year || '').localeCompare(b.year || ''))
  }, [tracks, view, selectedArtist, unknownArtist, unknownAlbum])

  // Album detail: tracks for selected album
  const albumTracks = useMemo(() => {
    if (view !== 'albumDetail') return []
    return tracks
      .filter(t =>
        (t.artist || unknownArtist) === selectedAlbum.artist &&
        (t.album || unknownAlbum) === selectedAlbum.name
      )
      .sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0))
  }, [tracks, view, selectedAlbum, unknownArtist, unknownAlbum])

  const handlePlayAll = useCallback((trackList: Track[]) => {
    if (trackList.length === 0) return
    setTrackList(trackList)
    play(trackList[0])
  }, [play, setTrackList])

  const handlePlayTrack = useCallback((track: Track, list: Track[]) => {
    setTrackList(list)
    play(track)
  }, [play, setTrackList])

  const navigateToArtist = (name: string) => {
    setSelectedArtist(name)
    setView('artistDetail')
  }

  const navigateToAlbum = (name: string, artist: string) => {
    setSelectedAlbum({ name, artist })
    setView('albumDetail')
  }

  const goBack = () => {
    if (view === 'albumDetail' && selectedAlbum.artist) {
      setSelectedArtist(selectedAlbum.artist)
      setView('artistDetail')
    } else {
      setView('artists')
    }
  }

  const MusicFallback = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
    const sizeClass = size === 'lg' ? 'w-48 h-48' : size === 'md' ? 'w-full h-full' : 'w-8 h-8'
    const iconClass = size === 'lg' ? 'w-16 h-16' : size === 'md' ? 'w-10 h-10' : 'w-4 h-4'
    return (
      <div className={`${sizeClass} rounded-xl bg-gradient-to-br from-surface-300 to-surface-400 dark:from-surface-600 dark:to-surface-700 flex items-center justify-center`}>
        <svg className={`${iconClass} text-surface-200 dark:text-surface-500`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      </div>
    )
  }

  // Edit overlay for covers
  const EditOverlay = () => (
    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
      <svg className="w-6 h-6 text-white drop-shadow-md" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </div>
  )

  // --- Tab bar ---
  const TabBar = () => (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-surface-200/60 dark:border-surface-800/60">
      {(view === 'artistDetail' || view === 'albumDetail') && (
        <button
          onClick={goBack}
          className="p-1.5 rounded-lg hover:bg-surface-200/80 dark:hover:bg-surface-800/80 text-surface-500 transition-colors mr-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      {view !== 'artistDetail' && view !== 'albumDetail' && (
        <>
          <button
            onClick={() => setView('artists')}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
              view === 'artists'
                ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                : 'text-surface-500 hover:bg-surface-200/60 dark:hover:bg-surface-800/60'
            }`}
          >
            {t('mediaBrowser.artists')}
          </button>
          <button
            onClick={() => setView('albums')}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
              view === 'albums'
                ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400'
                : 'text-surface-500 hover:bg-surface-200/60 dark:hover:bg-surface-800/60'
            }`}
          >
            {t('mediaBrowser.albums')}
          </button>
        </>
      )}
      {view === 'artistDetail' && (
        <h2 className="text-[15px] font-semibold text-surface-700 dark:text-surface-300 truncate">{selectedArtist}</h2>
      )}
      {view === 'albumDetail' && (
        <h2 className="text-[15px] font-semibold text-surface-700 dark:text-surface-300 truncate">{selectedAlbum.name}</h2>
      )}
    </div>
  )

  // Hidden file input for artwork picking
  const ArtworkInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={handleArtworkFileChange}
    />
  )

  // --- Artist Grid ---
  if (view === 'artists') {
    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {ArtworkInput}
        <TabBar />
        <div className="flex-1 overflow-auto p-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {artists.map(artist => (
              <div
                key={artist.name}
                className="group flex flex-col items-center gap-2.5 p-3 rounded-xl hover:bg-surface-100/80 dark:hover:bg-surface-800/60 transition-all cursor-pointer"
                onClick={() => navigateToArtist(artist.name)}
              >
                <div className="relative w-full aspect-square rounded-xl overflow-hidden shadow-md group-hover:shadow-lg transition-shadow group/cover">
                  {artist.artwork ? (
                    <img src={artist.artwork} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <MusicFallback />
                  )}
                  <div
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl"
                    onClick={(e) => { e.stopPropagation(); pickArtwork(artist.trackIds) }}
                    title={t('mediaBrowser.changeCover')}
                  >
                    <svg className="w-6 h-6 text-white drop-shadow-md" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </div>
                <div className="w-full text-center">
                  <p className="text-[13px] font-semibold text-surface-700 dark:text-surface-300 truncate">{artist.name}</p>
                  <p className="text-[11px] text-surface-400 dark:text-surface-500">
                    {artist.trackCount} {t('mediaBrowser.tracks')} &middot; {artist.albumCount} {t('mediaBrowser.albums')}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {artists.length === 0 && (
            <div className="flex items-center justify-center h-32 text-surface-400 text-sm">{t('browse.noTracks')}</div>
          )}
        </div>
      </div>
    )
  }

  // --- Album Grid ---
  if (view === 'albums') {
    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {ArtworkInput}
        <TabBar />
        <div className="flex-1 overflow-auto p-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {albums.map(album => (
              <div
                key={`${album.artist}|||${album.name}`}
                className="group flex flex-col items-center gap-2.5 p-3 rounded-xl hover:bg-surface-100/80 dark:hover:bg-surface-800/60 transition-all cursor-pointer"
                onClick={() => navigateToAlbum(album.name, album.artist)}
              >
                <div className="relative w-full aspect-square rounded-xl overflow-hidden shadow-md group-hover:shadow-lg transition-shadow">
                  {album.artwork ? (
                    <img src={album.artwork} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <MusicFallback />
                  )}
                  <div
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl"
                    onClick={(e) => { e.stopPropagation(); pickArtwork(album.trackIds) }}
                    title={t('mediaBrowser.changeCover')}
                  >
                    <svg className="w-6 h-6 text-white drop-shadow-md" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </div>
                <div className="w-full text-center">
                  <p className="text-[13px] font-semibold text-surface-700 dark:text-surface-300 truncate">{album.name}</p>
                  <p className="text-[11px] text-surface-400 dark:text-surface-500 truncate">{album.artist}</p>
                  <p className="text-[11px] text-surface-400 dark:text-surface-500">
                    {album.year && `${album.year} · `}{album.trackCount} {t('mediaBrowser.tracks')}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {albums.length === 0 && (
            <div className="flex items-center justify-center h-32 text-surface-400 text-sm">{t('browse.noTracks')}</div>
          )}
        </div>
      </div>
    )
  }

  // --- Artist Detail ---
  if (view === 'artistDetail') {
    const allArtistTracks = tracks.filter(t => (t.artist || unknownArtist) === selectedArtist)
    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {ArtworkInput}
        <TabBar />
        <div className="flex-1 overflow-auto p-4">
          {/* Albums grid */}
          <div className="mb-6">
            <h3 className="text-[12px] font-semibold text-surface-400 uppercase tracking-wider mb-3">{t('mediaBrowser.albums')}</h3>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
              {artistAlbums.map(album => (
                <div
                  key={album.name}
                  className="group flex flex-col items-center gap-2 p-2.5 rounded-xl hover:bg-surface-100/80 dark:hover:bg-surface-800/60 transition-all cursor-pointer"
                  onClick={() => navigateToAlbum(album.name, selectedArtist)}
                >
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden shadow-sm group-hover:shadow-md transition-shadow">
                    {album.artwork ? (
                      <img src={album.artwork} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <MusicFallback />
                    )}
                    <div
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg"
                      onClick={(e) => { e.stopPropagation(); pickArtwork(album.trackIds) }}
                      title={t('mediaBrowser.changeCover')}
                    >
                      <svg className="w-5 h-5 text-white drop-shadow-md" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="w-full text-center">
                    <p className="text-[12px] font-semibold text-surface-700 dark:text-surface-300 truncate">{album.name}</p>
                    <p className="text-[11px] text-surface-400">{album.year && `${album.year} · `}{album.tracks.length} {t('mediaBrowser.tracks')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* All tracks */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[12px] font-semibold text-surface-400 uppercase tracking-wider">{t('mediaBrowser.tracks')}</h3>
              <button
                onClick={() => handlePlayAll(allArtistTracks)}
                className="px-3 py-1 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-[12px] font-medium transition-colors"
              >
                {t('mediaBrowser.playAll')}
              </button>
            </div>
            <TrackList
              tracks={allArtistTracks}
              currentTrackId={currentTrackId}
              isPlaying={isPlaying}
              onPlay={(track) => handlePlayTrack(track, allArtistTracks)}
              onChangeArtwork={(trackId) => pickArtwork([trackId])}
            />
          </div>
        </div>
      </div>
    )
  }

  // --- Album Detail ---
  if (view === 'albumDetail') {
    const albumArtwork = albumTracks.find(t => t.artworkUrl)?.artworkUrl
    const albumTrackIds = albumTracks.map(t => t.id!)
    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {ArtworkInput}
        <TabBar />
        <div className="flex-1 overflow-auto p-4">
          <div className="flex gap-6 mb-6">
            {/* Cover */}
            <div
              className="shrink-0 relative group/cover cursor-pointer"
              onClick={() => pickArtwork(albumTrackIds)}
              title={t('mediaBrowser.changeCover')}
            >
              {albumArtwork ? (
                <img src={albumArtwork} alt="" className="w-48 h-48 rounded-xl object-cover shadow-lg" />
              ) : (
                <MusicFallback size="lg" />
              )}
              <EditOverlay />
            </div>
            {/* Info */}
            <div className="flex flex-col justify-end gap-2 min-w-0">
              <p className="text-[12px] text-surface-400 uppercase tracking-wider font-semibold">{t('mediaBrowser.albums')}</p>
              <h2 className="text-2xl font-bold text-surface-800 dark:text-surface-200 truncate">{selectedAlbum.name}</h2>
              <p className="text-[14px] text-surface-500">{selectedAlbum.artist}</p>
              <p className="text-[13px] text-surface-400">
                {albumTracks[0]?.year && `${albumTracks[0].year} · `}
                {albumTracks.length} {t('mediaBrowser.tracks')} &middot; {formatTime(albumTracks.reduce((sum, t) => sum + t.length, 0))}
              </p>
              <button
                onClick={() => handlePlayAll(albumTracks)}
                className="mt-2 self-start px-4 py-1.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-[13px] font-medium transition-colors shadow-sm shadow-primary-500/20"
              >
                {t('mediaBrowser.playAll')}
              </button>
            </div>
          </div>

          {/* Track list */}
          <TrackList
            tracks={albumTracks}
            currentTrackId={currentTrackId}
            isPlaying={isPlaying}
            onPlay={(track) => handlePlayTrack(track, albumTracks)}
            onChangeArtwork={(trackId) => pickArtwork([trackId])}
            showNumber
          />
        </div>
      </div>
    )
  }

  return null
}

function TrackList({ tracks, currentTrackId, isPlaying, onPlay, onChangeArtwork, showNumber }: {
  tracks: Track[]
  currentTrackId?: number
  isPlaying: boolean
  onPlay: (track: Track) => void
  onChangeArtwork?: (trackId: number) => void
  showNumber?: boolean
}) {
  const moodColor = (mood?: string) => {
    switch (mood) {
      case 'Fröhlich': return 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'
      case 'Melancholisch': return 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
      case 'Aggressiv': return 'bg-red-500/15 text-red-600 dark:text-red-400'
      case 'Entspannt': return 'bg-green-500/15 text-green-600 dark:text-green-400'
      case 'Episch': return 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
      case 'Mysteriös': return 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
      case 'Romantisch': return 'bg-pink-500/15 text-pink-600 dark:text-pink-400'
      case 'Düster': return 'bg-slate-500/15 text-slate-600 dark:text-slate-400'
      default: return ''
    }
  }

  return (
    <div className="flex flex-col">
      {tracks.map((track, i) => {
        const isCurrent = currentTrackId === track.id
        return (
          <div
            key={track.id}
            className={`group/row flex items-center gap-3 px-3 py-2 rounded-lg transition-all cursor-pointer ${
              isCurrent
                ? 'bg-primary-500/10 dark:bg-primary-500/[0.08]'
                : 'hover:bg-surface-100/80 dark:hover:bg-surface-800/40'
            }`}
            onClick={() => onPlay(track)}
          >
            {/* Number or playing indicator */}
            <span className="w-6 text-right text-[12px] tabular-nums font-mono text-surface-400 shrink-0">
              {isCurrent && isPlaying ? (
                <span className="flex items-end justify-end gap-[2px] h-3.5">
                  <span className="w-[2px] rounded-full bg-primary-500 eq-bar-1" />
                  <span className="w-[2px] rounded-full bg-primary-500 eq-bar-2" />
                  <span className="w-[2px] rounded-full bg-primary-500 eq-bar-3" />
                </span>
              ) : (
                showNumber ? (track.trackNumber || i + 1) : (i + 1)
              )}
            </span>

            {/* Track artwork thumbnail */}
            <div
              className="relative w-8 h-8 rounded-md overflow-hidden shrink-0 group/thumb"
              onClick={(e) => { e.stopPropagation(); onChangeArtwork?.(track.id!) }}
            >
              {track.artworkUrl ? (
                <img src={track.artworkUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-surface-200 dark:bg-surface-700 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-surface-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                  </svg>
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>

            {/* Name */}
            <span className={`flex-1 text-[13px] truncate ${isCurrent ? 'text-primary-600 dark:text-primary-400 font-semibold' : 'text-surface-700 dark:text-surface-300'}`}>
              {track.name}
            </span>

            {/* BPM */}
            {track.bpm && (
              <span className="text-[11px] text-surface-400 tabular-nums font-mono shrink-0">{Math.round(track.bpm)}</span>
            )}

            {/* Key */}
            {track.musicalKey && (
              <span className="text-[11px] text-surface-400 shrink-0 w-8">{track.musicalKey}</span>
            )}

            {/* Mood pill */}
            {track.mood && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${moodColor(track.mood)}`}>
                {track.mood}
              </span>
            )}

            {/* Energy */}
            {track.energy && (
              <span className={`text-[11px] tabular-nums font-mono shrink-0 w-4 text-right ${
                track.energy >= 7 ? 'text-red-500' : track.energy >= 4 ? 'text-amber-500' : 'text-blue-500'
              }`}>
                {track.energy}
              </span>
            )}

            {/* Duration */}
            <span className="text-[11px] text-surface-400 tabular-nums font-mono shrink-0 w-10 text-right">
              {formatTime(track.length)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
