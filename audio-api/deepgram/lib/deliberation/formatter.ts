/**
 * Timestamp formatting utilities
 * Ported from Podfree-Editor: deepgram_transcribe_debates.py lines 63-69
 */

/**
 * Convert seconds to ISO 8601 duration format
 * Port of format_timestamp() from Python
 * @param seconds - Duration in seconds
 * @returns ISO 8601 formatted string (PT00H00M00.000S)
 */
export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `PT${hours.toString().padStart(2, '0')}H${minutes.toString().padStart(2, '0')}M${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}S`;
}

/**
 * Format seconds to human-readable timestamp (MM:SS or HH:MM:SS)
 */
export function formatTimestampLabel(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Clean filename for use as identifier
 * Port of clean_filename() from Python (lines 49-61)
 */
export function cleanFilename(filename: string): string {
  // Remove extension
  let name = filename.replace(/\.[^/.]+$/, '');

  // Replace problematic characters with underscores
  name = name.replace(/[<>:"/\\|?*]/g, '_');

  // Remove quotes and special characters
  name = name.replace(/["""''']/g, '');

  // Replace multiple spaces/underscores with single underscore
  name = name.replace(/[_\s]+/g, '_');

  // Remove leading/trailing underscores
  name = name.replace(/^_+|_+$/g, '');

  return name;
}
