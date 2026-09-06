export function MentorshipLoadingIndicator({ label = 'Inhalte werden geladen' }: { label?: string }) {
  return <div className="m-loading-state" role="status" aria-label={label} aria-busy="true">
    <div className="m-loading-indicator" aria-hidden="true"><span className="m-loading-ring" /><span>{label}</span></div>
  </div>
}

export function MentorshipLoadingScreen({ label }: { label?: string }) {
  return <div className="m-workspace">
    <div className="m-desktop-sidebar hidden xl:block" aria-hidden="true"><div className="m-sidebar" /></div>
    <div className="m-page-scroll"><MentorshipLoadingIndicator label={label} /></div>
  </div>
}

export function MentorshipOutlineLoading() {
  return <div className="m-lesson-outline"><MentorshipLoadingIndicator label="Lektionen werden geladen" /></div>
}
