import { PFADE } from './pfade'
import { woerterbuch, type Sprache } from './texte'

/** DE | EN. Volle Seitenwechsel (kein Client-Routing), damit Farbschema und Wörterbuch frisch starten. */
export function Sprachwahl({ sprache }: { sprache: Sprache }) {
  const t = woerterbuch(sprache)
  return (
    <nav className="sprachwahl" aria-label={t.seite.sprachwahl}>
      <a href={PFADE.de} hrefLang="de" lang="de" aria-label="Deutsch" aria-current={sprache === 'de' ? 'page' : undefined}>
        DE
      </a>
      <a href={PFADE.en} hrefLang="en" lang="en" aria-label="English" aria-current={sprache === 'en' ? 'page' : undefined}>
        EN
      </a>
    </nav>
  )
}
