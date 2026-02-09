import { Dialog, DialogPanel, DialogTitle, DialogBackdrop } from '@headlessui/react'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onClose={onCancel} className="relative z-[9999]">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/20 backdrop-blur-lg transition-opacity duration-200 data-[closed]:opacity-0"
      />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="w-full max-w-sm rounded-2xl bg-white/98 dark:bg-surface-850/98 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.12)] p-7 transition-all duration-200 data-[closed]:opacity-0 data-[closed]:scale-95"
        >
          {/* Warning icon */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <svg
                className="w-5 h-5 text-red-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <DialogTitle className="text-[15px] font-semibold text-surface-900 dark:text-surface-100">
              {title}
            </DialogTitle>
          </div>

          {/* Message */}
          <p className="text-[13px] text-surface-600 dark:text-surface-400 mb-6 leading-relaxed">
            {message}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 text-[13px] font-medium rounded-xl border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700/60 transition-colors"
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className="px-5 py-2.5 text-[13px] font-medium rounded-xl bg-red-500 hover:bg-red-600 text-white shadow-sm shadow-red-500/25 transition-colors active:scale-[0.98]"
            >
              {confirmLabel}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
