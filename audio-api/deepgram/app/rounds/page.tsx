"use client"

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RoundCard } from '@/components/rounds/RoundCard'
import { Round } from '@/types/round'

export default function RoundsPage() {
  const [rounds, setRounds] = useState<Round[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRounds = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/rounds')
      if (!response.ok) {
        throw new Error('Failed to fetch rounds')
      }
      const data = await response.json()
      setRounds(data.rounds)
    } catch (err) {
      const error = err as Error
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRounds()
  }, [])

  const handleDelete = async (roundId: string) => {
    try {
      const response = await fetch(`/api/rounds/${roundId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete round')
      }

      // Remove from local state
      setRounds(rounds.filter(r => r.id !== roundId))
    } catch (err) {
      const error = err as Error
      alert(`Error: ${error.message}`)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold">Rounds</h1>
            <p className="text-muted-foreground mt-2">
              Manage your recording sessions and transcriptions
            </p>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={fetchRounds}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Link href="/rounds/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Round
              </Button>
            </Link>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive mb-6">
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">Loading rounds...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && rounds.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <h3 className="text-lg font-semibold mb-2">No rounds yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first recording session to get started
            </p>
            <Link href="/rounds/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Round
              </Button>
            </Link>
          </div>
        )}

        {/* Rounds Grid */}
        {!isLoading && !error && rounds.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rounds.map(round => (
              <RoundCard
                key={round.id}
                round={round}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
