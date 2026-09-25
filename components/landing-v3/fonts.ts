import localFont from 'next/font/local'

// PAT Sans und PAT Serif (OFL, siehe docs/MENTORSHIP_FONTS.md), bytegleich mit dem Entwurf.
// Die Landingpage nutzt nur Sans 400/500/600 und Serif 500.
// Vorgeladen wird nur die Serif (dreizeilige H1 im Hero). next/font lädt pro Aufruf alle Schnitte vor,
// einzelne Sans-Schnitte lassen sich nicht getrennt vorladen, ohne eine zweite Familie zu erzeugen.
export const landingSans = localFont({
  src: [
    { path: '../../app/mentorship/fonts/PATSans-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../../app/mentorship/fonts/PATSans-Medium.woff2', weight: '500', style: 'normal' },
    { path: '../../app/mentorship/fonts/PATSans-Semibold.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--lf-font-sans',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Arial',
})

export const landingSerif = localFont({
  src: [{ path: '../../app/mentorship/fonts/PATSerif-Medium.woff2', weight: '500', style: 'normal' }],
  variable: '--lf-font-serif',
  display: 'swap',
  preload: true,
  adjustFontFallback: 'Times New Roman',
})
