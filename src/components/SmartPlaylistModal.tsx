import { useState, useEffect } from 'react'
import { Dialog, DialogPanel, DialogTitle, RadioGroup } from '@headlessui/react'
import type { SmartTag, SmartTagRule, Track, Tag } from '../types'
import { useSmartPlaylistStore } from '../store/useSmartPlaylistStore'
import { useTranslation } from '../i18n/useTranslation'
import SmartPlaylistRuleRow from './SmartPlaylistRuleRow'

interface Props {
  isOpen: boolean
  onClose: () => void
  playlist?: SmartTag | null // null = create new, SmartTag = edit existing
  category: number
  tracks: Track[]
  tags: Tag[]
}

const DEFAULT_RULE: SmartTagRule = {
  field: 'bpm',
  operator: 'gt',
  value: '',
}

export default function SmartPlaylistModal({ isOpen, onClose, playlist, category, tracks, tags }: Props) {
  const { t } = useTranslation()
  const { createPlaylist, updatePlaylist, evaluatePlaylist } = useSmartPlaylistStore()

  const [name, setName] = useState('')
  const [match, setMatch] = useState<'all' | 'any'>('all')
  const [rules, setRules] = useState<SmartTagRule[]>([{ ...DEFAULT_RULE }])
  const [isSaving, setIsSaving] = useState(false)

  // Reset form when opening/playlist changes
  useEffect(() => {
    if (isOpen) {
      if (playlist) {
        setName(playlist.name)
        setMatch(playlist.match)
        setRules(playlist.rules.length > 0 ? [...playlist.rules] : [{ ...DEFAULT_RULE }])
      } else {
        setName('')
        setMatch('all')
        setRules([{ ...DEFAULT_RULE }])
      }
    }
  }, [isOpen, playlist])

  // Calculate matching tracks
  const previewPlaylist: SmartTag = {
    name,
    category,
    rules,
    match,
  }
  const matchingTracks = evaluatePlaylist(previewPlaylist, tracks, tags)

  const handleAddRule = () => {
    setRules([...rules, { ...DEFAULT_RULE }])
  }

  const handleUpdateRule = (index: number, updatedRule: SmartTagRule) => {
    const newRules = [...rules]
    newRules[index] = updatedRule
    setRules(newRules)
  }

  const handleRemoveRule = (index: number) => {
    if (rules.length > 1) {
      setRules(rules.filter((_, i) => i !== index))
    }
  }

  const handleSave = async () => {
    if (!name.trim() || rules.length === 0) return

    setIsSaving(true)
    try {
      if (playlist?.id) {
        await updatePlaylist(playlist.id, { name: name.trim(), rules, match })
      } else {
        await createPlaylist(name.trim(), rules, match, category)
      }
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-lg rounded-2xl bg-white dark:bg-surface-900 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-800">
            <DialogTitle className="text-lg font-semibold">
              {playlist ? t('smartPlaylist.edit') : t('smartPlaylist.create')}
            </DialogTitle>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Name input */}
            <div>
              <label className="block text-sm font-medium mb-1.5">{t('smartPlaylist.name')}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('smartPlaylist.namePlaceholder')}
                className="w-full px-3 py-2 text-[14px] rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
              />
            </div>

            {/* Match mode */}
            <div>
              <label className="block text-sm font-medium mb-1.5">{t('smartPlaylist.matchMode')}</label>
              <RadioGroup value={match} onChange={setMatch} className="flex gap-3">
                <RadioGroup.Option value="all">
                  {({ checked }) => (
                    <button
                      className={`px-3 py-1.5 text-[13px] rounded-lg border transition-colors ${
                        checked
                          ? 'border-primary-500 bg-primary-500/10 text-primary-700 dark:text-primary-300 font-medium'
                          : 'border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800'
                      }`}
                    >
                      {t('smartPlaylist.matchAll')}
                    </button>
                  )}
                </RadioGroup.Option>
                <RadioGroup.Option value="any">
                  {({ checked }) => (
                    <button
                      className={`px-3 py-1.5 text-[13px] rounded-lg border transition-colors ${
                        checked
                          ? 'border-primary-500 bg-primary-500/10 text-primary-700 dark:text-primary-300 font-medium'
                          : 'border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800'
                      }`}
                    >
                      {t('smartPlaylist.matchAny')}
                    </button>
                  )}
                </RadioGroup.Option>
              </RadioGroup>
            </div>

            {/* Rules */}
            <div>
              <label className="block text-sm font-medium mb-1.5">{t('smartPlaylist.rules')}</label>
              <div className="space-y-2">
                {rules.map((rule, index) => (
                  <SmartPlaylistRuleRow
                    key={index}
                    rule={rule}
                    tags={tags}
                    onChange={(updated) => handleUpdateRule(index, updated)}
                    onRemove={() => handleRemoveRule(index)}
                  />
                ))}
              </div>
              <button
                onClick={handleAddRule}
                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-[13px] rounded-lg text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                {t('smartPlaylist.addRule')}
              </button>
            </div>

            {/* Preview */}
            <div className="p-3 rounded-lg bg-surface-100/50 dark:bg-surface-800/50">
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 text-surface-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
                <span className="text-surface-600 dark:text-surface-400">
                  {t('smartPlaylist.tracksMatch').replace('{count}', String(matchingTracks.length))}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 p-4 border-t border-surface-200 dark:border-surface-800">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[14px] rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            >
              {t('confirm.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || rules.length === 0 || isSaving}
              className="px-4 py-2 text-[14px] rounded-lg bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? t('app.loading') : (playlist ? t('smartPlaylist.save') : t('smartPlaylist.create'))}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
