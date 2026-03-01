import localFont from 'next/font/local';

const GeistPixelLine = localFont({
  src: '../../../public/fonts/GeistPixel-Line.woff2',
  variable: '--font-geist-pixel-line',
  weight: '500',
  display: 'swap',
  adjustFontFallback: false,
});

export default function WorldWatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={GeistPixelLine.variable}
      style={{
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        fontFamily: 'var(--font-geist-pixel-line), ui-monospace, monospace',
      }}
    >
      {children}
    </div>
  );
}
