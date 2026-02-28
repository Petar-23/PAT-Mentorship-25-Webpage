// World Watch — Minimal layout (no PAT nav/header — standalone terminal UI)
export default function WorldWatchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
      {children}
    </div>
  );
}
