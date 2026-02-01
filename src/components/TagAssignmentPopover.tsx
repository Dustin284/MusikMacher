import { useState } from 'react'
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { useTrackStore } from '../store/useTrackStore'
import { useTranslation } from '../i18n/useTranslation'
import type { Track, Tag } from '../types'

interface TagAssignmentPopoverProps {
  track: Track
  tags: Tag[]
  tagMap: Map<number, Tag>
}

export default function TagAssignmentPopover({ track, tags, tagMap }: TagAssignmentPopoverProps) {
  const addTrackToTag = useTrackStore(s => s.addTrackToTag)
  const removeTrackFromTag = useTrackStore(s => s.removeTrackFromTag)
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  const filteredTags = tags
    .filter(tag => !tag.isHidden)
    .filter(tag => !search || tag.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1
      return a.name.localeCompare(b.name)
    })

  const getTagNames = () =>
    track.tagIds.map(id => tagMap.get(id)?.name).filter(Boolean).join(', ')

  const handleToggle = (tagId: number) => {
    if (track.tagIds.includes(tagId)) {
      removeTrackFromTag(track.id!, tagId)
    } else {
      addTrackToTag(track.id!, tagId)
    }
  }

  return (
    <Popover className="relative">
      <PopoverButton as="div" className="cursor-pointer min-h-[20px]">
        <span className="text-[11px] text-surface-500 truncate block max-w-[120px] hover:text-primary-500 transition-colors">
          {getTagNames() || <span className="text-surface-300 dark:text-surface-700">&mdash;</span>}
        </span>
      </PopoverButton>
      <PopoverPanel
        anchor="bottom start"
        className="z-50 mt-1 w-56 rounded-xl bg-white dark:bg-surface-800 shadow-xl ring-1 ring-black/10 dark:ring-white/10 py-1.5 backdrop-blur-xl"
      >
        {/* Search input */}
        <div className="px-2 pb-1.5">
          <input
            type="text"
            placeholder={t('tags.assignSearch')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="w-full px-2.5 py-1.5 text-[13px] rounded-lg border border-surface-200 dark:border-surface-700 bg-white/80 dark:bg-surface-800/80 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
          />
        </div>
        {/* Tag checkboxes */}
        <div className="max-h-48 overflow-y-auto px-1">
          {filteredTags.length === 0 ? (
            <div className="text-center text-xs text-surface-400 dark:text-surface-600 py-3">
              {t('tags.noTagsFound')}
            </div>
          ) : (
            filteredTags.map(tag => (
              <label
                key={tag.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700/60 cursor-pointer transition-colors text-[13px]"
              >
                <input
                  type="checkbox"
                  checked={track.tagIds.includes(tag.id!)}
                  onChange={() => handleToggle(tag.id!)}
                  className="shrink-0"
                />
                <span className="truncate">
                  {tag.isFavorite && <span className="text-amber-500 mr-1">&#9733;</span>}
                  {tag.name}
                </span>
              </label>
            ))
          )}
        </div>
      </PopoverPanel>
    </Popover>
  )
}
