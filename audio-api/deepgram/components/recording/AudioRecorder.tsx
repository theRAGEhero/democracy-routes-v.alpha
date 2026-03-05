"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Mic, Square, Pause, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void
  disabled?: boolean
  roundId: string
}

export function AudioRecorder({ onRecordingComplete, disabled = false, roundId }: AudioRecorderProps) {
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '')
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [permissionGranted, setPermissionGranted] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const pausedTimeRef = useRef<number>(0)
  const wsRef = useRef<WebSocket | null>(null)
  const sequenceRef = useRef<number>(0)
  const chunkBufferRef = useRef<Array<{ sequence: number, data: Blob }>>([])
  const reconnectAttemptsRef = useRef<number>(0)

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const startTimer = () => {
    startTimeRef.current = Date.now() - pausedTimeRef.current
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      setDuration(elapsed)
    }, 100)
  }

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const connectWebSocket = (mimeType: string) => {
    if (!roundId) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setConnectionStatus('connecting')
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const path = `${basePath}/api/stream-audio`.replace(/\/{2,}/g, '/')
    const ws = new WebSocket(`${protocol}://${window.location.host}${path}`)

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'init', roundId, mimeType }))
    }

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)

      if (message.type === 'ready') {
        setConnectionStatus('connected')
        reconnectAttemptsRef.current = 0
        // Send any buffered chunks
        chunkBufferRef.current.forEach(({ sequence, data }) => {
          streamChunk(data, sequence)
        })
        chunkBufferRef.current = []
      } else if (message.type === 'ack') {
        // Chunk acknowledged
      } else if (message.type === 'missing') {
        // Resend missing chunks
        message.sequences.forEach((seq: number) => {
          const buffered = chunkBufferRef.current.find(c => c.sequence === seq)
          if (buffered) {
            streamChunk(buffered.data, buffered.sequence)
          }
        })
      } else if (message.type === 'error') {
        console.error('WebSocket error from server:', message.message)
        setConnectionStatus('error')
      }
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setConnectionStatus('error')
    }

    ws.onclose = () => {
      setConnectionStatus('disconnected')
      if (isRecording && !isPaused) {
        attemptReconnect(mimeType)
      }
    }

    wsRef.current = ws
  }

  const streamChunk = (data: Blob, sequence: number) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return

    data.arrayBuffer().then(buffer => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'chunk',
          sequence,
          timestamp: Date.now()
        }))
        wsRef.current.send(buffer)
      }
    })
  }

  const attemptReconnect = (mimeType: string) => {
    if (reconnectAttemptsRef.current >= 10) {
      setError('Connection lost. Recording continues locally - will upload at end.')
      return
    }

    const delays = [0, 1000, 2000, 4000, 8000]
    const delay = delays[Math.min(reconnectAttemptsRef.current, 4)]
    reconnectAttemptsRef.current++

    setTimeout(() => {
      if (isRecording && roundId) {
        connectWebSocket(mimeType)
      }
    }, delay)
  }

  const requestMicrophonePermission = async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })
      setPermissionGranted(true)
      setError(null)
      return stream
    } catch (err) {
      const error = err as Error
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setError('Microphone access denied. Please allow microphone permissions.')
      } else if (error.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.')
      } else {
        setError(`Failed to access microphone: ${error.message}`)
      }
      return null
    }
  }

  const startRecording = async () => {
    setError(null)
    const stream = await requestMicrophonePermission()
    if (!stream) return

    try {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg'

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000
      })

      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)

          // Stream chunk via WebSocket if connected
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            streamChunk(event.data, sequenceRef.current++)
          } else {
            // Buffer for later if disconnected
            chunkBufferRef.current.push({
              sequence: sequenceRef.current++,
              data: event.data
            })
            // Limit buffer size to prevent memory issues
            if (chunkBufferRef.current.length > 500) {
              chunkBufferRef.current.shift() // Remove oldest chunk
              console.warn('Chunk buffer full - dropping oldest chunk')
            }
          }
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType })
        const finalDuration = duration

        // Signal completion to server
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'complete',
            totalChunks: sequenceRef.current,
            finalDuration
          }))

          // Wait for server acknowledgment (max 5s)
          await new Promise(resolve => setTimeout(resolve, 5000))
        }

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())

        // Close WebSocket
        if (wsRef.current) {
          wsRef.current.close()
          wsRef.current = null
        }

        onRecordingComplete(audioBlob, finalDuration)

        // Reset state
        setIsRecording(false)
        setIsPaused(false)
        setDuration(0)
        setConnectionStatus('disconnected')
        pausedTimeRef.current = 0
        chunksRef.current = []
        sequenceRef.current = 0
        chunkBufferRef.current = []
        reconnectAttemptsRef.current = 0
      }

      mediaRecorder.start(100) // Collect data every 100ms
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
      setIsPaused(false)
      startTimer()

      // Connect WebSocket for progressive upload
      connectWebSocket(mimeType)
    } catch (err) {
      const error = err as Error
      setError(`Failed to start recording: ${error.message}`)
      stream.getTracks().forEach(track => track.stop())
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
      stopTimer()
      pausedTimeRef.current = Date.now() - startTimeRef.current
    }
  }

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
      startTimer()
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      stopTimer()
      mediaRecorderRef.current.stop()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record Audio</CardTitle>
        <CardDescription>
          Record audio directly from your microphone
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-col items-center space-y-4">
          {isRecording && (
            <div className="flex items-center space-x-2">
              <Badge variant={isPaused ? "secondary" : "default"}>
                {isPaused ? 'Paused' : 'Recording'}
              </Badge>
              {!isPaused && (
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              )}
              {connectionStatus === 'connected' && (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  Backup Active
                </Badge>
              )}
              {connectionStatus === 'connecting' && (
                <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                  Connecting...
                </Badge>
              )}
              {connectionStatus === 'error' && (
                <Badge variant="outline" className="text-orange-600 border-orange-600">
                  Local Only
                </Badge>
              )}
            </div>
          )}

          <div className="text-4xl font-mono font-bold">
            {formatDuration(duration)}
          </div>

          <div className="flex items-center space-x-2">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                disabled={disabled}
                size="lg"
                className="w-32"
              >
                <Mic className="mr-2 h-5 w-5" />
                Start
              </Button>
            ) : (
              <>
                {!isPaused ? (
                  <Button
                    onClick={pauseRecording}
                    variant="outline"
                    size="lg"
                  >
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </Button>
                ) : (
                  <Button
                    onClick={resumeRecording}
                    variant="outline"
                    size="lg"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Resume
                  </Button>
                )}
                <Button
                  onClick={stopRecording}
                  variant="destructive"
                  size="lg"
                  className="w-32"
                >
                  <Square className="mr-2 h-4 w-4" />
                  Stop
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
