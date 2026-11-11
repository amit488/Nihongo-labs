import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import './globals.css';
import CopyProtection from '@/components/copy-protection';
import GlobalQuickRevision from '@/components/nihongo/global-quick-revision';

export const metadata: Metadata = {
  title: { default: 'Nihongo Labs | Learn Japanese', template: '%s | Nihongo Labs' },
  description: 'A calm, structured workspace for Japanese grammar, vocabulary, kanji, reading and practice.',
  applicationName: 'Nihongo Labs',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    shortcut: ['/favicon.svg'],
  },
  appleWebApp: { capable: true, title: 'Nihongo Labs', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f7f8fa',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><CopyProtection /><Suspense fallback={null}><GlobalQuickRevision /></Suspense>{children}</body></html>;
}
