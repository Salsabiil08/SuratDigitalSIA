import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['800'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SIADocs - Sistem Penomoran & Disposisi Surat Digital PT Semen Indonesia Aceh',
  description: 'Sistem penomoran resmi, pengesahan tanda tangan, dan disposisi surat digital PT Semen Indonesia Aceh (R.04)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${inter.variable} ${playfair.variable}`}>
      <body className="antialiased min-h-screen bg-page-gradient text-[#1C1C1E]">
        {children}
      </body>
    </html>
  );
}

