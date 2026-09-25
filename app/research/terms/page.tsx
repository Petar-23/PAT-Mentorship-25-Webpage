import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
}

// Platzhalter für Phase a. Phase f ersetzt ihn durch den geprüften Vertragstext.
export default function ResearchTermsPage() {
  return (
    <div className="m-page">
      <div className="m-page-header"><div>
        <p className="m-eyebrow">Legal</p>
        <h1 className="m-page-title">Terms of Service</h1>
      </div></div>
      <div className="r-narrow">
        <p className="r-notice" role="note">Terms of Service — draft. The full terms will be published before launch.</p>
      </div>
    </div>
  )
}
