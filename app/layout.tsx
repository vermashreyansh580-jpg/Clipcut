import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Fraunces, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'CaptionX Free Studio — Automatic Video Captions & Subtitles (No Watermark)',
  description:
    'Free online automatic video caption generator, animated subtitle studio, and real-time subtitle converter with watermark-free video and SRT exports.',
  openGraph: {
    title: 'CaptionX Free Studio — Automatic Video Captions & Subtitles (No Watermark)',
    description:
      'Free online automatic video caption generator, animated subtitle studio, and real-time subtitle converter with watermark-free video and SRT exports.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CaptionX Free Studio — Automatic Video Captions & Subtitles (No Watermark)',
    description:
      'Free online automatic video caption generator, animated subtitle studio, and real-time subtitle converter with watermark-free video and SRT exports.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${fraunces.variable} ${jetbrains.variable}`}
    >
      <body
        suppressHydrationWarning
        className="min-h-screen bg-white text-slate-900 antialiased selection:bg-blue-600 selection:text-white"
        style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
      >
        {children}
      </body>
    </html>
  );
}
