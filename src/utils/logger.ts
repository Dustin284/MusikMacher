/**
 * Application logger with in-memory ring buffer.
 * If running in Electron, logs are also forwarded to the main process via IPC.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  data?: unknown
}

const MAX_ENTRIES = 500
const buffer: LogEntry[] = []

/**
 * Log a message at the given level.
 * Stores in the ring buffer and optionally forwards to Electron main process.
 */
export function log(level: LogLevel, message: string, data?: unknown): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data,
  }

  // Ring buffer: remove oldest when full
  if (buffer.length >= MAX_ENTRIES) {
    buffer.shift()
  }
  buffer.push(entry)

  // Console output for development
  const consoleFn = level === 'error' ? console.error
    : level === 'warn' ? console.warn
    : level === 'debug' ? console.debug
    : console.log

  if (data !== undefined) {
    consoleFn(`[${entry.timestamp}] [${level.toUpperCase()}] ${message}`, data)
  } else {
    consoleFn(`[${entry.timestamp}] [${level.toUpperCase()}] ${message}`)
  }

  // Forward to Electron main process if available
  if (typeof window !== 'undefined' && window.electronAPI?.writeLog) {
    try {
      window.electronAPI.writeLog(
        level,
        message,
        data !== undefined ? JSON.stringify(data) : undefined,
      )
    } catch {
      // Silently ignore IPC errors
    }
  }
}

/**
 * Get all log entries in the buffer.
 */
export function getLogs(): LogEntry[] {
  return [...buffer]
}

/**
 * Clear all log entries from the buffer.
 */
export function clearLogs(): void {
  buffer.length = 0
}

// Convenience functions
export const debug = (message: string, data?: unknown) => log('debug', message, data)
export const info = (message: string, data?: unknown) => log('info', message, data)
export const warn = (message: string, data?: unknown) => log('warn', message, data)
export const error = (message: string, data?: unknown) => log('error', message, data)
