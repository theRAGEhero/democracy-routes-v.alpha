/**
 * Simple Logger for Autonomous Debugging
 *
 * Features:
 * - Writes structured JSON to daily log files
 * - Shows colored output in console during development
 * - Request correlation with IDs
 * - Error serialization with stack traces
 * - Context chaining for better organization
 */

import fs from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

// ============================================================================
// Types
// ============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  timestamp: string
  name: string
  message: string
  context?: Record<string, any>
  error?: {
    message: string
    stack?: string
    cause?: any
  }
}

// ============================================================================
// Configuration
// ============================================================================

const config = {
  level: (process.env.LOG_LEVEL || 'debug') as LogLevel,
  dir: process.env.LOG_DIR || 'logs',
  toFile: process.env.LOG_TO_FILE !== 'false', // Default to true
  isDev: process.env.NODE_ENV !== 'production'
}

const levelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

// ============================================================================
// Logger Class
// ============================================================================

class Logger {
  constructor(
    private name: string,
    private context: Record<string, any> = {}
  ) {}

  /**
   * Log debug message (lowest priority)
   */
  debug(message: string, meta?: Record<string, any>) {
    this.log('debug', message, meta)
  }

  /**
   * Log info message
   */
  info(message: string, meta?: Record<string, any>) {
    this.log('info', message, meta)
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: Record<string, any>) {
    this.log('warn', message, meta)
  }

  /**
   * Log error message (highest priority)
   */
  error(message: string, meta?: Record<string, any>) {
    this.log('error', message, meta)
  }

  /**
   * Create a new logger with additional context
   * This allows chaining: logger.withContext({ requestId }).info(...)
   */
  withContext(additionalContext: Record<string, any>): Logger {
    return new Logger(this.name, { ...this.context, ...additionalContext })
  }

  /**
   * Core logging method - writes to console and file
   */
  private log(level: LogLevel, message: string, meta?: Record<string, any>) {
    // Check if this log level should be logged
    if (levelPriority[level] < levelPriority[config.level]) {
      return
    }

    // Build log entry
    const entry: LogEntry = {
      level,
      timestamp: new Date().toISOString(),
      name: this.name,
      message,
      context: { ...this.context, ...meta }
    }

    // Handle error objects specially
    if (meta?.error) {
      entry.error = this.serializeError(meta.error)
      // Remove error from context since it's in error field
      const { error, ...contextWithoutError } = entry.context!
      entry.context = contextWithoutError
    }

    // Write to console (async, don't await)
    this.writeConsole(entry)

    // Write to file (async, don't await)
    if (config.toFile) {
      this.writeFile(entry).catch(err => {
        console.error('Failed to write log to file:', err)
      })
    }
  }

  /**
   * Serialize error object with stack trace
   */
  private serializeError(error: any): { message: string; stack?: string; cause?: any } {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        cause: error.cause
      }
    }
    return { message: String(error) }
  }

  /**
   * Write log entry to console with colors
   */
  private writeConsole(entry: LogEntry) {
    if (!config.isDev) {
      // Production: simple console output
      console.log(JSON.stringify(entry))
      return
    }

    // Development: pretty colored output
    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m'  // Red
    }
    const reset = '\x1b[0m'
    const dim = '\x1b[2m'
    const bold = '\x1b[1m'

    const time = new Date(entry.timestamp).toLocaleTimeString()
    const color = colors[entry.level]
    const levelStr = entry.level.toUpperCase().padEnd(5)

    // Main log line
    console.log(
      `${dim}[${time}]${reset} ${color}${levelStr}${reset} ${dim}[${entry.name}]${reset} ${bold}${entry.message}${reset}`
    )

    // Context (if any)
    if (entry.context && Object.keys(entry.context).length > 0) {
      for (const [key, value] of Object.entries(entry.context)) {
        console.log(`  ${dim}${key}:${reset}`, value)
      }
    }

    // Error (if any)
    if (entry.error) {
      console.log(`  ${dim}error:${reset}`, entry.error.message)
      if (entry.error.stack) {
        const stackLines = entry.error.stack.split('\n').slice(1, 5) // First 4 stack frames
        stackLines.forEach(line => {
          console.log(`  ${dim}${line.trim()}${reset}`)
        })
      }
    }
  }

  /**
   * Write log entry to file as JSON line
   */
  private async writeFile(entry: LogEntry) {
    try {
      // Create logs directory if it doesn't exist
      await fs.mkdir(config.dir, { recursive: true })

      // Get daily log file path
      const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
      const logFile = path.join(config.dir, `app-${date}.log`)

      // Append log entry as JSON line
      const line = JSON.stringify(entry) + '\n'
      await fs.appendFile(logFile, line, 'utf-8')
    } catch (error) {
      // Don't throw - logging should never break the application
      console.error('Failed to write to log file:', error)
    }
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Create or get a logger instance
 * @param name - Logger name (e.g., 'api.transcribe', 'storage.files')
 */
export function getLogger(name: string): Logger {
  return new Logger(name)
}

/**
 * Generate a unique request ID for correlation
 */
export function createRequestId(): string {
  return randomUUID()
}

/**
 * Export types for external use
 */
export type { LogLevel, LogEntry }
