const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const WebSocket = require('ws')
const { handleConnection, getSessionStats } = require('./lib/websocket/handler.js')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOST || '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)
const basePath = String(process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '')
const EVENT_HUB_BASE_URL = String(process.env.EVENT_HUB_BASE_URL || '').trim()
const EVENT_HUB_API_KEY = String(process.env.EVENT_HUB_API_KEY || '').trim()

async function postEventHub(event) {
  if (!EVENT_HUB_BASE_URL || !EVENT_HUB_API_KEY) return
  try {
    await fetch(`${EVENT_HUB_BASE_URL.replace(/\/$/, '')}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': EVENT_HUB_API_KEY
      },
      body: JSON.stringify(event)
    })
  } catch {
    // best-effort only
  }
}

function stripBasePath(pathname) {
  if (!basePath) return pathname || '/'
  if (!pathname) return '/'
  if (pathname === basePath) return '/'
  if (pathname.startsWith(`${basePath}/`)) {
    return pathname.slice(basePath.length)
  }
  return pathname
}

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      const strippedPath = stripBasePath(parsedUrl.pathname || '/')
      if (strippedPath === '/api/stream-audio/stats' && req.method === 'GET') {
        const stats = getSessionStats()
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(stats))
        return
      }

      if (basePath && parsedUrl.pathname && !parsedUrl.pathname.startsWith(`${basePath}/`) && parsedUrl.pathname !== basePath) {
        parsedUrl.pathname = `${basePath}${parsedUrl.pathname === '/' ? '' : parsedUrl.pathname}`
        req.url = parsedUrl.pathname + (parsedUrl.search || '')
      }

      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      await postEventHub({
        source: 'audio-deepgram',
        type: 'request_error',
        severity: 'error',
        message: 'Request handler error',
        payload: { url: req.url, error: err?.message || String(err) }
      })
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // WebSocket server attached to same HTTP server
  const wss = new WebSocket.Server({ noServer: true })

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = parse(request.url || '', true)
    const strippedPath = stripBasePath(pathname || '/')

    // Only handle our audio streaming WebSocket
    if (strippedPath === '/api/stream-audio') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request)
      })
    }
    // For all other WebSocket connections (including HMR), do nothing
    // This allows Next.js to handle them through its normal flow
  })

  wss.on('connection', (ws) => {
    handleConnection(ws)
  })

  server.listen(port, (err) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> WebSocket available at ws://${hostname}:${port}/api/stream-audio`)
    void postEventHub({
      source: 'audio-deepgram',
      type: 'startup',
      severity: 'info',
      message: `Listening on ${hostname}:${port}`
    })
  })
})
