import type { Metadata } from 'next'
import { Fraunces, Space_Grotesk } from 'next/font/google'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans'
})

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif'
})

export const metadata: Metadata = {
  title: 'VOSK Transcription - Rounds',
  description: 'Record and transcribe audio locally with VOSK',
  icons: {
    icon: '/favicon.svg'
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '')
  const bootstrapScript = `
    (function() {
      var bp = ${JSON.stringify(basePath)};
      if (!bp) return;
      if (!bp.startsWith('/')) bp = '/' + bp;
      if (bp === '/') return;
      var origFetch = window.fetch ? window.fetch.bind(window) : null;
      if (!origFetch) return;
      window.fetch = function(input, init) {
        try {
          if (typeof input === 'string' && input.startsWith('/') && !input.startsWith(bp + '/')) {
            input = bp + input;
          }
        } catch (_) {}
        return origFetch(input, init);
      };
    })();
  `;

  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} ${fraunces.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: bootstrapScript }} />
        {children}
      </body>
    </html>
  )
}
