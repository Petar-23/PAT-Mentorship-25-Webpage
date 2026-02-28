import { GeistPixelSquare } from 'geist/font/pixel';

export default function WorldWatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={GeistPixelSquare.className} style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
      {children}
    </div>
  );
}
