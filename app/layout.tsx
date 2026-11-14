import type { Metadata } from 'next';
import {
  Plus_Jakarta_Sans,
  Fraunces,
  JetBrains_Mono,
  Bebas_Neue,
  Anton,
  Montserrat,
  Cinzel,
  Orbitron,
  Oswald,
} from 'next/font/google';
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

const bebas = Bebas_Neue({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-bebas',
});

const anton = Anton({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-anton',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--font-montserrat',
});

const cinzel = Cinzel({
  subsets: ['latin'],
  weight: ['700', '900'],
  variable: '--font-cinzel',
});

const orbitron = Orbitron({
  subsets: ['latin'],
  weight: ['700', '900'],
  variable: '--font-orbitron',
});

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-oswald',
});

export const metadata: Metadata = {
  title: 'CaptionX Free Studio — Automatic Video Captions & Subtitles (No Watermark)',
  description:
    'Free online automatic video caption generator, After Effects kinetic typography, cinematic behind-building depth titles, and watermark-free video/SRT exports.',
  openGraph: {
    title: 'CaptionX Free Studio — Automatic Video Captions & Subtitles (No Watermark)',
    description:
      'Free online automatic video caption generator, After Effects kinetic typography, cinematic behind-building depth titles, and watermark-free video/SRT exports.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CaptionX Free Studio — Automatic Video Captions & Subtitles (No Watermark)',
    description:
      'Free online automatic video caption generator, After Effects kinetic typography, cinematic behind-building depth titles, and watermark-free video/SRT exports.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${fraunces.variable} ${jetbrains.variable} ${bebas.variable} ${anton.variable} ${montserrat.variable} ${cinzel.variable} ${orbitron.variable} ${oswald.variable}`}
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
