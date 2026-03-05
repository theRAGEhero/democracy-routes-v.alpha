const fs = require('fs').promises
const path = require('path')
const { deleteRoundFiles } = require('./files.js')

const DATA_DIR = path.join(process.cwd(), 'data')
const ROUNDS_FILE = path.join(DATA_DIR, 'rounds.json')

async function ensureRoundsFile() {
  await fs.mkdir(DATA_DIR, { recursive: true })

  try {
    await fs.access(ROUNDS_FILE)
  } catch {
    await fs.writeFile(ROUNDS_FILE, JSON.stringify([], null, 2), 'utf-8')
  }
}

async function getRounds() {
  await ensureRoundsFile()
  const content = await fs.readFile(ROUNDS_FILE, 'utf-8')
  return JSON.parse(content)
}

async function getRound(roundId) {
  const rounds = await getRounds()
  return rounds.find(r => r.id === roundId) ?? null
}

async function createRound(round) {
  await ensureRoundsFile()
  const rounds = await getRounds()
  rounds.unshift(round)
  await fs.writeFile(ROUNDS_FILE, JSON.stringify(rounds, null, 2), 'utf-8')
  return round
}

async function updateRound(roundId, updates) {
  const rounds = await getRounds()
  const index = rounds.findIndex(r => r.id === roundId)

  if (index === -1) {
    return null
  }

  rounds[index] = { ...rounds[index], ...updates }
  await fs.writeFile(ROUNDS_FILE, JSON.stringify(rounds, null, 2), 'utf-8')
  return rounds[index]
}

async function deleteRound(roundId) {
  const rounds = await getRounds()
  const index = rounds.findIndex(r => r.id === roundId)

  if (index === -1) {
    return false
  }

  rounds.splice(index, 1)
  await fs.writeFile(ROUNDS_FILE, JSON.stringify(rounds, null, 2), 'utf-8')

  await deleteRoundFiles(roundId)
  return true
}

module.exports = {
  getRounds,
  getRound,
  createRound,
  updateRound,
  deleteRound
}
