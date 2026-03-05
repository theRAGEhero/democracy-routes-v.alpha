"use client"

import React, { useState } from 'react'
import { Copy, Download, User } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DeliberationOntology, Contribution } from '@/types/deliberation'

interface TranscriptionDisplayProps {
  data: DeliberationOntology
  roundName?: string
}

export function TranscriptionDisplay({ data, roundName }: TranscriptionDisplayProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const parseTimestamp = (timestamp: string): string => {
    const match = timestamp.match(/PT(\d{2})H(\d{2})M(\d{2})\.(\d{3})S/)
    if (!match) return timestamp

    const hours = parseInt(match[1])
    const minutes = parseInt(match[2])
    const seconds = parseInt(match[3])

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const getSpeakerName = (speakerId: string): string => {
    const participant = data.participants.find(p => p.identifier === speakerId)
    return participant?.name || speakerId
  }

  const getSpeakerColor = (index: number): string => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-teal-500',
      'bg-indigo-500',
      'bg-red-500',
    ]
    return colors[index % colors.length]
  }

  const handleCopyContribution = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (err) {
      console.error('Failed to copy text:', err)
    }
  }

  const handleExportJSON = () => {
    const jsonString = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${roundName || 'transcription'}_deliberation.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleExportText = () => {
    const text = data.contributions
      .map(c => {
        const speaker = getSpeakerName(c.madeBy)
        const time = parseTimestamp(c.timestamp)
        return `[${time}] ${speaker}: ${c.text}`
      })
      .join('\n\n')

    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${roundName || 'transcription'}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header with Statistics */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Transcription Results</CardTitle>
              <CardDescription>
                {roundName && <span className="block">{roundName}</span>}
                {data.deliberation_process.name}
              </CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportText}
              >
                <Download className="mr-2 h-4 w-4" />
                Export Text
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportJSON}
              >
                <Download className="mr-2 h-4 w-4" />
                Export JSON
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="text-2xl font-bold">
                {parseTimestamp(data.deliberation_process.duration)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Speakers</p>
              <p className="text-2xl font-bold">
                {data.statistics.total_speakers}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Contributions</p>
              <p className="text-2xl font-bold">
                {data.statistics.total_contributions}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Words</p>
              <p className="text-2xl font-bold">
                {data.statistics.total_words}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Participants */}
      <Card>
        <CardHeader>
          <CardTitle>Participants</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {data.participants.map((participant, index) => (
              <div
                key={participant.identifier}
                className="flex items-center space-x-2 rounded-full bg-muted px-3 py-1"
              >
                <div className={`h-3 w-3 rounded-full ${getSpeakerColor(index)}`} />
                <span className="text-sm font-medium">{participant.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {participant.statistics.total_contributions} contributions
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contributions */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Transcript</h3>
        {data.contributions.map((contribution, index) => {
          const speakerIndex = data.participants.findIndex(
            p => p.identifier === contribution.madeBy
          )
          const speakerName = getSpeakerName(contribution.madeBy)

          const contributionKey = contribution.identifier ?? `${contribution.madeBy}-${contribution.timestamp}-${index}`

          return (
            <Card key={contributionKey} className="relative">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className={`h-10 w-10 rounded-full ${getSpeakerColor(speakerIndex)} flex items-center justify-center`}>
                      <User className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold">{speakerName}</span>
                        <span className="text-sm text-muted-foreground">
                          {parseTimestamp(contribution.timestamp)}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyContribution(contribution.text, index)}
                      >
                        {copiedIndex === index ? (
                          <span className="text-xs text-green-600">Copied!</span>
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {contribution.text}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
