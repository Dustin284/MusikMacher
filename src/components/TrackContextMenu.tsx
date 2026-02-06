import { useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../i18n/useTranslation'
import type { Track, Tag, Project } from '../types'

interface TrackContextMenuProps {
  x: number
  y: number
  track: Track
  onClose: () => void
  onPlay: (track: Track) => void
  onEditComment: (track: Track) => void
  onToggleHidden?: (track: Track) => void
  onExport?: (track: Track) => void
  onAnalyze?: (track: Track) => void
  onDelete?: (track: Track) => void
  onAddToQueue?: (track: Track) => void
  onRate?: (track: Track, rating: number) => void
  onToggleFavorite?: (track: Track) => void
  onIdentifyTrack?: (track: Track) => void
  onSeparateStems?: (track: Track) => void
  tags?: Tag[]
  onTagToggle?: (trackId: number, tagId: number, add: boolean) => void
  projects?: Project[]
  onProjectAssign?: (trackId: number, projectId: number | undefined) => void
  inProject?: boolean
}

export default function TrackContextMenu({
  x,
  y,
  track,
  onClose,
  onPlay,
  onEditComment,
  onToggleHidden,
  onExport,
  onAnalyze,
  onDelete,
  onAddToQueue,
  onRate,
  onToggleFavorite,
  onIdentifyTrack,
  onSeparateStems,
  tags,
  onTagToggle,
  projects,
  onProjectAssign,
  inProject,
}: TrackContextMenuProps) {
  const { t } = useTranslation()
  const menuRef = useRef<HTMLDivElement>(null)

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    },
    [onClose],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose],
  )

  const handleScroll = useCallback(() => {
    onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [handleClickOutside, handleKeyDown, handleScroll])

  // Adjust position so menu stays within viewport
  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    let adjustedX = x
    let adjustedY = y

    if (x + rect.width > vw) {
      adjustedX = vw - rect.width - 8
    }
    if (y + rect.height > vh) {
      adjustedY = vh - rect.height - 8
    }
    if (adjustedX < 0) adjustedX = 8
    if (adjustedY < 0) adjustedY = 8

    menuRef.current.style.left = `${adjustedX}px`
    menuRef.current.style.top = `${adjustedY}px`
  }, [x, y])

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI

  const items: {
    label: string
    icon: string
    onClick: () => void
    danger?: boolean
    separator?: boolean
    hidden?: boolean
  }[] = [
    {
      label: t('context.play'),
      icon: 'M5 3l14 9-14 9V3z',
      onClick: () => {
        onPlay(track)
        onClose()
      },
    },
    {
      label: t('context.addToQueue'),
      icon: 'M4 6h16M4 10h16M4 14h16M4 18h16',
      onClick: () => {
        onAddToQueue?.(track)
        onClose()
      },
      hidden: !onAddToQueue,
    },
    {
      label: track.isFavorite ? t('context.unfavorite') : t('context.favorite'),
      icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
      onClick: () => {
        onToggleFavorite?.(track)
        onClose()
      },
      hidden: !onToggleFavorite,
    },
    {
      label: t('context.editComment'),
      icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
      onClick: () => {
        onEditComment(track)
        onClose()
      },
    },
    {
      label: track.isHidden ? t('context.unhide') : t('context.hide'),
      icon: track.isHidden
        ? 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'
        : 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21',
      onClick: () => {
        onToggleHidden?.(track)
        onClose()
      },
      hidden: !onToggleHidden,
    },
    {
      label: t('context.export'),
      icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
      onClick: () => {
        onExport?.(track)
        onClose()
      },
      hidden: !isElectron || !onExport,
    },
    {
      label: t('context.analyzeTrack'),
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      onClick: () => {
        onAnalyze?.(track)
        onClose()
      },
      separator: true,
      hidden: !onAnalyze,
    },
    {
      label: t('context.identifyTrack'),
      icon: 'M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z',
      onClick: () => {
        onIdentifyTrack?.(track)
        onClose()
      },
      hidden: !onIdentifyTrack,
    },
    {
      label: t('context.separateStems'),
      icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3',
      onClick: () => {
        onSeparateStems?.(track)
        onClose()
      },
      hidden: !onSeparateStems || !isElectron,
    },
    {
      label: inProject ? t('project.removeFromProject') : t('context.delete'),
      icon: inProject
        ? 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1'
        : 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
      onClick: () => {
        onDelete?.(track)
        onClose()
      },
      danger: !inProject,
      separator: true,
      hidden: !onDelete,
    },
  ]

  const visibleItems = items.filter((item) => !item.hidden)

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[180px] py-1.5 rounded-xl bg-white dark:bg-surface-800 shadow-xl shadow-black/20 ring-1 ring-black/10 dark:ring-white/10 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
      style={{ left: x, top: y }}
    >
      {visibleItems.map((item, idx) => (
        <div key={idx}>
          {item.separator && idx > 0 && (
            <div className="my-1 border-t border-surface-200/60 dark:border-surface-700/60" />
          )}
          <button
            onClick={item.onClick}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] transition-colors ${
              item.danger
                ? 'text-red-500 hover:bg-red-500/10'
                : 'text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700/60'
            }`}
          >
            <svg
              className={`w-4 h-4 shrink-0 ${item.danger ? 'text-red-500' : 'text-surface-400'}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
            </svg>
            {item.label}
          </button>
        </div>
      ))}
      {/* Rating */}
      {onRate && (
        <>
          <div className="my-1 border-t border-surface-200/60 dark:border-surface-700/60" />
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-surface-400">
            {t('context.rate')}
          </div>
          <div className="px-3 py-1 flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => { onRate(track, track.rating === star ? 0 : star); onClose() }}
                className="p-0.5 transition-colors"
              >
                <svg
                  className={`w-5 h-5 ${(track.rating || 0) >= star ? 'text-amber-400' : 'text-surface-300 dark:text-surface-600'}`}
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            ))}
          </div>
        </>
      )}
      {/* Tag assignment */}
      {tags && tags.length > 0 && onTagToggle && (
        <>
          <div className="my-1 border-t border-surface-200/60 dark:border-surface-700/60" />
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-surface-400">
            Tags
          </div>
          <div className="max-h-40 overflow-y-auto">
            {tags.filter(tag => !tag.isHidden).sort((a, b) => {
              if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
              return a.name.localeCompare(b.name)
            }).map(tag => {
              const isAssigned = track.tagIds.includes(tag.id!)
              return (
                <label
                  key={tag.id}
                  className="w-full flex items-center gap-2.5 px-3 py-1 text-[13px] text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700/60 cursor-pointer transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={isAssigned}
                    onChange={() => onTagToggle(track.id!, tag.id!, !isAssigned)}
                    className="shrink-0"
                  />
                  <span className="truncate">
                    {tag.isFavorite && <span className="text-amber-500 mr-1">&#9733;</span>}
                    {tag.name}
                  </span>
                </label>
              )
            })}
          </div>
        </>
      )}
      {/* Project assignment */}
      {projects && projects.length > 0 && onProjectAssign && (
        <>
          <div className="my-1 border-t border-surface-200/60 dark:border-surface-700/60" />
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-surface-400">
            {t('project.assign')}
          </div>
          <div className="max-h-40 overflow-y-auto">
            <label
              className="w-full flex items-center gap-2.5 px-3 py-1 text-[13px] text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700/60 cursor-pointer transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="radio"
                name="project-assign"
                checked={!track.projectId}
                onChange={() => onProjectAssign(track.id!, undefined)}
                className="shrink-0"
              />
              <span className="truncate text-surface-400 italic">{t('project.none')}</span>
            </label>
            {projects.map(proj => (
              <label
                key={proj.id}
                className="w-full flex items-center gap-2.5 px-3 py-1 text-[13px] text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700/60 cursor-pointer transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="radio"
                  name="project-assign"
                  checked={track.projectId === proj.id}
                  onChange={() => onProjectAssign(track.id!, proj.id)}
                  className="shrink-0"
                />
                <span className="truncate">{proj.name}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}
