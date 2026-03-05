"use client"

import React from 'react'
import Link from 'next/link'
import { Clock, Users, FileText, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Round, RoundStatus } from '@/types/round'

interface RoundCardProps {
  round: Round
  onDelete?: (roundId: string) => void
}

export function RoundCard({ round, onDelete }: RoundCardProps) {
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
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <Link href={`/rounds/${round.id}`} className="min-w-0">
              <CardTitle className="hover:text-primary cursor-pointer line-clamp-2 break-all">
                {round.name}
              </CardTitle>
            </Link>
            {round.description && (
              <CardDescription className="mt-1 line-clamp-2">
                {round.description}
              </CardDescription>
            )}
          </div>
          <Badge variant={getStatusVariant(round.status)} className="ml-2 flex-shrink-0">
            {getStatusLabel(round.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{formatDuration(round.duration_seconds)}</span>
            </div>
            <div className="flex items-center space-x-2 text-muted-foreground">
              <span className="font-medium">Lang:</span>
              <span>{round.language || 'en'}</span>
            </div>
            {round.speaker_count !== undefined && (
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{round.speaker_count} speakers</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-xs text-muted-foreground">
              {formatDate(round.created_at)}
            </span>
            <div className="flex space-x-2">
              {round.status === RoundStatus.COMPLETED && (
                <Link href={`/rounds/${round.id}`}>
                  <Button variant="outline" size="sm">
                    <FileText className="mr-2 h-4 w-4" />
                    View
                  </Button>
                </Link>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault()
                    if (confirm(`Are you sure you want to delete "${round.name}"?`)) {
                      onDelete(round.id)
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
