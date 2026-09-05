import Image from 'next/image'
import { Check } from '@phosphor-icons/react/dist/ssr/Check'
import { DiscordLinkButton } from '@/components/discord/discord-link-button'

export function MentorshipCommunityContent({ connected, accountLabel, status, reason }: {
  connected: boolean
  accountLabel: string | null
  status?: string
  reason?: string
}) {
  return (
    <div className="m-page m-community">
      <div className="m-page-header">
        <div><p className="m-eyebrow">Community</p><h1 className="m-page-title">Gute Fragen sind hier<br />in guter Gesellschaft.</h1>
          <p className="m-page-intro">Charts besprechen, Gedanken teilen und gemeinsam lernen. Deine PAT Community auf Discord.</p></div>
      </div>
      <div className="m-community-art" aria-hidden="true">
        <Image src="/images/mentorship/exchange.webp" alt="" fill sizes="(max-width: 767px) 100vw, 740px" />
      </div>
      <div className="m-community-connection">
        {status === 'linked' ? <p className="mb-5 rounded-lg border p-4 text-sm">Discord ist verknüpft, aber deine Mitgliedschaft ist nicht aktiv.</p> : null}
        {status === 'error' ? <p role="alert" className="m-status-error mb-5 rounded-lg border p-4 text-sm">Die Verbindung hat nicht geklappt. Bitte versuch es noch einmal.{reason ? ` Grund: ${reason}` : ''}</p> : null}
        <h2 className="text-lg mb-2">{connected ? 'Dein Discord ist verbunden.' : 'Einmal verbinden. Dabei sein.'}</h2>
        <p className="text-sm text-muted-foreground mb-6">{connected ? 'Dein Account ist mit PAT verknüpft. Die verfügbaren Kanäle richten sich nach deiner Mitgliedschaft.' : 'Verknüpfe deinen Discord-Account mit deiner Mitgliedschaft, um Zugang zu den Community-Kanälen zu bekommen.'}</p>
        <div>
          {connected ? <div className="m-status-success mb-4 flex items-center gap-3 rounded-xl px-4 py-3"><Check aria-hidden="true" /><span>{accountLabel ?? 'Discord verbunden'}</span></div> : null}
          <DiscordLinkButton connected={connected} />
        </div>
      </div>
      <p className="m-quiet-note">Auch „Kannst du das noch mal erklären?“ ist eine gute Frage.</p>
    </div>
  )
}
