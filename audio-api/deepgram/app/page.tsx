import Link from 'next/link'
import { Mic, FileAudio, Plus, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        {/* Hero Section */}
        <div className="text-center space-y-6 mb-16">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Deepgram Transcription
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Record or upload audio files to get accurate transcriptions with speaker diarization
          </p>
          <div className="flex items-center justify-center space-x-4 pt-4">
            <Link href="/rounds/new">
              <Button size="lg">
                <Plus className="mr-2 h-5 w-5" />
                Create New Round
              </Button>
            </Link>
            <Link href="/rounds">
              <Button variant="outline" size="lg">
                View All Rounds
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3 mb-2">
                <div className="rounded-full bg-primary/10 p-3">
                  <Mic className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Record Audio</CardTitle>
              </div>
              <CardDescription>
                Record audio directly from your browser using your microphone with pause and resume controls
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Real-time duration tracking</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Pause and resume recording</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>High-quality audio capture</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3 mb-2">
                <div className="rounded-full bg-primary/10 p-3">
                  <FileAudio className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Upload Files</CardTitle>
              </div>
              <CardDescription>
                Upload existing audio files in various formats with drag-and-drop support
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Supports MP3, WAV, WebM, OGG formats</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Drag and drop interface</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Up to 100MB file size</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <div className="space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground">
              Simple process to get your transcriptions
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center space-y-3">
              <div className="rounded-full bg-primary text-primary-foreground w-12 h-12 flex items-center justify-center text-xl font-bold mx-auto">
                1
              </div>
              <h3 className="font-semibold">Create a Round</h3>
              <p className="text-sm text-muted-foreground">
                Start by creating a new recording session with a name and description
              </p>
            </div>

            <div className="text-center space-y-3">
              <div className="rounded-full bg-primary text-primary-foreground w-12 h-12 flex items-center justify-center text-xl font-bold mx-auto">
                2
              </div>
              <h3 className="font-semibold">Add Audio</h3>
              <p className="text-sm text-muted-foreground">
                Record directly or upload an existing audio file for transcription
              </p>
            </div>

            <div className="text-center space-y-3">
              <div className="rounded-full bg-primary text-primary-foreground w-12 h-12 flex items-center justify-center text-xl font-bold mx-auto">
                3
              </div>
              <h3 className="font-semibold">Get Results</h3>
              <p className="text-sm text-muted-foreground">
                View transcriptions with speaker identification and export options
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center bg-muted/50 rounded-lg p-12">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-muted-foreground mb-6">
            Create your first round and experience accurate transcriptions with speaker diarization
          </p>
          <Link href="/rounds/new">
            <Button size="lg">
              <Plus className="mr-2 h-5 w-5" />
              Create Your First Round
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
