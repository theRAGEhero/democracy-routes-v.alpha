const fs = require('fs').promises
const path = require('path')

const DATA_DIR = path.join(process.cwd(), 'data')
const TRANSCRIPTIONS_DIR = path.join(DATA_DIR, 'transcriptions')
const AUDIO_DIR = path.join(process.cwd(), 'public', 'audio')
const CHUNKS_DIR = path.join(DATA_DIR, 'chunks')

async function ensureDirectories() {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.mkdir(TRANSCRIPTIONS_DIR, { recursive: true })
  await fs.mkdir(AUDIO_DIR, { recursive: true })
}

async function saveTranscription(roundId, rawResponse, deliberationData) {
  await ensureDirectories()

  const rawPath = path.join(TRANSCRIPTIONS_DIR, `${roundId}_raw.json`)
  const deliberationPath = path.join(TRANSCRIPTIONS_DIR, `${roundId}_deliberation.json`)

  await fs.writeFile(rawPath, JSON.stringify(rawResponse, null, 2), 'utf-8')
  await fs.writeFile(deliberationPath, JSON.stringify(deliberationData, null, 2), 'utf-8')

  return { rawPath, deliberationPath }
}

async function loadDeliberationOntology(roundId) {
  const filePath = path.join(TRANSCRIPTIONS_DIR, `${roundId}_deliberation.json`)
  const content = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(content)
}

async function transcriptionExists(roundId) {
  const filePath = path.join(TRANSCRIPTIONS_DIR, `${roundId}_deliberation.json`)
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function saveAudioFile(roundId, buffer, extension = 'webm') {
  await ensureDirectories()
  const filename = `${roundId}.${extension}`
  const filePath = path.join(AUDIO_DIR, filename)
  await fs.writeFile(filePath, buffer)
  return `/audio/${filename}`
}

async function audioFileExists(roundId) {
  const extensions = ['webm', 'mp3', 'wav', 'ogg']

  for (const ext of extensions) {
    const filePath = path.join(AUDIO_DIR, `${roundId}.${ext}`)
    try {
      await fs.access(filePath)
      return `/audio/${roundId}.${ext}`
    } catch {
      continue
    }
  }

  return null
}

async function deleteRoundFiles(roundId) {
  const filesToDelete = [
    path.join(TRANSCRIPTIONS_DIR, `${roundId}_raw.json`),
    path.join(TRANSCRIPTIONS_DIR, `${roundId}_deliberation.json`),
  ]

  const extensions = ['webm', 'mp3', 'wav', 'ogg']
  for (const ext of extensions) {
    filesToDelete.push(path.join(AUDIO_DIR, `${roundId}.${ext}`))
  }

  for (const filePath of filesToDelete) {
    try {
      await fs.unlink(filePath)
    } catch {
      // Ignore missing files.
    }
  }
}

async function ensureChunkDirectory(roundId) {
  const chunkDir = path.join(CHUNKS_DIR, roundId)
  await fs.mkdir(chunkDir, { recursive: true })
  return chunkDir
}

async function saveChunk(roundId, sequence, buffer) {
  const chunkDir = await ensureChunkDirectory(roundId)
  const filename = sequence.toString().padStart(4, '0') + '.webm'
  const filePath = path.join(chunkDir, filename)
  await fs.writeFile(filePath, buffer)

  await updateChunkManifest(roundId, sequence)
}

async function assembleChunks(roundId, totalChunks, mimeType) {
  const chunkDir = path.join(CHUNKS_DIR, roundId)
  const extension = mimeType.split('/')[1] || 'webm'
  const outputPath = path.join(AUDIO_DIR, `${roundId}.${extension}`)

  await ensureDirectories()

  const chunks = []

  for (let i = 0; i < totalChunks; i++) {
    const chunkFile = path.join(chunkDir, `${i.toString().padStart(4, '0')}.webm`)

    try {
      const chunkBuffer = await fs.readFile(chunkFile)
      chunks.push(chunkBuffer)
    } catch (error) {
      throw new Error(`Missing chunk ${i}`)
    }
  }

  const finalBuffer = Buffer.concat(chunks)
  await fs.writeFile(outputPath, finalBuffer)

  await fs.rm(chunkDir, { recursive: true, force: true })

  return `/audio/${roundId}.${extension}`
}

async function updateChunkManifest(roundId, sequence, mimeType = 'audio/webm') {
  const chunkDir = path.join(CHUNKS_DIR, roundId)
  const manifestPath = path.join(chunkDir, 'manifest.json')

  let manifest
  try {
    const content = await fs.readFile(manifestPath, 'utf-8')
    manifest = JSON.parse(content)
  } catch {
    manifest = {
      roundId,
      mimeType,
      totalChunks: 0,
      receivedSequences: [],
      startTime: Date.now(),
      lastUpdate: Date.now()
    }
  }

  if (!manifest.receivedSequences.includes(sequence)) {
    manifest.receivedSequences.push(sequence)
    manifest.receivedSequences.sort((a, b) => a - b)
  }

  manifest.lastUpdate = Date.now()
  manifest.totalChunks = Math.max(manifest.totalChunks, sequence + 1)

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))
}

async function getChunkManifest(roundId) {
  try {
    const manifestPath = path.join(CHUNKS_DIR, roundId, 'manifest.json')
    const content = await fs.readFile(manifestPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

async function findMissingChunks(roundId, expectedTotal) {
  const manifest = await getChunkManifest(roundId)
  if (!manifest) return Array.from({ length: expectedTotal }, (_, i) => i)

  const missing = []
  for (let i = 0; i < expectedTotal; i++) {
    if (!manifest.receivedSequences.includes(i)) {
      missing.push(i)
    }
  }
  return missing
}

module.exports = {
  CHUNKS_DIR,
  ensureDirectories,
  saveTranscription,
  loadDeliberationOntology,
  transcriptionExists,
  saveAudioFile,
  audioFileExists,
  deleteRoundFiles,
  ensureChunkDirectory,
  saveChunk,
  assembleChunks,
  updateChunkManifest,
  getChunkManifest,
  findMissingChunks
}
