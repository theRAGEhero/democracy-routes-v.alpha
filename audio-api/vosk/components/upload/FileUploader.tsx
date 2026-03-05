"use client"

import React, { useState, useRef } from 'react'
import { Upload, X, File } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface FileUploaderProps {
  onFileSelect: (file: File) => void
  disabled?: boolean
  accept?: string
  maxSizeMB?: number
}

export function FileUploader({
  onFileSelect,
  disabled = false,
  accept = 'audio/mp3,audio/wav,audio/webm,audio/ogg,audio/mpeg,video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska',
  maxSizeMB = 100
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const maxSizeBytes = maxSizeMB * 1024 * 1024

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > maxSizeBytes) {
      return `File size exceeds ${maxSizeMB}MB limit`
    }

    // Check file type
    const acceptedTypes = accept.split(',').map(t => t.trim())
    const fileType = file.type
    const isValidType = acceptedTypes.some(type => {
      if (type.endsWith('/*')) {
        const prefix = type.slice(0, -2)
        return fileType.startsWith(prefix)
      }
      return fileType === type
    })

    if (!isValidType) {
      return 'Invalid file type. Please upload an audio or video file.'
    }

    return null
  }

  const handleFile = (file: File) => {
    setError(null)
    const validationError = validateFile(file)

    if (validationError) {
      setError(validationError)
      return
    }

    setSelectedFile(file)
    onFileSelect(file)
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (disabled) return

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  const handleClearFile = () => {
    setSelectedFile(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getFileExtension = (filename: string): string => {
    const parts = filename.split('.')
    return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : 'FILE'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Audio or Video File</CardTitle>
        <CardDescription>
          Drag and drop or browse for an audio or video file (max {maxSizeMB}MB)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!selectedFile ? (
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors duration-200
              ${isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            onClick={!disabled ? handleBrowseClick : undefined}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              onChange={handleFileInputChange}
              disabled={disabled}
              className="hidden"
            />

            <div className="flex flex-col items-center space-y-4">
              <div className={`
                rounded-full p-4
                ${isDragging ? 'bg-primary/10' : 'bg-muted'}
              `}>
                <Upload className={`h-8 w-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {isDragging ? 'Drop file here' : 'Drag and drop your audio or video file'}
                </p>
                <p className="text-xs text-muted-foreground">
                  or click to browse
                </p>
              </div>

              <div className="text-xs text-muted-foreground">
                Supported formats: MP3, WAV, WebM, OGG, MP4, MOV, AVI, MKV
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1 min-w-0">
                <div className="rounded bg-primary/10 p-2 flex-shrink-0">
                  <File className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-medium truncate">
                    {selectedFile.name}
                  </p>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <span>{formatFileSize(selectedFile.size)}</span>
                    <span>•</span>
                    <span>{getFileExtension(selectedFile.name)}</span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFile}
                disabled={disabled}
                className="flex-shrink-0 ml-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
