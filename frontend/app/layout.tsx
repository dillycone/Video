import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata = {
  title: 'AI-Powered Tools',
  description: 'Advanced AI capabilities for video transcription, document analysis, image recognition, and audio processing',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <body className={`${inter.className} antialiased bg-[#F5F5F5] text-black min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
