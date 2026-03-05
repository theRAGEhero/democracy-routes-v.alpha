"use client"

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateRoundForm } from '@/components/rounds/CreateRoundForm'
import { AudioRecorder } from '@/components/recording/AudioRecorder'
import { FileUploader } from '@/components/upload/FileUploader'
import { Progress } from '@/components/ui/progress'
import { RoundStatus } from '@/types/round'

export default function NewRoundPage() {
  const router = useRouter()
  const apiBasePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '')
  const [currentStep, setCurrentStep] = useState<'create' | 'audio' | 'processing'>('create')
  const [roundId, setRoundId] = useState<string | null>(null)
  const [audioSource, setAudioSource] = useState<'record' | 'upload' | null>(null)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const handleRoundCreated = (newRoundId: string) => {
    setRoundId(newRoundId)
    setCurrentStep('audio')
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
    if (!roundId) return

    setIsProcessing(true)
    setCurrentStep('processing')
    setError(null)
    setProcessingProgress(0)

    try {
      setProcessingProgress(20)

      // Upload and transcribe
      const formData = new FormData()
      formData.append('audio', file)
      formData.append('roundId', roundId)
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
        const roundResponse = await fetch(`/api/rounds/${roundId}`)
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

      // Redirect to round detail page
      setTimeout(() => {
        router.push(`/rounds/${roundId}`)
      }, 500)
    } catch (err) {
      const error = err as Error
      setError(error.message)
      setIsProcessing(false)

      // Update round status to error
      if (roundId) {
        await fetch(`/api/rounds/${roundId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: RoundStatus.ERROR })
        })
      }
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/rounds">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Rounds
            </Button>
          </Link>
          <h1 className="text-4xl font-bold">Create New Round</h1>
          <p className="text-muted-foreground mt-2">
            Record or upload audio for local transcription
          </p>
        </div>

        {/* Step 1: Create Round */}
        {currentStep === 'create' && (
          <CreateRoundForm onSuccess={handleRoundCreated} />
        )}

        {/* Step 2: Audio Input */}
        {currentStep === 'audio' && !isProcessing && (
          <div className="space-y-6">
            {roundId && (
              <Card>
                <CardHeader>
                  <CardTitle>Share This Round</CardTitle>
                  <CardDescription>
                    Scan to open this round on another device
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-6 flex-wrap">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Round link:
                    </p>
                    <Link
                      href={`/rounds/${roundId}`}
                      className="text-sm font-medium text-primary underline underline-offset-4"
                    >
                      /rounds/{roundId}
                    </Link>
                  </div>
                  <div className="rounded-md border bg-background p-2">
                    <img
                      src={`${apiBasePath}/api/rounds/${roundId}/qr`}
                      alt="QR code for this round"
                      className="h-40 w-40"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-center space-x-4 mb-8">
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
                roundId={roundId || ''}
                disabled={!roundId}
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

            {error && (
              <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Processing */}
        {currentStep === 'processing' && (
          <div className="space-y-6">
            <div className="text-center space-y-4 py-12">
              <h2 className="text-2xl font-semibold">Processing Audio</h2>
              <p className="text-muted-foreground">
                Transcribing audio locally...
              </p>
              <div className="max-w-md mx-auto space-y-2">
                <Progress value={processingProgress} max={100} />
                <p className="text-sm text-muted-foreground">
                  {processingProgress}% complete
                </p>
              </div>
              {processingProgress === 100 && (
                <p className="text-sm text-green-600 font-medium">
                  Transcription complete! Redirecting...
                </p>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                <p className="font-semibold mb-2">Processing failed:</p>
                <p>{error}</p>
                <Button
                  onClick={() => {
                    setCurrentStep('audio')
                    setError(null)
                  }}
                  variant="outline"
                  className="mt-4"
                >
                  Try Again
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
