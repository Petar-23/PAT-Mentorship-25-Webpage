/**
 * Prop-Firm-Rechner: Rechen-Worker. Bekommt einmal die Regel-Daten, danach Aufträge (Pfad-Bereich, Einstellungen,
 * Kontotypen) und schickt Fortschritt und Kennzahlen-Arrays zurück.
 */
import type { Konto } from './kern'
import { ladeKonten } from './konten'
import type { RegelDaten } from './konten'
import { simuliere } from './simulation'
import type { SimEinstellungen } from './simulation'

export type WorkerNachricht =
  | { typ: 'daten'; daten: RegelDaten }
  | { typ: 'auftrag'; id: number; einst: SimEinstellungen; schluessel: string[]; von: number; bis: number }

type WorkerScope = {
  onmessage: ((ev: MessageEvent<WorkerNachricht>) => void) | null
  postMessage(nachricht: unknown, transfer?: Transferable[]): void
}
const scope = self as unknown as WorkerScope
const konten = new Map<string, Konto>()

scope.onmessage = (ev: MessageEvent<WorkerNachricht>) => {
  const m = ev.data
  if (m.typ === 'daten') {
    konten.clear()
    for (const e of ladeKonten(m.daten)) for (const r of e.rechnungen) konten.set(`${e.id}|${r.name}`, r.konto)
    return
  }
  try {
    const auftraege = m.schluessel.filter((s) => konten.has(s)).map((s) => ({ schluessel: s, konto: konten.get(s) as Konto }))
    let gemeldet = 0
    const roh = simuliere(auftraege, m.einst, m.von, m.bis, (fertig) => {
      if (fertig - gemeldet >= 5 || fertig === m.bis - m.von) {
        scope.postMessage({ typ: 'fortschritt', id: m.id, fertig })
        gemeldet = fertig
      }
    })
    const transfer = Object.values(roh).flatMap((r) => [r.kante.buffer, r.null.buffer])
    scope.postMessage({ typ: 'fertig', id: m.id, roh }, transfer)
  } catch (err) {
    scope.postMessage({ typ: 'fehler', id: m.id, text: err instanceof Error ? err.message : String(err) })
  }
}
