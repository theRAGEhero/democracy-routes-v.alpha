const path = require('path')
const fs = require('fs').promises

// Import storage functions dynamically to handle ES modules
let saveChunk, assembleChunks, getChunkManifest, findMissingChunks, updateChunkManifest
let getRound, updateRound

async function loadModules() {
  if (!saveChunk) {
    const fileStorage = await import('../storage/files.js')
    saveChunk = fileStorage.saveChunk
    assembleChunks = fileStorage.assembleChunks
    getChunkManifest = fileStorage.getChunkManifest
    findMissingChunks = fileStorage.findMissingChunks
    updateChunkManifest = fileStorage.updateChunkManifest

    const roundStorage = await import('../storage/rounds.js')
    getRound = roundStorage.getRound
    updateRound = roundStorage.updateRound
  }
}

// Session storage
const sessions = new Map()

function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function handleConnection(ws) {
  const sessionId = generateSessionId()
  const state = {
    sessionId,
    roundId: null,
    lastReceivedSequence: -1,
    expectedSequence: 0,
    totalChunksReceived: 0,
    startTime: Date.now(),
    lastMessageAt: Date.now(),
    mimeType: 'audio/webm',
    awaitingChunkData: false,
    pendingChunkSequence: null,
    unexpectedBinaryBuffer: null,  // Handle race condition binary data
    status: 'connected'
  }

  sessions.set(ws, state)
  console.log('[WebSocket] Connection opened', { sessionId })

  // Heartbeat
  const heartbeat = setInterval(() => {
    if (ws.readyState === 1) { // OPEN
      ws.ping()
    }
  }, 30000)

  ws.on('message', async (data) => {
    try {
      await handleMessage(ws, state, data)
    } catch (error) {
      console.error('[WebSocket] Error handling message', {
        sessionId,
        error: error.message,
        stack: error.stack,
        dataType: data instanceof Buffer ? 'Buffer' : typeof data,
        dataLength: data.length
      })
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message || 'Internal server error',
        code: 'INTERNAL_ERROR'
      }))
    }
  })

  ws.on('close', () => {
    clearInterval(heartbeat)
    sessions.delete(ws)
    console.log('[WebSocket] Connection closed', { sessionId, roundId: state.roundId })
  })

  ws.on('error', (error) => {
    console.error('[WebSocket] Socket error', { sessionId, error: error.message })
  })

  ws.on('pong', () => {
    // Heartbeat pong received
  })
}

/**
 * Safely check if data looks like JSON before attempting to parse
 */
function isLikelyJSON(data) {
  if (!(data instanceof Buffer) && typeof data !== 'string') return false

  const str = data instanceof Buffer ? data.toString('utf8') : data

  // Check for empty or very small payloads
  if (str.trim().length < 2) return false

  try {
    const trimmed = str.trim()

    // JSON objects start with { or [
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return false
    }

    // Try to parse - if it throws, it's not JSON
    JSON.parse(str)
    return true
  } catch (e) {
    return false
  }
}

async function handleMessage(ws, state, data) {
  await loadModules()
  state.lastMessageAt = Date.now()

  // Handle binary chunk data when expected
  if (data instanceof Buffer && state.awaitingChunkData) {
    if (state.pendingChunkSequence === null) {
      console.warn('[WebSocket] Unexpected binary data received', { sessionId: state.sessionId })
      return
    }

    // Save chunk to disk
    try {
      await saveChunk(state.roundId, state.pendingChunkSequence, data)

      console.log('[WebSocket] Chunk received and saved', {
        sessionId: state.sessionId,
        sequence: state.pendingChunkSequence,
        size: data.length
      })

      state.totalChunksReceived++
      state.lastReceivedSequence = state.pendingChunkSequence

      ws.send(JSON.stringify({
        type: 'ack',
        sequence: state.pendingChunkSequence
      }))

      state.awaitingChunkData = false
      state.pendingChunkSequence = null
    } catch (error) {
      console.error('[WebSocket] Failed to save chunk', {
        sessionId: state.sessionId,
        error: error.message
      })
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to save chunk',
        code: 'CHUNK_SAVE_ERROR'
      }))
    }
    return
  }

  // NEW: Handle unexpected binary data (race condition)
  if (data instanceof Buffer && !state.awaitingChunkData) {
    console.log('[WebSocket] Binary data arrived before metadata (race condition)', {
      sessionId: state.sessionId,
      size: data.length,
      hasBuffered: state.unexpectedBinaryBuffer !== null
    })

    // Buffer ONE unexpected chunk (don't accumulate)
    if (!state.unexpectedBinaryBuffer) {
      state.unexpectedBinaryBuffer = data
    } else {
      console.warn('[WebSocket] Multiple unexpected binary chunks - dropping oldest', {
        sessionId: state.sessionId
      })
      state.unexpectedBinaryBuffer = data
    }
    return
  }

  // NEW: Safe JSON parsing with validation
  if (!isLikelyJSON(data)) {
    console.warn('[WebSocket] Received non-JSON data', {
      sessionId: state.sessionId,
      dataType: typeof data,
      isBuffer: data instanceof Buffer,
      size: data instanceof Buffer ? data.length : data.length,
      preview: data instanceof Buffer
        ? data.toString('utf8', 0, Math.min(100, data.length))
        : data.slice(0, 100)
    })
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Invalid message format',
      code: 'INVALID_FORMAT'
    }))
    return
  }

  // Parse JSON message
  const message = JSON.parse(data instanceof Buffer ? data.toString('utf8') : data)

  switch (message.type) {
    case 'init':
      await handleInit(ws, state, message)
      break

    case 'chunk':
      await handleChunkMetadata(ws, state, message)
      break

    case 'complete':
      await handleComplete(ws, state, message)
      break

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }))
      break

    default:
      console.warn('[WebSocket] Unknown message type', { type: message.type })
  }
}

async function handleInit(ws, state, message) {
  const { roundId, mimeType } = message

  // Validate round exists
  const round = await getRound(roundId)
  if (!round) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Round not found',
      code: 'ROUND_NOT_FOUND'
    }))
    ws.close()
    return
  }

  state.roundId = roundId
  state.mimeType = mimeType || 'audio/webm'
  state.status = 'recording'

  // Check if resuming (existing chunks)
  const manifest = await getChunkManifest(roundId)
  if (manifest) {
    state.lastReceivedSequence = Math.max(...manifest.receivedSequences, -1)
    state.expectedSequence = state.lastReceivedSequence + 1
    console.log('[WebSocket] Resuming session', {
      sessionId: state.sessionId,
      roundId,
      lastReceivedSequence: state.lastReceivedSequence
    })
  }

  // Update round status
  await updateRound(roundId, { status: 'streaming' })

  ws.send(JSON.stringify({
    type: 'ready',
    sessionId: state.sessionId,
    lastReceivedSequence: state.lastReceivedSequence
  }))

  console.log('[WebSocket] Session initialized', {
    sessionId: state.sessionId,
    roundId,
    resuming: manifest !== null
  })
}

async function handleChunkMetadata(ws, state, message) {
  const { sequence } = message

  if (!state.roundId) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Session not initialized',
      code: 'NOT_INITIALIZED'
    }))
    return
  }

  // Check for gaps
  if (sequence !== state.expectedSequence) {
    console.warn('[WebSocket] Sequence gap detected', {
      expected: state.expectedSequence,
      received: sequence,
      sessionId: state.sessionId
    })

    const missing = await findMissingChunks(state.roundId, sequence)

    if (missing.length > 0) {
      ws.send(JSON.stringify({
        type: 'missing',
        sequences: missing
      }))
    }
  }

  state.awaitingChunkData = true
  state.pendingChunkSequence = sequence
  state.expectedSequence = sequence + 1

  // NEW: Process buffered binary data if available (race condition handling)
  if (state.unexpectedBinaryBuffer) {
    console.log('[WebSocket] Processing buffered binary data from race condition', {
      sessionId: state.sessionId,
      sequence: sequence,
      size: state.unexpectedBinaryBuffer.length
    })

    // Recursively call handleMessage with the buffered binary data
    const bufferedData = state.unexpectedBinaryBuffer
    state.unexpectedBinaryBuffer = null

    // Process the buffered binary data immediately
    await handleMessage(ws, state, bufferedData)
  }
}

async function handleComplete(ws, state, message) {
  const { totalChunks, finalDuration } = message

  if (!state.roundId) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Session not initialized',
      code: 'NOT_INITIALIZED'
    }))
    return
  }

  console.log('[WebSocket] Completing chunk assembly', {
    roundId: state.roundId,
    totalChunks,
    received: state.totalChunksReceived
  })

  try {
    state.status = 'processing'
    // Check for missing chunks
    const missing = await findMissingChunks(state.roundId, totalChunks)
    if (missing.length > 0) {
      console.warn('[WebSocket] Missing chunks detected', { roundId: state.roundId, missing })
      ws.send(JSON.stringify({
        type: 'missing',
        sequences: missing
      }))
      return
    }

    // Assemble chunks into final file
    const audioPath = await assembleChunks(state.roundId, totalChunks, state.mimeType)

    // Update round
    await updateRound(state.roundId, {
      status: 'processing',
      audio_file: audioPath,
      duration_seconds: finalDuration
    })

    ws.send(JSON.stringify({
      type: 'complete',
      chunkCount: totalChunks,
      audioPath
    }))

    console.log('[WebSocket] Chunks assembled successfully', { roundId: state.roundId })

    // Trigger transcription asynchronously (don't await to avoid blocking WebSocket)
    triggerTranscription(state.roundId).catch(error => {
      console.error('[WebSocket] Failed to trigger transcription', {
        roundId: state.roundId,
        error: error.message
      })
    })
  } catch (error) {
    console.error('[WebSocket] Failed to assemble chunks', { roundId: state.roundId, error: error.message })

    await updateRound(state.roundId, { status: 'error' })

    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to assemble audio',
      code: 'ASSEMBLY_FAILED'
    }))
  }
}

/**
 * Trigger transcription for assembled audio file
 */
async function triggerTranscription(roundId) {
  try {
    const basePath = String(process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '')
    const response = await fetch(`http://localhost:3000${basePath}/api/rounds/${roundId}/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Transcription request failed')
    }

    const result = await response.json()
    console.log('[WebSocket] Transcription triggered successfully', {
      roundId,
      success: result.success
    })
  } catch (error) {
    console.error('[WebSocket] Failed to trigger transcription', {
      roundId,
      error: error.message
    })
    throw error
  }
}

function getSessionStats() {
  const sessionList = Array.from(sessions.values()).map((state) => ({
    sessionId: state.sessionId,
    roundId: state.roundId,
    status: state.status,
    lastReceivedSequence: state.lastReceivedSequence,
    totalChunksReceived: state.totalChunksReceived,
    startTime: state.startTime,
    lastMessageAt: state.lastMessageAt
  }))

  return {
    connected: sessions.size,
    recording: sessionList.filter(session => session.status === 'recording').length,
    sessions: sessionList
  }
}

module.exports = { handleConnection, getSessionStats }
