import { useState, useEffect, useMemo } from 'react'
import { getAllTracks, getLibraries, db } from '../db/database'
import { useTranslation } from '../i18n/useTranslation'
import { formatTime } from '../utils/formatTime'
import type { Track, Library, Tag } from '../types'
import type { TranslationKey } from '../i18n/translations'

interface StatsData {
  totalTracks: number
  totalDurationFormatted: string
  totalPlays: number
  avgRating: string
  mostPlayed: { track: Track; playCount: number }[]
  premiereProjects: { name: string; trackCount: number }[]
  bpmBuckets: { label: string; value: number }[]
  keyDistribution: { label: string; value: number }[]
  ratingDistribution: { label: string; value: number; star?: boolean }[]
  tagUsage: { label: string; value: number }[]
  recentlyAdded: Track[]
  libraryBreakdown: { name: string; count: number; totalDuration: number }[]
}

function computeStats(tracks: Track[], libraries: Library[], tags: Tag[], t: (k: TranslationKey) => string): StatsData {
  const totalTracks = tracks.length
  const totalDuration = tracks.reduce((sum, tr) => sum + (tr.length || 0), 0)
  const totalPlays = tracks.reduce((sum, tr) => sum + (tr.playCount ?? 0), 0)

  const ratedTracks = tracks.filter(tr => tr.rating && tr.rating > 0)
  const avgRating = ratedTracks.length > 0
    ? (ratedTracks.reduce((s, tr) => s + (tr.rating ?? 0), 0) / ratedTracks.length).toFixed(1)
    : '--'

  // Most played (top 10)
  const mostPlayed = [...tracks]
    .filter(tr => (tr.playCount ?? 0) > 0)
    .sort((a, b) => (b.playCount ?? 0) - (a.playCount ?? 0))
    .slice(0, 10)
    .map(tr => ({ track: tr, playCount: tr.playCount ?? 0 }))

  // Premiere projects
  const projectMap = new Map<string, Set<number>>()
  for (const track of tracks) {
    if (track.premiereUsage) {
      for (const usage of track.premiereUsage) {
        const set = projectMap.get(usage.projectName) ?? new Set()
        set.add(track.id!)
        projectMap.set(usage.projectName, set)
      }
    }
  }
  const premiereProjects = [...projectMap.entries()]
    .map(([name, ids]) => ({ name, trackCount: ids.size }))
    .sort((a, b) => b.trackCount - a.trackCount)

  // BPM distribution
  const bpmRanges: [number, number][] = [[0, 80], [80, 100], [100, 120], [120, 140], [140, 160], [160, 200], [200, Infinity]]
  const bpmLabels = ['<80', '80-100', '100-120', '120-140', '140-160', '160-200', '200+']
  const bpmBuckets: { label: string; value: number }[] = []
  for (let i = 0; i < bpmRanges.length; i++) {
    const count = tracks.filter(tr => tr.bpm && tr.bpm >= bpmRanges[i][0] && tr.bpm < bpmRanges[i][1]).length
    if (count > 0) bpmBuckets.push({ label: bpmLabels[i], value: count })
  }

  // Key distribution
  const keyMap = new Map<string, number>()
  for (const track of tracks) {
    if (track.musicalKey) {
      keyMap.set(track.musicalKey, (keyMap.get(track.musicalKey) ?? 0) + 1)
    }
  }
  const keyDistribution = [...keyMap.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)

  // Rating distribution
  const ratingDistribution = [0, 1, 2, 3, 4, 5].map(r => ({
    label: r === 0 ? t('stats.unrated') : '\u2605'.repeat(r),
    value: tracks.filter(tr => (tr.rating ?? 0) === r).length,
    star: r > 0,
  }))

  // Tag usage (top 15)
  const tagCountMap = new Map<number, number>()
  for (const track of tracks) {
    for (const tagId of track.tagIds) {
      tagCountMap.set(tagId, (tagCountMap.get(tagId) ?? 0) + 1)
    }
  }
  const tagUsage = [...tagCountMap.entries()]
    .map(([tagId, count]) => {
      const tag = tags.find(tg => tg.id === tagId)
      return { label: tag?.name ?? `#${tagId}`, value: count }
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 15)

  // Recently added (last 10)
  const recentlyAdded = [...tracks]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)

  // Library breakdown
  const libraryBreakdown = libraries.map(lib => {
    const libTracks = tracks.filter(tr => tr.category === lib.id)
    return {
      name: lib.name,
      count: libTracks.length,
      totalDuration: libTracks.reduce((s, tr) => s + (tr.length || 0), 0),
    }
  })

  // Format total duration
  const hours = Math.floor(totalDuration / 3600)
  const minutes = Math.floor((totalDuration % 3600) / 60)
  const totalDurationFormatted = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`

  return {
    totalTracks, totalDurationFormatted, totalPlays, avgRating,
    mostPlayed, premiereProjects, bpmBuckets, keyDistribution,
    ratingDistribution, tagUsage, recentlyAdded, libraryBreakdown,
  }
}

// --- Sub-components ---

function StatCard({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="bg-white/60 dark:bg-surface-800/40 backdrop-blur-sm rounded-xl p-4 border border-surface-200/60 dark:border-surface-800/60">
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
        <span className="text-[11px] font-semibold text-surface-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-surface-800 dark:text-surface-100 tracking-tight">{value}</div>
    </div>
  )
}

function DashboardSection({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
        <h3 className="text-[12px] font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="bg-white/60 dark:bg-surface-800/40 backdrop-blur-sm rounded-xl p-4 border border-surface-200/60 dark:border-surface-800/60">
        {children}
      </div>
    </div>
  )
}

function BarChart({ data, color = 'primary' }: { data: { label: string; value: number }[]; color?: 'primary' | 'amber' | 'violet' }) {
  const max = Math.max(...data.map(d => d.value), 1)
  const barColors = { primary: 'bg-primary-500', amber: 'bg-amber-400 dark:bg-amber-500', violet: 'bg-violet-500' }

  if (data.length === 0) return <EmptyState />

  return (
    <div className="flex flex-col gap-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[11px] text-surface-500 w-16 shrink-0 text-right truncate" title={item.label}>{item.label}</span>
          <div className="flex-1 h-5 bg-surface-200/40 dark:bg-surface-700/30 rounded-full overflow-hidden">
            <div
              className={`h-full ${barColors[color]} rounded-full transition-all duration-700 ease-out`}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-surface-500 w-8 shrink-0 text-right">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

function RatingBars({ data }: { data: { label: string; value: number; star?: boolean }[] }) {
  const max = Math.max(...data.map(d => d.value), 1)

  return (
    <div className="flex flex-col gap-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className={`text-[11px] w-20 shrink-0 text-right ${item.star ? 'text-amber-500' : 'text-surface-400'}`}>
            {item.label}
          </span>
          <div className="flex-1 h-5 bg-surface-200/40 dark:bg-surface-700/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 dark:bg-amber-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          <span className="text-[11px] font-mono text-surface-500 w-8 shrink-0 text-right">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

function TopTracksList({ tracks, noPlaysText }: { tracks: { track: Track; playCount: number }[]; noPlaysText: string }) {
  if (tracks.length === 0) return <p className="text-[13px] text-surface-400 text-center py-4">{noPlaysText}</p>

  return (
    <div className="flex flex-col gap-0.5">
      {tracks.map((item, i) => (
        <div key={item.track.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-surface-100/60 dark:hover:bg-surface-700/30 transition-colors">
          <span className="text-[12px] font-bold text-surface-400 w-5 text-right tabular-nums">{i + 1}</span>
          <div className="flex-1 min-w-0">
            <span className="text-[13px] text-surface-700 dark:text-surface-300 truncate block">{item.track.name}</span>
          </div>
          <span className="text-[11px] font-mono text-primary-500 bg-primary-500/10 px-2 py-0.5 rounded-full shrink-0">
            {item.playCount}x
          </span>
        </div>
      ))}
    </div>
  )
}

function PremiereUsageWidget({ projects, noDataText }: { projects: { name: string; trackCount: number }[]; noDataText: string }) {
  if (projects.length === 0) return <p className="text-[13px] text-surface-400 text-center py-4">{noDataText}</p>

  return (
    <div className="flex flex-col gap-0.5">
      {projects.map((proj, i) => (
        <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-surface-100/60 dark:hover:bg-surface-700/30 transition-colors">
          <svg className="w-4 h-4 text-surface-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4" />
          </svg>
          <span className="text-[13px] text-surface-700 dark:text-surface-300 truncate flex-1">{proj.name}</span>
          <span className="text-[11px] font-mono text-violet-500 bg-violet-500/10 px-2 py-0.5 rounded-full shrink-0">
            {proj.trackCount} tracks
          </span>
        </div>
      ))}
    </div>
  )
}

function RecentTracksList({ tracks, noDataText }: { tracks: Track[]; noDataText: string }) {
  if (tracks.length === 0) return <p className="text-[13px] text-surface-400 text-center py-4">{noDataText}</p>

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
      {tracks.map((track) => {
        const date = new Date(track.createdAt)
        const dateStr = date.toLocaleDateString()
        return (
          <div key={track.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-surface-100/60 dark:hover:bg-surface-700/30 transition-colors">
            <div className="flex-1 min-w-0">
              <span className="text-[13px] text-surface-700 dark:text-surface-300 truncate block">{track.name}</span>
            </div>
            <span className="text-[10px] font-mono text-surface-400 shrink-0">{formatTime(track.length)}</span>
            <span className="text-[10px] font-mono text-surface-400 shrink-0">{dateStr}</span>
          </div>
        )
      })}
    </div>
  )
}

const libraryColors = ['bg-primary-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-emerald-500']

function LibraryBreakdown({ data }: { data: { name: string; count: number; totalDuration: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  if (total === 0) return <EmptyState />

  return (
    <div>
      {/* Stacked bar */}
      <div className="h-8 flex rounded-full overflow-hidden mb-4">
        {data.map((item, i) => (
          <div
            key={item.name}
            className={`${libraryColors[i % libraryColors.length]} transition-all duration-700 ease-out`}
            style={{ width: `${(item.count / total) * 100}%` }}
            title={`${item.name}: ${item.count}`}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="grid grid-cols-2 gap-2">
        {data.map((item, i) => {
          const hours = Math.floor(item.totalDuration / 3600)
          const mins = Math.floor((item.totalDuration % 3600) / 60)
          const durStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
          return (
            <div key={item.name} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full shrink-0 ${libraryColors[i % libraryColors.length]}`} />
              <span className="text-[12px] text-surface-600 dark:text-surface-400 truncate">{item.name}</span>
              <span className="text-[11px] text-surface-400 ml-auto shrink-0">{item.count} &middot; {durStr}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EmptyState() {
  return <p className="text-[13px] text-surface-400 text-center py-4">--</p>
}

// --- Main Component ---

export default function Statistics() {
  const { t } = useTranslation()
  const [tracks, setTracks] = useState<Track[]>([])
  const [libraries, setLibraries] = useState<Library[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [allTracks, allLibraries, allTags] = await Promise.all([
        getAllTracks(),
        getLibraries(),
        db.tags.toArray(),
      ])
      setTracks(allTracks)
      setLibraries(allLibraries)
      setTags(allTags)
      setLoading(false)
    }
    load()
  }, [])

  const stats = useMemo(() => computeStats(tracks, libraries, tags, t), [tracks, libraries, tags, t])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto overflow-y-auto h-full">
      {/* Hero stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"
          label={t('stats.totalTracks')}
          value={stats.totalTracks}
        />
        <StatCard
          icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          label={t('stats.totalDuration')}
          value={stats.totalDurationFormatted}
        />
        <StatCard
          icon="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
          label={t('stats.totalPlays')}
          value={stats.totalPlays}
        />
        <StatCard
          icon="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
          label={t('stats.avgRating')}
          value={stats.avgRating}
        />
      </div>

      {/* Dashboard grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Most Played */}
        <DashboardSection
          title={t('stats.mostPlayed')}
          icon="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
        >
          <TopTracksList tracks={stats.mostPlayed} noPlaysText={t('stats.noPlays')} />
        </DashboardSection>

        {/* Premiere Usage */}
        <DashboardSection
          title={t('stats.premiereUsage')}
          icon="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4"
        >
          <PremiereUsageWidget projects={stats.premiereProjects} noDataText={t('stats.noData')} />
        </DashboardSection>

        {/* BPM Distribution */}
        <DashboardSection
          title={t('stats.bpmDistribution')}
          icon="M13 10V3L4 14h7v7l9-11h-7z"
        >
          <BarChart data={stats.bpmBuckets} color="primary" />
        </DashboardSection>

        {/* Key Distribution */}
        <DashboardSection
          title={t('stats.keyDistribution')}
          icon="M9 19V6l12-3v13"
        >
          <BarChart data={stats.keyDistribution} color="violet" />
        </DashboardSection>

        {/* Rating Distribution */}
        <DashboardSection
          title={t('stats.ratingDistribution')}
          icon="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        >
          <RatingBars data={stats.ratingDistribution} />
        </DashboardSection>

        {/* Tag Usage */}
        <DashboardSection
          title={t('stats.tagUsage')}
          icon="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
        >
          <BarChart data={stats.tagUsage} />
        </DashboardSection>

        {/* Recently Added - full width */}
        <div className="lg:col-span-2">
          <DashboardSection
            title={t('stats.recentlyAdded')}
            icon="M12 6v6m0 0v6m0-6h6m-6 0H6"
          >
            <RecentTracksList tracks={stats.recentlyAdded} noDataText={t('stats.noData')} />
          </DashboardSection>
        </div>

        {/* Library Breakdown - full width */}
        <div className="lg:col-span-2">
          <DashboardSection
            title={t('stats.libraryBreakdown')}
            icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          >
            <LibraryBreakdown data={stats.libraryBreakdown} />
          </DashboardSection>
        </div>
      </div>
    </div>
  )
}
