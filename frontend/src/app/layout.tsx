import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Document Processor',
  description: 'Async document processing workflow system',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
          <a href="/" className="text-lg font-semibold text-blue-600">DocProcessor</a>
          <a href="/" className="text-sm text-gray-600 hover:text-gray-900">Dashboard</a>
          <a href="/upload" className="text-sm text-gray-600 hover:text-gray-900">Upload</a>
        </nav>
        <main className="max-w-6xl mx-auto px-6 py-8" suppressHydrationWarning>{children}</main>
      </body>
    </html>
  )
}
