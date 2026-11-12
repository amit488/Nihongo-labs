import type { Metadata, Viewport } from 'next';
import './globals.css';
import CopyProtection from '@/components/copy-protection';

export const metadata: Metadata = {
  title: { default: 'Nihongo Labs | Learn Japanese', template: '%s | Nihongo Labs' },
  description: 'A calm, structured workspace for Japanese grammar, vocabulary, kanji, reading and practice.',
  applicationName: 'Nihongo Labs',
  icons: {
    icon: [{ url: '/nihongo-labs-logo.png', type: 'image/png', sizes: '128x128' }],
    shortcut: ['/nihongo-labs-logo.png'],
    apple: [{ url: '/nihongo-labs-logo.png', type: 'image/png', sizes: '128x128' }],
  },
  appleWebApp: { capable: true, title: 'Nihongo Labs', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f7f8fa',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><CopyProtection />{children}</body></html>;
}
