import { useState, useRef, useCallback, useEffect } from 'react'
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react'
import { useTrackStore } from '../store/useTrackStore'
import { useSmartPlaylistStore } from '../store/useSmartPlaylistStore'
import { useTranslation } from '../i18n/useTranslation'
import SmartPlaylistModal from './SmartPlaylistModal'
import type { SmartTag } from '../types'

export default function TagSidebar() {
  const tagSearch = useTrackStore(s => s.tagSearch)
  const setTagSearch = useTrackStore(s => s.setTagSearch)
  const showHiddenTags = useTrackStore(s => s.showHiddenTags)
  const setShowHiddenTags = useTrackStore(s => s.setShowHiddenTags)
  const addNewTag = useTrackStore(s => s.addNewTag)
  const toggleTag = useTrackStore(s => s.toggleTag)
  const renameTag = useTrackStore(s => s.renameTag)
  const toggleTagHidden = useTrackStore(s => s.toggleTagHidden)
  const toggleTagFavorite = useTrackStore(s => s.toggleTagFavorite)
  const removeTag = useTrackStore(s => s.removeTag)
  const resetTags = useTrackStore(s => s.resetTags)
  const getFilteredTags = useTrackStore(s => s.getFilteredTags)
  const addTrackToTag = useTrackStore(s => s.addTrackToTag)
  const tracks = useTrackStore(s => s.tracks)
  const tags = useTrackStore(s => s.tags)
  const category = useTrackStore(s => s.category)
  const { t } = useTranslation()

  // Smart Playlists
  const { playlists, activePlaylistId, loadPlaylists, setActivePlaylist, deletePlaylist, getMatchingCount } = useSmartPlaylistStore()
  const [smartPlaylistModalOpen, setSmartPlaylistModalOpen] = useState(false)
  const [editingPlaylist, setEditingPlaylist] = useState<SmartTag | null>(null)

  useEffect(() => {
    loadPlaylists(category)
  }, [category, loadPlaylists])

  const handleEditPlaylist = (playlist: SmartTag) => {
    setEditingPlaylist(playlist)
    setSmartPlaylistModalOpen(true)
  }

  const handleCreatePlaylist = () => {
    setEditingPlaylist(null)
    setSmartPlaylistModalOpen(true)
  }

  const filteredTags = getFilteredTags()
  const [newTagName, setNewTagName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [dragOverTagId, setDragOverTagId] = useState<number | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  const handleAddTag = () => {
    if (newTagName.trim()) {
      addNewTag(newTagName.trim())
      setNewTagName('')
    }
  }

  const startEditing = (id: number, name: string) => {
    setEditingId(id)
    setEditingName(name)
    setTimeout(() => editInputRef.current?.focus(), 50)
  }

  const finishEditing = () => {
    if (editingId !== null && editingName.trim()) renameTag(editingId, editingName.trim())
    setEditingId(null)
  }

  // Drag-and-drop: accept tracks dropped onto tags
  const handleTagDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/x-track-id')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const handleTagDrop = useCallback((e: React.DragEvent, tagId: number) => {
    e.preventDefault()
    setDragOverTagId(null)
    const trackId = parseInt(e.dataTransfer.getData('application/x-track-id'))
    if (!isNaN(trackId)) {
      addTrackToTag(trackId, tagId)
    }
  }, [addTrackToTag])

  const handleTagDragEnter = useCallback((e: React.DragEvent, tagId: number) => {
    if (e.dataTransfer.types.includes('application/x-track-id')) {
      setDragOverTagId(tagId)
    }
  }, [])

  const handleTagDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the tag element itself (not entering a child)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      setDragOverTagId(null)
    }
  }, [])

  return (
    <div className="w-56 shrink-0 flex flex-col border-r border-surface-200/60 dark:border-surface-800/60 bg-white/30 dark:bg-surface-900/30 backdrop-blur-md">
      {/* Tag search */}
      <div className="p-2.5">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder={t('tags.search')}
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-[13px] rounded-lg border border-surface-200 dark:border-surface-700 bg-white/80 dark:bg-surface-800/80 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
          />
        </div>
      </div>

      {/* Reset + Toggle hidden */}
      <div className="px-2.5 pb-2 flex items-center gap-1.5">
        <button
          onClick={resetTags}
          className="text-[11px] px-2.5 py-1 rounded-md bg-surface-200/80 dark:bg-surface-800/80 hover:bg-surface-300/80 dark:hover:bg-surface-700/80 transition-colors font-medium"
        >
          {t('tags.reset')}
        </button>
        <label className="text-[11px] flex items-center gap-1.5 text-surface-500 ml-auto cursor-pointer">
          <input
            type="checkbox"
            checked={showHiddenTags}
            onChange={(e) => setShowHiddenTags(e.target.checked)}
          />
          {t('tags.hidden')}
        </label>
      </div>

      {/* Smart Playlists section */}
      {playlists.length > 0 && (
        <div className="px-1.5 pb-2">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[11px] font-semibold text-surface-500 uppercase tracking-wide">
              {t('smartPlaylist.title')}
            </span>
            <button
              onClick={handleCreatePlaylist}
              className="p-0.5 rounded hover:bg-surface-200/60 dark:hover:bg-surface-700/60 transition-colors"
              title={t('smartPlaylist.create')}
            >
              <svg className="w-3.5 h-3.5 text-surface-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
          <div className="space-y-0.5">
            {playlists.map((playlist) => (
              <div key={playlist.id} className="group flex items-center rounded-lg">
                <button
                  onClick={() => setActivePlaylist(activePlaylistId === playlist.id ? null : playlist.id!)}
                  className={`flex-1 text-left px-2.5 py-1.5 text-[13px] rounded-lg transition-all duration-150 truncate ${
                    activePlaylistId === playlist.id
                      ? 'bg-primary-500/15 text-primary-700 dark:text-primary-300 font-semibold ring-1 ring-primary-500/20'
                      : 'hover:bg-surface-200/60 dark:hover:bg-surface-800/60'
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-primary-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                      </svg>
                      {playlist.name}
                    </span>
                    <span className="text-[11px] text-surface-400 font-normal">
                      {getMatchingCount(playlist, tracks, tags)}
                    </span>
                  </span>
                </button>

                <Menu as="div" className="relative opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <MenuButton className="p-1 rounded-md hover:bg-surface-300/60 dark:hover:bg-surface-700/60 transition-colors">
                    <svg className="w-3.5 h-3.5 text-surface-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </MenuButton>
                  <MenuItems className="absolute right-0 z-30 mt-1 w-36 rounded-xl bg-white dark:bg-surface-800 shadow-xl ring-1 ring-black/10 dark:ring-white/10 py-1 text-[13px] backdrop-blur-xl">
                    <MenuItem>
                      <button onClick={() => handleEditPlaylist(playlist)} className="block w-full text-left px-3 py-1.5 data-[focus]:bg-surface-100 dark:data-[focus]:bg-surface-700 transition-colors">
                        {t('smartPlaylist.edit')}
                      </button>
                    </MenuItem>
                    <div className="my-1 border-t border-surface-200 dark:border-surface-700" />
                    <MenuItem>
                      <button onClick={() => deletePlaylist(playlist.id!)} className="block w-full text-left px-3 py-1.5 text-red-500 data-[focus]:bg-red-50 dark:data-[focus]:bg-red-900/20 transition-colors">
                        {t('smartPlaylist.delete')}
                      </button>
                    </MenuItem>
                  </MenuItems>
                </Menu>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tag list */}
      <div className="flex-1 overflow-y-auto px-1.5 space-y-0.5">
        {filteredTags.length === 0 && (
          <div className="text-center text-xs text-surface-400 dark:text-surface-600 py-8">
            {t('tags.empty')}
          </div>
        )}
        {filteredTags.map((tag) => (
          <div
            key={tag.id}
            className="group flex items-center rounded-lg"
            onDragOver={handleTagDragOver}
            onDrop={(e) => handleTagDrop(e, tag.id!)}
            onDragEnter={(e) => handleTagDragEnter(e, tag.id!)}
            onDragLeave={handleTagDragLeave}
          >
            {editingId === tag.id ? (
              <input
                ref={editInputRef}
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={finishEditing}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') finishEditing()
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className="flex-1 mx-1 px-2.5 py-1 text-[13px] rounded-lg border-2 border-primary-500 bg-white dark:bg-surface-800 focus:outline-none"
              />
            ) : (
              <>
                <button
                  onClick={() => toggleTag(tag.id!)}
                  className={`flex-1 text-left px-2.5 py-1.5 text-[13px] rounded-lg transition-all duration-150 truncate ${
                    dragOverTagId === tag.id
                      ? 'ring-2 ring-primary-500 bg-primary-500/20 scale-[1.02]'
                      : tag.isChecked
                      ? 'bg-primary-500/15 text-primary-700 dark:text-primary-300 font-semibold ring-1 ring-primary-500/20'
                      : 'hover:bg-surface-200/60 dark:hover:bg-surface-800/60'
                  } ${tag.isHidden ? 'opacity-40 italic' : ''}`}
                >
                  <span className="flex items-center gap-1.5">
                    {tag.isFavorite && <span className="text-amber-500 text-xs">&#9733;</span>}
                    {tag.name}
                  </span>
                </button>

                <Menu as="div" className="relative opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <MenuButton className="p-1 rounded-md hover:bg-surface-300/60 dark:hover:bg-surface-700/60 transition-colors">
                    <svg className="w-3.5 h-3.5 text-surface-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </MenuButton>
                  <MenuItems className="absolute right-0 z-30 mt-1 w-40 rounded-xl bg-white dark:bg-surface-800 shadow-xl ring-1 ring-black/10 dark:ring-white/10 py-1 text-[13px] backdrop-blur-xl">
                    <MenuItem>
                      <button onClick={() => startEditing(tag.id!, tag.name)} className="block w-full text-left px-3 py-1.5 data-[focus]:bg-surface-100 dark:data-[focus]:bg-surface-700 transition-colors">
                        {t('tags.rename')}
                      </button>
                    </MenuItem>
                    <MenuItem>
                      <button onClick={() => toggleTagFavorite(tag.id!)} className="block w-full text-left px-3 py-1.5 data-[focus]:bg-surface-100 dark:data-[focus]:bg-surface-700 transition-colors">
                        {tag.isFavorite ? t('tags.unfavorite') : t('tags.favorite')}
                      </button>
                    </MenuItem>
                    <MenuItem>
                      <button onClick={() => toggleTagHidden(tag.id!)} className="block w-full text-left px-3 py-1.5 data-[focus]:bg-surface-100 dark:data-[focus]:bg-surface-700 transition-colors">
                        {tag.isHidden ? t('tags.show') : t('tags.hide')}
                      </button>
                    </MenuItem>
                    <div className="my-1 border-t border-surface-200 dark:border-surface-700" />
                    <MenuItem>
                      <button onClick={() => removeTag(tag.id!)} className="block w-full text-left px-3 py-1.5 text-red-500 data-[focus]:bg-red-50 dark:data-[focus]:bg-red-900/20 transition-colors">
                        {t('tags.delete')}
                      </button>
                    </MenuItem>
                  </MenuItems>
                </Menu>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add tag */}
      <div className="p-2.5 border-t border-surface-200/60 dark:border-surface-800/60">
        <div className="flex gap-1.5">
          <input
            type="text"
            placeholder={t('tags.newPlaceholder')}
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
            className="flex-1 px-2.5 py-1.5 text-[13px] rounded-lg border border-surface-200 dark:border-surface-700 bg-white/80 dark:bg-surface-800/80 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
          />
          <button
            onClick={handleAddTag}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-all duration-150 active:scale-95 shadow-sm shadow-primary-500/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>

        {/* Create Smart Playlist button */}
        <button
          onClick={handleCreatePlaylist}
          className="w-full mt-2 px-2.5 py-1.5 text-[12px] rounded-lg border border-dashed border-surface-300 dark:border-surface-700 text-surface-500 hover:text-primary-600 hover:border-primary-400 dark:hover:border-primary-600 hover:bg-primary-50/50 dark:hover:bg-primary-900/20 transition-all flex items-center justify-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
          </svg>
          {t('smartPlaylist.create')}
        </button>
      </div>

      {/* Smart Playlist Modal */}
      <SmartPlaylistModal
        isOpen={smartPlaylistModalOpen}
        onClose={() => setSmartPlaylistModalOpen(false)}
        playlist={editingPlaylist}
        category={category}
        tracks={tracks}
        tags={tags}
      />
    </div>
  )
}
