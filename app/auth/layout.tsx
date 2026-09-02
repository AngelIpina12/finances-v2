import { generatePageTitle } from '@/src/shared/utils/metadata'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
    title: generatePageTitle("¡Bienvenido!")
}

export const viewport: Viewport = {
    colorScheme: 'light dark',
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#f6f8fb' },
        { media: '(prefers-color-scheme: dark)', color: '#151c28' },
    ],
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <>
            {children}
        </>
    )
}
