import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { useTranslation } from '../i18n/useTranslation'
import { formatTime } from '../utils/formatTime'
import type { Track } from '../types'

interface PremiereUsagePopoverProps {
  track: Track
}

export default function PremiereUsagePopover({ track }: PremiereUsagePopoverProps) {
  const { t } = useTranslation()
  const usages = track.premiereUsage

  if (!usages || usages.length === 0) {
    return (
      <span className="text-[11px] text-surface-400 dark:text-surface-600">
        &mdash;
      </span>
    )
  }

  return (
    <Popover className="relative">
      <PopoverButton className="text-[11px] text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 transition-colors cursor-pointer font-medium">
        {usages.length === 1
          ? usages[0].projectName
          : `${usages.length} projects`}
      </PopoverButton>

      <PopoverPanel
        anchor="bottom start"
        className="z-50 mt-1.5 w-72 rounded-xl bg-white dark:bg-surface-800 shadow-xl ring-1 ring-black/10 dark:ring-white/10 py-2 backdrop-blur-xl"
      >
        <div className="px-3 pb-1.5 border-b border-surface-200/60 dark:border-surface-700/60 mb-1.5">
          <p className="text-[12px] font-semibold text-surface-700 dark:text-surface-300">
            {t('browse.usedIn')}
          </p>
        </div>

        <div className="max-h-60 overflow-y-auto px-1.5">
          {usages.map((usage, idx) => (
            <div
              key={idx}
              className="px-2 py-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700/40 transition-colors"
            >
              {/* Project name */}
              <div className="flex items-center gap-1.5 mb-0.5">
                <svg
                  className="w-3 h-3 text-surface-400 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                  />
                </svg>
                <span className="text-[12px] font-medium text-surface-700 dark:text-surface-300 truncate">
                  {usage.projectName}
                </span>
              </div>

              {/* Clip details */}
              <div className="ml-4.5 pl-[18px] text-[11px] text-surface-500 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-surface-400 w-8 shrink-0">Clip:</span>
                  <span className="truncate">{usage.clipName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-surface-400 w-8 shrink-0">In:</span>
                  <span className="font-mono tabular-nums">
                    {formatTime(usage.inTime)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-surface-400 w-8 shrink-0">Out:</span>
                  <span className="font-mono tabular-nums">
                    {formatTime(usage.outTime)}
                  </span>
                </div>
              </div>

              {/* Separator between entries */}
              {idx < usages.length - 1 && (
                <div className="mt-1.5 border-b border-surface-100 dark:border-surface-700/40" />
              )}
            </div>
          ))}
        </div>
      </PopoverPanel>
    </Popover>
  )
}
