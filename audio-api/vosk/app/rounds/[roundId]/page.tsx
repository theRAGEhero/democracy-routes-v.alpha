"use client"

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AudioRecorder } from '@/components/recording/AudioRecorder'
import { FileUploader } from '@/components/upload/FileUploader'
import { Progress } from '@/components/ui/progress'
import { TranscriptionDisplay } from '@/components/transcription/TranscriptionDisplay'
import { Round, RoundStatus } from '@/types/round'
import { DeliberationOntology } from '@/types/deliberation'

export default function RoundDetailPage({ params }: { params: { roundId: string } }) {
  const router = useRouter()
  const apiBasePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '')
  const [round, setRound] = useState<Round | null>(null)
  const [transcription, setTranscription] = useState<DeliberationOntology | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processError, setProcessError] = useState<string | null>(null)
  const [audioSource, setAudioSource] = useState<'record' | 'upload' | null>(null)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)

  const fetchRoundData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch round metadata
      const roundResponse = await fetch(`/api/rounds/${params.roundId}`)
      if (!roundResponse.ok) {
        throw new Error('Round not found')
      }
      const roundData = await roundResponse.json()
      setRound(roundData.round)

      // If completed, fetch transcription
      if (roundData.round.status === RoundStatus.COMPLETED && roundData.round.transcription_file) {
        const transcriptionResponse = await fetch(`/api/rounds/${params.roundId}/transcription`)
        if (transcriptionResponse.ok) {
          const transcriptionData = await transcriptionResponse.json()
          setTranscription(transcriptionData)
        }
      }
    } catch (err) {
      const error = err as Error
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRoundData()
  }, [params.roundId])

  const handleDelete = async () => {
    if (!round) return

    if (!confirm(`Are you sure you want to delete "${round.name}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/rounds/${params.roundId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete round')
      }

      router.push('/rounds')
    } catch (err) {
      const error = err as Error
      alert(`Error: ${error.message}`)
    }
  }

  const handleRecordingComplete = (audioBlob: Blob, duration: number) => {
    const file = new File(
      [audioBlob],
      `recording_${Date.now()}.webm`,
      { type: 'audio/webm' }
    )
    setAudioFile(file)
    processAudio(file, duration)
  }

  const handleFileSelect = (file: File) => {
    setAudioFile(file)
  }

  const handleProcessUpload = () => {
    if (audioFile) {
      processAudio(audioFile)
    }
  }

  const processAudio = async (file: File, duration?: number) => {
    if (!round) return

    setIsProcessing(true)
    setProcessError(null)
    setProcessingProgress(0)

    try {
      setProcessingProgress(20)

      const formData = new FormData()
      formData.append('audio', file)
      formData.append('roundId', round.id)
      if (duration) {
        formData.append('duration', duration.toString())
      }

      setProcessingProgress(40)

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Transcription failed')
      }

      await response.json()

      setProcessingProgress(60)

      const pollStart = Date.now()
      const pollTimeoutMs = 10 * 60 * 1000
      const pollIntervalMs = 2000
      let completed = false

      while (Date.now() - pollStart < pollTimeoutMs) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs))
        const roundResponse = await fetch(`/api/rounds/${round.id}`)
        if (!roundResponse.ok) continue
        const roundData = await roundResponse.json()
        if (roundData.round.status === RoundStatus.COMPLETED) {
          setProcessingProgress(100)
          completed = true
          break
        }
        if (roundData.round.status === RoundStatus.ERROR) {
          throw new Error('Transcription failed')
        }
      }

      if (!completed) {
        throw new Error('Transcription timed out')
      }

      await fetchRoundData()
    } catch (err) {
      const error = err as Error
      setProcessError(error.message)
      setIsProcessing(false)

      await fetch(`/api/rounds/${round.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: RoundStatus.ERROR })
      })
      setRound({ ...round, status: RoundStatus.ERROR })
    } finally {
      setIsProcessing(false)
    }
  }

  const getStatusVariant = (status: RoundStatus) => {
    switch (status) {
      case RoundStatus.COMPLETED:
        return 'default'
      case RoundStatus.PROCESSING:
        return 'secondary'
      case RoundStatus.RECORDING:
        return 'default'
      case RoundStatus.ERROR:
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const getStatusLabel = (status: RoundStatus) => {
    switch (status) {
      case RoundStatus.COMPLETED:
        return 'Completed'
      case RoundStatus.PROCESSING:
        return 'Processing'
      case RoundStatus.RECORDING:
        return 'Recording'
      case RoundStatus.ERROR:
        return 'Error'
      case RoundStatus.CREATED:
        return 'Created'
      default:
        return status
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Loading round...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !round) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <Link href="/rounds">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Rounds
            </Button>
          </Link>
          <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
            {error || 'Round not found'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/rounds">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Rounds
            </Button>
          </Link>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-2 min-w-0">
                <h1 className="text-4xl font-bold break-all">{round.name}</h1>
                <Badge variant={getStatusVariant(round.status)}>
                  {getStatusLabel(round.status)}
                </Badge>
              </div>
              {round.description && (
                <p className="text-muted-foreground text-lg">
                  {round.description}
                </p>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                Created {formatDate(round.created_at)}
              </p>
              <p className="text-sm text-muted-foreground">
                Language: <span className="font-medium text-foreground">{round.language || 'en'}</span>
              </p>
            </div>
            <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start">
              <Card className="w-full max-w-[260px]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Round QR</CardTitle>
                  <CardDescription>Open on another device</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-3">
                  <img
                    src={`${apiBasePath}/api/rounds/${round.id}/qr`}
                    alt="QR code for this round"
                    className="h-40 w-40"
                    />
                  <Link
                    href={`/rounds/${round.id}`}
                    className="text-xs font-medium text-primary underline underline-offset-4"
                  >
                    /rounds/{round.id}
                  </Link>
                </CardContent>
              </Card>
              <Button
                variant="destructive"
                onClick={handleDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {(round.status === RoundStatus.PROCESSING || isProcessing) && (
          <div className="rounded-md bg-blue-500/10 p-4 text-sm text-blue-700 dark:text-blue-400 mb-6">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Processing audio... This may take a few minutes.</span>
            </div>
          </div>
        )}

        {round.status === RoundStatus.ERROR && (
          <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive mb-6">
            An error occurred during processing. Please try creating a new round.
          </div>
        )}

        {round.status === RoundStatus.CREATED && (
          <div className="rounded-md bg-yellow-500/10 p-4 text-sm text-yellow-700 dark:text-yellow-400 mb-6">
            This round has been created but no audio has been added yet.
          </div>
        )}

        {(round.status === RoundStatus.CREATED || round.status === RoundStatus.ERROR) && !isProcessing && (
          <div className="space-y-6 mb-8">
            <div className="flex items-center justify-center space-x-4">
              <Button
                variant={audioSource === 'record' ? 'default' : 'outline'}
                onClick={() => setAudioSource('record')}
              >
                Record Audio
              </Button>
              <span className="text-muted-foreground">or</span>
              <Button
                variant={audioSource === 'upload' ? 'default' : 'outline'}
                onClick={() => setAudioSource('upload')}
              >
                Upload File
              </Button>
            </div>

            {audioSource === 'record' && (
              <AudioRecorder
                onRecordingComplete={handleRecordingComplete}
                roundId={round.id}
              />
            )}

            {audioSource === 'upload' && (
              <div className="space-y-4">
                <FileUploader onFileSelect={handleFileSelect} />
                {audioFile && (
                  <Button
                    onClick={handleProcessUpload}
                    className="w-full"
                    size="lg"
                  >
                    Process Audio
                  </Button>
                )}
              </div>
            )}

            {processError && (
              <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                {processError}
              </div>
            )}
          </div>
        )}

        {isProcessing && (
          <div className="space-y-4 mb-8">
            <div className="max-w-md">
              <Progress value={processingProgress} max={100} />
              <p className="text-sm text-muted-foreground mt-2">
                {processingProgress}% complete
              </p>
            </div>
          </div>
        )}

        {/* Transcription Display */}
        {round.status === RoundStatus.COMPLETED && transcription && (
          <TranscriptionDisplay
            data={transcription}
            roundName={round.name}
          />
        )}

        {round.status === RoundStatus.COMPLETED && !transcription && (
          <div className="rounded-md bg-yellow-500/10 p-4 text-sm text-yellow-700 dark:text-yellow-400 mb-6">
            <div className="flex items-center justify-between">
              <span>Transcription file not found.</span>
              <Button variant="outline" size="sm" onClick={fetchRoundData}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
