import localFont from 'next/font/local'

// PAT Sans 0.3 / PAT Serif 0.4 OFL derivatives. See docs/MENTORSHIP_FONTS.md.
// Load only the faces used by the current page, including true italics in lessons.
export const mentorshipSans = localFont({
  src: [
    { path: './fonts/PATSans-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/PATSans-Medium.woff2', weight: '500', style: 'normal' },
    { path: './fonts/PATSans-Semibold.woff2', weight: '600', style: 'normal' },
    { path: './fonts/PATSans-Bold.woff2', weight: '700', style: 'normal' },
    { path: './fonts/PATSans-Italic.woff2', weight: '400', style: 'italic' },
    { path: './fonts/PATSans-BoldItalic.woff2', weight: '700', style: 'italic' },
  ],
  variable: '--font-mentorship-sans',
  display: 'swap',
  preload: false,
})

export const mentorshipSerif = localFont({
  src: [
    { path: './fonts/PATSerif-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/PATSerif-Medium.woff2', weight: '500', style: 'normal' },
    { path: './fonts/PATSerif-Semibold.woff2', weight: '600', style: 'normal' },
    { path: './fonts/PATSerif-Bold.woff2', weight: '700', style: 'normal' },
    { path: './fonts/PATSerif-Italic.woff2', weight: '400', style: 'italic' },
    { path: './fonts/PATSerif-BoldItalic.woff2', weight: '700', style: 'italic' },
  ],
  variable: '--font-mentorship-serif',
  display: 'swap',
  preload: false,
})
