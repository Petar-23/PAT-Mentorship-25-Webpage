# PAT Research – Bauplan (Entwurf zur Freigabe)

Stand: 25.09.2026 · Branch `feat/pat-research-platform` (frisch von `origin/main`, eigener Worktree) · Phase a in Arbeit (lokal).

## 0. Kurzfassung

- **Eine App, ein Vercel-Projekt, eine Datenbank.** `research.price-action-trader.de` wird als zusätzliche Domain auf das bestehende Projekt gelegt; die Middleware leitet Anfragen dieser Domain intern auf `app/research/**` um. Clerk-Konten sind dieselben wie bei Mentorship und Raid Map.
- **Look & Feel der Mentorship** (PAT Sans/Serif, warme Monochrom-Palette, Hell/Dunkel, Shell mit Seitenleiste) – wiederverwendet über `mentorship.css`, Fonts, Icons und UI-Primitive. Research bekommt eine eigene, englische Shell (97-Zeilen-Fork), damit die Mentorship unverändert bleibt.
- **Bezahlung wie Raid Map:** eigener USD-Stripe-Customer, eigene Tabelle `ResearchSubscription`, Webhook-Zweig `metadata.product = 'research'`, drei Monatspreise (7 / 10 empfohlen / 15 USD, gleicher Zugang), Kundenportal für Kündigen/Wechseln. Zugang strikt zeitgebunden, `past_due` nur mit 72 h Kulanz (Logik aus dem Security-Branch übernommen).
- **Benachrichtigungen über eine Outbox:** Veröffentlichung (sofort oder geplant) erzeugt genau einen Benachrichtigungsjob pro Note; ein Cron-Worker verschickt idempotent E-Mail (Brevo, eigenes Double-Opt-in) und Telegram (neuer öffentlicher Bot). RSS: öffentlicher Teaser-Feed + privater Voll-Feed pro Mitglied (widerrufbarer Token).
- **KI-Zugang:** persönliche API-Tokens, kleine JSON-API und ein Remote-MCP-Server unter `/mcp` (Streamable HTTP). Details in Abschnitt 9.

## 1. Funde im Repo, die den Plan beeinflussen

| # | Fund | Konsequenz |
|---|------|-----------|
| 1 | `RateLimitBucket` gibt es nur auf dem **nicht gemergten** Branch `codex/security-audit-hardening`. Laut dessen Doku ist die Tabelle in der Production-DB aber schon angelegt. | Eine gleichnamige Tabelle würde beim späteren Merge die Migration brechen. Research bekommt eine eigene Tabelle `ResearchRateLimit` mit identischem Algorithmus (atomarer Upsert, nur Hash des Schlüssels gespeichert). Später zusammenführbar. |
| 2 | `vercel-build` führt `prisma migrate deploy` bei **jedem** Deployment aus, auch bei Previews. | Wenn Previews dieselbe DB wie Production nutzen, würde schon der erste Push meines Branches neue Tabellen in der Production-DB anlegen. **Ich pushe erst, wenn du mir sagst, welche DB Previews nutzen** (siehe Frage 1). |
| 3 | Der E-Mail-Fallback der Mentorship (`getSubscriptionSnapshot`, `createCustomerPortalSession`) sucht Stripe-Customers per E-Mail und kann dabei den USD-Customer eines anderen Produkts erwischen und mit `metadata.userId` markieren. Das betrifft heute schon Raid-Map-Käufer: Ein späterer Mentorship-Checkout scheitert dann am Währungsmix. | Research würde das Risiko vergrößern. Vorschlag: kleiner, getesteter Guard in einem **separaten** Commit/PR (Customers mit `raidmapUserId`/`researchUserId` werden beim E-Mail-Fallback ignoriert). Legitime Mentorship-Kunden sind davon nicht betroffen. Nur mit deinem OK. |
| 4 | Bunny-Videos der Mentorship werden **unsigniert** eingebettet (jeder mit der GUID kann sie abspielen). Token-Auth lässt sich nur pro Library einschalten. | Research bekommt eine **eigene Bunny-Library mit Token-Authentifizierung** (signierte, ablaufende Embed-URLs). Mentorship bleibt unberührt. |
| 5 | `/api/pages/[id]` liefert veröffentlichte Seiteninhalte an jeden eingeloggten Nutzer, ohne Abo-Prüfung. | Research nutzt eigene Routen mit Zugriffsprüfung. Die Mentorship-Lücke melde ich separat (nicht Teil dieses PRs). |
| 6 | Kein Kündigungsbutton nach § 312k BGB gefunden. | Für Research eingeplant (öffentliche Seite „Cancel contracts here“). Ob die bestehenden Abos das auch brauchen, gehört auf die Liste für den Anwalt. |
| 7 | Die Crons `paypal-sync` und `tradingview-claims` akzeptieren `Bearer undefined`, falls `CRON_SECRET` fehlt. | Neue Research-Crons nutzen die timing-sichere, fail-closed Prüfung aus `mentorship-announcements`. Die alten melde ich separat. |
| 8 | Das Root-Layout rendert immer die deutsche Navbar, den Footer, das Cookie-Banner und `lang="de"`. Den Root-Layout dynamisch zu machen, würde die ganze Seite langsamer machen. | Research blendet Navbar und Footer per Server-Marker aus (wie `data-hide-root-footer` in der Mentorship). Dafür gibt es eine minimale Änderung an der Navbar (ID + Guard). Auf `research.*` laufen kein Google-Tag und kein Clarity, nur cookielose Vercel Analytics, also kein Cookie-Banner. Englisch kommt über `lang="en"` am Research-Wrapper und die englische Clerk-Lokalisierung. |

## 2. Architektur und Routing

```
research.price-action-trader.de/…        ──middleware (Host)──▶  app/research/…          (Seiten, Feeds)
research.price-action-trader.de/mcp      ──rewrite──▶           app/api/research/mcp     (MCP)
research.price-action-trader.de/api/v1/… ──rewrite──▶           app/api/research/v1/…    (JSON-API)
www.price-action-trader.de/research/…    ──308──▶               research.price-action-trader.de/…  (nur Production)
Preview/Local:  <preview-url>/research/…  (Pfad-Modus, weil Previews keine Subdomains haben)
Stripe-Webhook bleibt:   www…/api/webhooks/stripe  (bestehender Endpoint, neuer Zweig)
```

- **Middleware:** ein kleiner Aufruf `routeResearchHost(req)` aus `lib/research/routing.mjs` (reine Funktion, per Unit-Test abgedeckt). Für den Haupt-Host ändert sich nichts.
  - Next 16 hat `middleware.ts` in `proxy.ts` umbenannt; die alte Datei funktioniert noch, gilt aber als veraltet.
  - Die Umbenennung macht bereits der Security-Branch. Ich benenne deshalb **nicht** um, sondern halte den Diff in `middleware.ts` bei ein paar Zeilen, damit ein späterer Merge einfach bleibt.
- **Basis-Pfad:** Links laufen über `researchHref()`. Auf der Subdomain ist der Präfix `""`, im Pfad-Modus `/research`. So funktionieren Previews ohne Subdomain.
  - `usePathname()` liefert im Browser den sichtbaren Pfad (ohne `/research`). Aktive Navigation vergleicht daher immer über denselben Helper.
- **Clerk:** gleiche Production-Instanz und damit geteilte Konten.
  - Laut Clerk-Doku funktionieren Subdomains derselben Root-Domain ohne Satellite-Setup. Beim ersten Aufruf gibt es einen kurzen Handshake-Redirect über `clerk.price-action-trader.de`.
  - `authorizedParties` setze ich vorerst **nicht**. Es gilt für alle Hosts, auch für Preview-URLs und localhost, und eine unvollständige Liste würde Logins brechen. Es wird zum Go-live mit der finalen Hostliste nachgeholt.
  - Sign-in und Sign-up laufen auf der Subdomain (englisch, `/sign-in`), mit Rücksprung zur aufgerufenen Seite.
- **Testumgebung:** Previews nutzen die Clerk-**Test**instanz, die auch auf `*.vercel.app` funktioniert, also keine echten Kundenkonten. Research läuft dort im Pfad-Modus unter `/research`. Eine Staging-Subdomain (`RESEARCH_EXTRA_HOSTS`) ist optional, um das Host-Routing vor dem Go-live zu testen.
- **Code-Ablage:**
  - Seiten und Routen in `app/research/**` und `app/api/research/**`
  - Logik in `lib/research/**`, UI in `components/research/**`
  - riskante Logik (Zugang, Routing, Fan-out, Tokens, Feeds, Markdown) als reine `.mjs`-Module mit `node --test`, nach dem Muster der Announcement-Queue
- **Performance:** öffentliche Teaser-Seiten werden gecacht (HTML pro `updatedAt`, wie `page-viewer`). Mitgliederseiten sind dynamisch.

## 3. Datenmodell (neue Prisma-Modelle, nur additive Migrationen)

| Modell | Zweck (Kernfelder) |
|--------|---------------------|
| `ResearchSubscription` | Klon von `RaidMapSubscription` plus Härtung: `userId @unique`, `stripeCustomerId`, `stripeSubscriptionId @unique`, `status`, `tier` (`reader`/`member`/`supporter`), `interval`, `priceId`, `cancelAtPeriodEnd`, `currentPeriodEnd`, `pastDueSince` |
| `ResearchMember` | Profil und Einstellungen: `displayName` (für Kommentare, kein Klarname nötig), Supporter-Credit (Opt-in + Name, nur 15 $), E-Mail-Benachrichtigung (`none/pending/confirmed/unsubscribed` + Zeitstempel), Telegram (`chatId @unique`, verknüpft seit), RSS-Token-Hash, Kommentar-Sperre |
| `ResearchConsentEvent` | Nachweis-Log: AGB-Annahme, Widerrufsverzicht, E-Mail-Opt-in angefragt/bestätigt/abgemeldet, Kündigungserklärung – jeweils mit Textversion und Zeitstempel |
| `ResearchTopic` | Bibliothek: `slug`, `name`, `description`, `sortOrder` (Time, Model 2022, HTF-SFP/Kyle, TGIF, …) |
| `ResearchNote` | `slug @unique`, `title`, `summary` (öffentlich), `content Json` (Tiptap), `contentText` (für Suche/API), `label` (`tested`/`in_progress`/`ict_teaching`), `access` (`free`/`members`), `state` (`draft`/`scheduled`/`published`/`archived`), `publishAt`, `publishedAt`, `studyMeta Json?` (Instrument, Zeitraum, Stichprobe, Kennzahlen, Fazit), `coverImageUrl`, Video-GUIDs, `notify` |
| `ResearchNoteTopic` | n:m Note ↔ Topic |
| `ResearchComment` | `noteId`, `userId`, `parentId?` (eine Antwort-Ebene), `body` (Klartext, max. 2.000 Zeichen), `status` (`visible`/`hidden`/`deleted`), Moderationsfelder, `editedAt` |
| `ResearchCommentReport` | `commentId`, `reporterId`, `reason`, `resolvedAt`; unique pro Melder und Kommentar |
| `ResearchVoteRound` / `ResearchVoteOption` / `ResearchVoteBallot` | monatliche Runde (`month @unique`, `opensAt`, `closesAt`, `status`); Optionen; eine Stimme pro Mitglied und Runde (änderbar bis Schluss), später verknüpft mit der entstandenen Note |
| `ResearchNotificationJob` | Outbox: ein Job pro Note und Art (`@@unique([noteId, kind])`), damit ein Publish nie doppelt auslöst |
| `ResearchDelivery` | eine Zeile pro Job × Nutzer × Kanal (`@@unique`), Status `pending/sending/sent/failed/skipped`, Versuche, `nextAttemptAt`, Lease, Provider-ID |
| `ResearchTelegramLinkCode` | Einmal-Code (nur Hash), 15 min gültig |
| `ResearchApiToken` | `userId`, `name`, `prefix`, `tokenHash @unique` (SHA-256), `lastUsedAt`, `revokedAt`; max. 5 aktive pro Person |
| `ResearchApiLog` | minimales Zugriffslog für API und MCP (Token-ID, Tool/Endpoint, Status, Zeit); nach 90 Tagen gelöscht |
| `ResearchRateLimit` | siehe Fund 1 |
| `ResearchCancellationRequest` | Eingänge des Kündigungsbuttons |

Suche: Postgres-Volltext (`websearch_to_tsquery('english', …)` über Titel, Summary und `contentText`, Ranking per `ts_rank`). Für den Bestand an Notes (Dutzende bis wenige Tausend) reicht das ohne Zusatzindex und ohne Migrationstricks.

## 4. Seiten und Routen (englisch)

**Öffentlich (auch ohne Login):**
- Landing: Nutzen, Beispiel-Notes, Preise „pay what you can“, FAQ
- Teaser-Seiten jeder Note (Titel, Summary, Label, Topics, Datum; Paywall-Box). Mit SEO-Markup für Paywall-Inhalte, damit X-Follower über Google und Links einsteigen.
- Freie Notes in voller Länge
- `/pricing` mit Checkout
- `/feed.xml` (Teaser-RSS)
- `/terms`, `/privacy`, `/cancel` (Kündigungsbutton)

**Mitglieder:**
- `/` als Feed (neueste Notes, Filter nach Label und Topic, Banner zur laufenden Abstimmung)
- `/library` und `/library/[topic]`
- `/notes/[slug]`: Inhalt, Videos, Study-Box mit Kennzahlen, Kommentare
- `/search`
- `/vote`
- `/account`: Abo und Portal, Benachrichtigungen, RSS-URL, Telegram verknüpfen/lösen, API-Tokens, MCP-Anleitung, Anzeigename, Supporter-Credit
- `/welcome` nach dem Checkout: synchronisiert das Abo sofort, ohne auf den Webhook zu warten, und führt durch die Einrichtung der Kanäle

**Admin (nur `org:admin`, deutsch beschriftet, im Research-Look):** `/admin/notes`, `/admin/topics`, `/admin/comments`, `/admin/votes`, `/admin/members`, `/admin/notifications`, `/admin/setup` (Env-Check, Telegram-Webhook registrieren, Stripe-Portal-Konfiguration prüfen).

## 5. Zahlungen (Raid-Map-Muster)

- **Stripe:** ein Produkt „PAT Research“, drei monatliche USD-Preise (7/10/15). Optional drei Jahrespreise (Frage 2). Price-IDs nur über Env-Vars. Empfehlung: `tax_behavior = inclusive`, damit 7/10/15 für EU-Verbraucher der Endpreis ist (PAngV). Das klärt der Steuerberater (Abschnitt 11).
- **Checkout** `POST /api/research/checkout`:
  1. Clerk-Login ist Pflicht.
  2. Server-seitige Pflichtprüfung von AGB-Annahme und Widerrufsverzicht, die vorher auf unserer Pricing-Seite als Checkboxen abgefragt werden, jeweils protokolliert als `ResearchConsentEvent`.
  3. Eigener Customer (`metadata.researchUserId`).
  4. Session mit `mode: subscription`, `automatic_tax`, Rechnungsadresse und Promo-Codes, `metadata: {userId, product: 'research', tier, consentId}`.
  5. Englische Texte an Stripe über `custom_text`. Kein Trial (Empfehlung, Frage 3).
- **Webhook:** im bestehenden Handler je ein `if (metadata.product === 'research')` neben den Raid-Map-Zweigen (subscription created/updated/deleted, checkout completed, invoice paid/failed).
  - Der Zweig holt die Subscription **frisch von Stripe**. Damit spielt die Reihenfolge der Events keine Rolle.
  - Zahlungen meldet er an deinen internen Telegram-Alarm-Bot (`sendCortanaTelegram`). Das ist dessen Zweck; Mitglieder bekommen darüber nie Nachrichten.
- **Portal** `POST /api/research/portal`: eigene Portal-Konfiguration (`STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID`).
  - Wechsel zwischen den drei Preisen mit `proration_behavior: none`: Der neue Preis gilt ab der nächsten Abrechnung. Das ist fair für „pay what you can“, und es entstehen keine Subscription-Schedules, die zusätzliche Sonderfälle bringen würden.
  - Kündigung zum Periodenende, Zahlungsmethode, Rechnungen.
  - Der Webhook bleibt auf der gepinnten API-Version `2024-10-28.acacia` (wie das SDK). Doppelte Events erkennt er an der Event-ID.
- **Zugang:**
  - `active`/`trialing` bis `currentPeriodEnd`
  - `past_due` 72 h ab `pastDueSince`
  - alles andere: kein Zugang

  Der Zugang wird bei **jeder** Anfrage geprüft, auch bei API, MCP, RSS und Telegram-Befehlen.
- **Dev-Test-Modus** wie bei der Raid Map (`RESEARCH_TEST_MODE`, doppelt abgesichert, in Production immer aus).

## 6. Inhalte und Editor

- **Editor:** Tiptap mit denselben Extensions wie der Page-Editor. Dazu kommen zwei eigene Nodes:
  - „Bunny-Video“: Upload per tus in die Research-Library, Wiedergabe mit signierter, ablaufender Embed-URL
  - „Callout“: z. B. „Result“, „Not tested yet“

  Autosave und Speicher-Queue übernehme ich vom Page-Editor. Den bestehenden Page-Editor ändere ich nicht; gemeinsame Teile ziehe ich nur heraus, wenn sie getestet sind.
- **Bilder und Charts:** Vercel-Blob-Upload wie bei `page-image-upload`, zusätzlich mit Größenlimit und festem Pfad `research/<noteId>/…`. Die Bilder liegen öffentlich unter nicht erratbaren URLs (Zufallssuffix), damit sie in RSS, E-Mail und `next/image` funktionieren. Die Notes selbst sind geschützt. Die bezahlte Substanz ist so geschützt wie beim Screenshot-Risiko auch.
- **Sicherheit beim Speichern:**
  - Tiptap-JSON wird server-seitig gegen eine Allow-List validiert.
  - Link-Schemata sind auf http/https/mailto beschränkt, Bildquellen auf den Blob-Host.
  - Daraus entstehen `contentText` (Suche) und Markdown (API, MCP, voller RSS-Feed).
- **Status, Label und Planung:**
  - Das Label zeigt Tested / In progress / ICT teaching – not tested.
  - `free`/`members` legt fest, wer die Note sieht.
  - Mit `publishAt` wird eine Note geplant. Sie ist ab diesem Zeitpunkt sichtbar, ohne auf den Cron zu warten.
  - Beim Veröffentlichen gibt es die Checkbox „Mitglieder benachrichtigen“. Korrekturen verschickst du damit bewusst nicht erneut.
- **Vorschau:** „als Mitglied“ und „als Besucher“.

## 7. Austausch

- **Kommentare** (nur aktive Mitglieder, auch lesen):
  - Anzeigename statt Klarname, eine Antwort-Ebene
  - eigene Kommentare 15 min bearbeitbar, löschen jederzeit
  - Klartext mit Auto-Links (`nofollow ugc`)
  - Rate-Limits: 5 pro 10 min, 30 pro Tag
- **Melden:** mit Grund. Ab 3 Meldungen wird ein Kommentar automatisch ausgeblendet, bis du ihn prüfst, und du bekommst eine Nachricht über den Alarm-Bot.
- **Moderation:** ausblenden/einblenden mit Grund, löschen, Nutzer für Kommentare sperren (befristet oder dauerhaft).
- **Abstimmung:**
  - Du legst die Monatsrunde mit 3–6 Optionen an und öffnest bzw. schließt sie.
  - Jedes Mitglied hat eine Stimme und kann sie bis Rundenende ändern.
  - Ergebnisse sehen Mitglieder nach eigener Stimme, du jederzeit.
  - Der Gewinner wird später mit der fertigen Note verlinkt.

## 8. Benachrichtigungen (Fan-out)

1. **Auslöser:** „Publish now“ oder Erreichen von `publishAt` legt einen `ResearchNotificationJob` an (unique pro Note, also idempotent). Geprüft wird über den Cron `*/5` und zusätzlich sofort per `after()` beim Publish.
2. **Empfängerliste:** per `createMany … skipDuplicates` aus den aktiven Mitgliedern mit aktiviertem und bestätigtem Kanal.
3. **Worker** `/api/cron/research-dispatch`:
   - Er übernimmt Zustellungen per Lease (`FOR UPDATE SKIP LOCKED`).
   - Er verschickt, markiert als `sent` und plant Fehler mit Backoff neu ein (max. 5 Versuche).
   - Ein Abbruch mitten im Lauf erzeugt schlimmstenfalls eine einzelne doppelte Nachricht, nie einen Sammelversand.
4. **E-Mail (Brevo):**
   - Eigenes Double-Opt-in: Checkbox mit Einwilligungstext, dann Bestätigungsmail mit signiertem Link, dann `confirmed` plus Log-Eintrag.
   - Versand über die Transaktions-API in Batches (`messageVersions`, bis 99 Empfänger pro Version und 2.000 pro Aufruf).
   - Jede Mail hat einen Abmeldelink sowie `List-Unsubscribe` und `List-Unsubscribe-Post` (One-Click).
   - Eigene Absenderadresse nur für Benachrichtigungen: Eine Abmeldung bei Brevo sperrt den Absender, und Rechnungs- oder Kontomails sollen davon nicht betroffen sein.
   - Brevo-Sperrlisten werden regelmäßig abgeglichen.
   - Vertragsmails (Willkommen mit Vertragsbestätigung und Verzichtserklärung, Kündigungsbestätigung) laufen ohne Opt-in, weil sie Vertragspflicht sind.
5. **Telegram:**
   - Du legst einen neuen Bot über @BotFather an und hinterlegst den Token als Env-Var.
   - Verknüpfen: Das Konto erzeugt einen Einmal-Code, der Link `t.me/<bot>?start=<code>` öffnet den Bot, der Webhook (per Secret-Header geprüft) speichert die `chat_id`.
   - Befehle: `/latest`, `/stop`, `/help`. Lösen geht auch im Konto.
   - Blockiert jemand den Bot (Telegram meldet `my_chat_member: kicked` oder 403), wird die Verknüpfung automatisch gelöst.
   - Nachricht: Titel, Label, Summary, Link. Der Volltext bleibt auf der Plattform.
   - Versand gedrosselt auf unter 25 Nachrichten pro Sekunde, `retry_after` wird beachtet.
6. **RSS:**
   - `/feed.xml` enthält nur Teaser.
   - `/feed/<token>.xml` enthält den Volltext für Mitglieder. Die URL steht im Konto und lässt sich neu erzeugen, wodurch die alte ungültig wird. Bei inaktivem Abo zeigt der Feed nur einen Hinweis-Eintrag.
7. **Admin:** Vorschau (E-Mail-HTML und Telegram-Text), Testversand an dich, Zustellstatistik pro Note und Kanal, fehlgeschlagene Zustellungen erneut versuchen.

## 9. KI-Zugang (API und MCP)

- **Persönliche API-Tokens** (`patr_…`, 256 Bit):
  - Sie werden einmal angezeigt und nur als Hash gespeichert.
  - Sie funktionieren nur bei aktivem Abo.
  - Rate-Limit (Vorschlag): 60 Anfragen pro Minute, 2.000 pro Tag.
- **JSON-API** `https://research…/api/v1/`:
  - `notes?limit&cursor&topic&label`
  - `notes/{id|slug}`
  - `search?q`
  - `topics`

  Die Inhalte kommen als Markdown mit Metadaten und Lizenzhinweis („personal use only“).
- **MCP-Server** `https://research…/mcp`:
  - Streamable HTTP, zustandslos, nur lesend (`readOnlyHint`).
  - Tools: `list_latest_notes`, `get_note`, `search_notes`, `list_topics`, `get_study_summary` (liest `studyMeta`).
  - Stand der Doku (geprüft 25.09.2026):
    - Die aktuelle MCP-Spec ist `2026-07-28`.
    - Das SDK v2 (`@modelcontextprotocol/server` 2.1.0) bedient auch ältere 2025-Clients.
    - Vercels Next.js-Adapter ist `mcp-handler` 2.2.0 und braucht kein Redis mehr.
  - Beide Pakete brauchen **zod 4**, die App nutzt zod 3.23. Lösung ohne Risiko für den Rest der App: zod 4 als Alias `zod4` nur für den MCP-Code. `@clerk/mcp-tools` ist mit unserem Clerk v6 inkompatibel, die ca. 10 Zeilen Token-Prüfung schreibe ich selbst.
  - Origin-Prüfung, Rate-Limit pro Person, Größenlimits für Antworten, Zugriffslog.
  - Bei inaktivem Abo liefern die Tools eine klare Fehlermeldung statt eines 401. Ein 401 würde OAuth-Clients in eine Login-Schleife schicken.
- **Zwei Anmeldewege für die KI:**
  1. **Persönlicher Token** (Header `Authorization: Bearer patr_…`) für Claude Code, Codex, eigene Skripte und die JSON-API. Das funktioniert sofort und ohne Clerk-Änderung.
  2. **OAuth über Clerk** für Custom Connectors in claude.ai, Claude Desktop und ChatGPT.
     - Diese Oberflächen akzeptieren keine persönlichen Header-Tokens, nur OAuth.
     - Voraussetzungen: `/.well-known/oauth-protected-resource/mcp` sowie in Clerk aktivierte „Client ID Metadata Documents“ und/oder „Dynamic Client Registration“ mit PKCE (S256). Die Einstellungen setzt du selbst im Clerk-Dashboard.
     - Restrisiko: Clerk kann Tokens noch nicht an die Zielressource binden (Audience-Prüfung ist dort erst als Entwurf in Arbeit). Da auf eurer Clerk-Instanz keine andere OAuth-API läuft, ist das Risiko klein. Die Prüfung wird nachgerüstet, sobald Clerk sie liefert.
- **Anleitung im Konto:**
  - Claude Code: `claude mcp add --transport http --scope user pat-research https://research…/mcp --header "Authorization: Bearer …"` oder OAuth über `/mcp`
  - Codex: `~/.codex/config.toml` mit `bearer_token_env_var` oder `codex mcp login`
  - claude.ai und Claude Desktop: Settings → Connectors → Add custom connector
  - ChatGPT: Developer Mode
  - curl-Beispiele

## 10. Admin für dich

Siehe Routen in Abschnitt 4.
- **Mitgliederliste:** E-Mail aus Clerk, Tier, Status, seit wann, Periodenende, aktive Kanäle, Supporter-Credit, Kommentar-Sperre.
- **Export der Supporter-Credits** (nur Opt-ins) für Video-Abspänne.

## 11. Recht und Steuern (Entwürfe für Anwalt und Steuerberater, keine Rechtsberatung)

- **Terms of Service (EN):**
  - Rechte bleiben bei PAT.
  - Du darfst Teile als X-Posts und YouTube-Videos auf Deutsch und Englisch weiterverwenden.
  - Zugang persönlich und nicht übertragbar.
  - Keine Weitergabe, auch nicht über KI-Tools oder geteilte Tokens.
  - Bildungsinhalt, keine Anlageberatung, keine Handelssignale.
  - Laufzeit und Kündigung, Preisänderungen, Haftung.
- **Checkout-Consent:**
  - Eigene, nicht vorangekreuzte Checkbox für sofortigen Zugang und Kenntnis vom Verlust des Widerrufsrechts (§ 356 BGB, digitale Inhalte; die Formulierung deckt auch die Dienstleistungs-Variante ab).
  - Stripe bietet dafür keine zweite native Checkbox, deshalb läuft sie auf unserer Seite vor dem Redirect. Die AGB-Checkbox von Stripe zeigt zusätzlich einen englischen Text mit Link auf die Research-Terms.
  - Bestätigung auf dauerhaftem Datenträger (§ 312f BGB) per Willkommensmail.
  - Ob Research-Notes als „digitale Inhalte“ oder als „Dienstleistung“ gelten, klärt der Anwalt. Bei einer Dienstleistung erlischt das Widerrufsrecht erst mit vollständiger Erfüllung, und es gilt anteiliger Wertersatz.
- **Widerrufsbutton (§ 356a BGB, neu seit 19.06.2026):**
  - Eine Funktion „Withdraw from contract“ („Vertrag widerrufen“), während der Widerrufsfrist ständig verfügbar.
  - Sie fragt Name, Vertrag und Kontakt ab, dann „Confirm withdrawal“, dann eine sofortige Eingangsbestätigung mit Datum und Uhrzeit.
  - Ich baue sie mit ein. Ob sie nach wirksamem Verzicht noch nötig ist, entscheidet der Anwalt.
- **Kündigungsbutton (§ 312k BGB):**
  - Öffentliche Seite ohne Login.
  - Nach dem Absenden bekommt die Person sofort eine Bestätigungsmail.
  - Passt die E-Mail eindeutig zu einem aktiven Abo, wird es automatisch zum Periodenende gekündigt; du wirst benachrichtigt.
- **Privacy-Addendum (EN):**
  - Dienste: Stripe, Clerk, Brevo, Telegram, Bunny, Vercel (Hosting, Blob, Analytics).
  - API- und MCP-Logs mit 90 Tagen Aufbewahrung, Kommentare, Abstimmungen.
  - Rechtsgrundlagen und Speicherdauern.
- **E-Mail-Consent-Text** mit Versionierung.
- **Umsatzsteuer:**
  - EU-Verbraucher: Steuer des Kundenlandes über OSS (Stripe Tax rechnet).
  - Nicht-EU (z. B. UK, CH, NO, AU, US-Bundesstaaten) hat eigene Registrierungsregeln und muss mit deinem Steuerberater geklärt werden.
  - Stripe Tax nutzt ihr bereits (`automatic_tax`); die Registrierungen prüft der Steuerberater.

## 12. Sicherheit (Querschnitt)

- **Zugriff:** eine zentrale Funktion `getResearchViewer()` liefert `userId`, Admin-Status und Zugang. Sie wird in jeder Seite und Route aufgerufen, mit Test-Matrix (anonym, frei, Mitglied, past_due, gekündigt, Admin) × Seiten, API, MCP, RSS und Videos.
- **Tokens:** API-, RSS- und Telegram-Codes nur als Hash gespeichert, widerrufbar, timing-sicherer Vergleich.
- **Webhooks und Crons:**
  - Stripe-Signatur wie bisher.
  - Telegram-Secret-Header.
  - `CRON_SECRET` fail-closed.
- **Eingaben:**
  - Zod an allen Grenzen.
  - Kommentare nur Klartext.
  - Tiptap-JSON über Allow-List.
  - Origin-Prüfung bei POST-Routen.
- **Header:** Security-Header nur für die Research-Pfade (Frame-Deny, nosniff, Referrer-Policy).
- **Logs:** Keine Secrets oder Klar-E-Mails in Logs.

## 13. Phasen (jede mit Tests, Self-Review und Bericht an dich)

| Phase | Inhalt | Ergebnis |
|-------|--------|----------|
| a | Datenmodell, Subscription, Checkout, Portal, Webhook-Zweig, Zugang, Routing | Kauf im Stripe-Testmodus schaltet Zugang frei; Mentorship- und Raid-Map-Verhalten unverändert (Regressionstests) |
| b | Notes, Editor, Topics, Feed, Bibliothek, Note-Seite, Suche, Landing, Free-Tier | Du kannst Notes schreiben, planen, veröffentlichen; Besucher sehen Teaser |
| c | Kommentare, Melden, Moderation, Abstimmung | |
| d | E-Mail (DOI), RSS, Telegram-Bot, Outbox-Worker, Admin-Vorschau | |
| e | API-Tokens, JSON-API, MCP-Server (Token-Auth), Anleitungen; danach OAuth über Clerk | Verbindung aus Claude Code und Codex live getestet; claude.ai-Connector nach Clerk-Freischaltung |
| f | Rechtstexte, Checkout-Consent, Kündigungsbutton, Privacy | Entwürfe klar als „Draft – for legal review“ markiert |
| g | E2E-QA im Testmodus auf Preview, Barrierefreiheit, Mobile, Hell/Dunkel | PR mit Prüfprotokoll; nichts geht live ohne dein Go |

## 14. Testplan

- **Unit** (`node --test`):
  - Zugangsregeln
  - Host-Routing
  - Tiptap-Validierung, Markdown und Text
  - RSS-XML mit Escaping
  - Telegram-Parsing und HTML-Escaping
  - signierte Links (Abmelden, DOI)
  - Rate-Limit
  - Fan-out-Auswahl und Zustellzustände
  - Kommentar- und Moderationsregeln
  - Abstimmungsregeln
  - MCP-Tool-Ein- und -Ausgaben
  - Token-Hashing
- **Integration** gegen eine lokale Wegwerf-Postgres-17-Instanz im Scratchpad, nie gegen Production:
  - Migrationen von null
  - Drift-Check
  - parallele Worker (keine Doppelzustellung)
  - Unique-Constraints
  - Rate-Limit-SQL
- **Stripe-Testmodus:**
  - Testkarten für Erfolg, 3-D-Secure und fehlschlagende Verlängerung (`past_due`)
  - Upgrade und Downgrade im Portal
  - Kündigung
  - Webhook-Reihenfolge
- **E2E im Preview:**
  - Registrierung, Checkout, Willkommen, Lesen
  - Kommentar, Meldung, Moderation, Abstimmung
  - DOI-Mail, Telegram (Test-Bot), RSS-Reader
  - API per curl, MCP per Claude Code und MCP Inspector
- **Regression:**
  - `npm test`, `typecheck`, `lint`, `build`
  - Routing-Tests belegen, dass der Haupt-Host unverändert ist
  - Webhook-Routing-Test für Nicht-Research-Events

## 15. Was du tun musst (keine Secrets an mich; alles trägst du selbst ein)

1. **Fragen unten beantworten.**
2. **Connectoren:** Stripe und Vercel autorisieren, in claude.ai unter Einstellungen → Connectors oder in einer interaktiven Claude-Code-Sitzung mit `/mcp`. GitHub-MCP schlägt gerade fehl; `gh` funktioniert, der PR ist also möglich.
3. **Preview-Umgebung:** Welche `DATABASE_URL` und welche Stripe-Keys nutzen Previews? Empfehlung:
   - Branch-spezifische Preview-Env-Vars für `feat/pat-research-platform` (Vercel → Settings → Environment Variables → Preview → Branch).
   - Dazu eine separate DB (z. B. ein DB-Branch oder eine Kopie) und Stripe-**Test**-Keys.
4. **Stripe (Testmodus zuerst):**
   - Produkt, Preise und Portal-Konfiguration lege ich nach deiner Bestätigung über den Stripe-Connector im Testmodus an (oder du führst ein Skript aus, das ich schreibe).
   - Einen Test-Webhook-Endpoint für die Preview richtest du ein, dessen Secret trägst du ein.
   - Stripe Tax muss aktiv sein und die passenden Registrierungen haben (DE, OSS). Das klärt der Steuerberater; ohne Registrierung berechnet Stripe dort 0 Steuer.
   - Live erst nach deinem Go.
5. **Telegram:**
   - `/newbot` bei @BotFather (Name „PAT Research“, Username z. B. `PATResearchBot`), Beschreibung und Bild setzen.
   - Den Token als `RESEARCH_TELEGRAM_BOT_TOKEN` in Vercel eintragen.
   - Empfohlen: ein zweiter Test-Bot für die Preview.
6. **Bunny:** neue Stream-Library „PAT Research“ mit aktivierter „Embed view token authentication“, Werte als Env-Vars eintragen.
7. **Brevo:**
   - Absender und Domain (SPF, DKIM, DMARC) prüfen.
   - Tarif auf das Versandvolumen prüfen (Mitglieder × Notes pro Monat).
   - Der bestehende `BREVO_API_KEY` kann weiterverwendet werden.
8. **Clerk:**
   - Falls ihr eine Subdomain-Allowlist nutzt, `research` ergänzen.
   - Für die OAuth-Variante in Phase e unter OAuth applications → Settings „Client ID Metadata Documents“ und „Dynamic Client Registration“ mit PKCE S256 aktivieren. Ich liefere dafür eine Klick-Anleitung.
9. **DNS (erst zum Go-live):**
   - `research.price-action-trader.de` in Vercel → Project → Settings → Domains hinzufügen.
   - Den angezeigten CNAME beim DNS-Anbieter setzen.
10. **Anwalt und Steuerberater:** Entwürfe aus Phase f.

**Env-Vars (nur Namen):**
- Stripe:
  - `STRIPE_RESEARCH_PRODUCT_ID`
  - `STRIPE_PRICE_ID_RESEARCH_{READER|MEMBER|SUPPORTER}_{MONTHLY|ANNUAL}` (6 Preise)
  - `STRIPE_RESEARCH_PORTAL_CONFIGURATION_ID`
  - optional `RESEARCH_STRIPE_AUTOMATIC_TAX=0` (nur falls Stripe Tax in einer Testumgebung nicht aktiv ist)
- Research allgemein:
  - `RESEARCH_PUBLIC_HOST`: Kill-Switch. Ist die Variable in Production nicht gesetzt, ist Research dort komplett aus, auch die APIs.
  - `RESEARCH_EXTRA_HOSTS`: z. B. eine Staging-Domain
  - `RESEARCH_SIGNING_SECRET`
  - `RESEARCH_EMAIL_FROM`
- Telegram:
  - `RESEARCH_TELEGRAM_BOT_TOKEN`
  - `RESEARCH_TELEGRAM_BOT_USERNAME`
  - `RESEARCH_TELEGRAM_WEBHOOK_SECRET`
- Bunny:
  - `BUNNY_RESEARCH_LIBRARY_ID`
  - `BUNNY_RESEARCH_API_KEY`
  - `BUNNY_RESEARCH_TOKEN_KEY`
- Bestehende werden mitgenutzt: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BREVO_API_KEY`, `CRON_SECRET`, `BLOB_READ_WRITE_TOKEN`, Clerk.
- Testumgebung: siehe `docs/research/TEST_ENVIRONMENT.md`.

## 16. Neue Abhängigkeiten (minimal)

- `mcp-handler@2.2.0`, `@modelcontextprotocol/server@2.1.0` und `zod4` (npm-Alias auf zod 4, nur für MCP).
- Keine SDKs für Brevo und Telegram und keine RSS-Bibliothek: schlanke `fetch`-Clients und selbst erzeugtes XML, alles getestet.

## 17. Entscheidungen (25.09.2026, Antworten über Codex/Astra)

1. **Previews:**
   - Ausgangslage heute: Previews nutzen eine eigene Prisma-Postgres-DB, Stripe-Testkeys und die Clerk-Testinstanz. Branch-Overrides für Research gibt es noch keine. Ob Production wirklich eine andere DB nutzt, ist noch nicht bestätigt.
   - **Vor dem ersten Push** muss die Research-Testumgebung nachweislich isoliert sein: eigene Test-DB, Branch-Env-Vars, Stripe-Testkeys mit eigenem Test-Webhook, sowie E-Mail, Discord und Blob isoliert oder deaktiviert.
   - Bis dahin wird nur lokal gearbeitet. Anleitung: `docs/research/TEST_ENVIRONMENT.md`.
2. **Jahresabo:** ja, optional neben dem Monatsabo. 70 / 100 / 150 USD pro Jahr, der Jahres-Gesamtpreis wird deutlich angezeigt.
3. **Kein Trial.**
4. **Stufen:** Reader 7 $, Member 10 $ (empfohlen), Supporter 15 $.
   - Deutlich sichtbarer Hinweis: gleicher Zugang in allen Stufen.
   - Nennung im Abspann nur für Supporter: separates Opt-in, selbst gewählter Name, standardmäßig aus.
5. **Bunny:** eigene Research-Library mit signierten, ablaufenden Zugriffen. Auch direkte Wiedergabewege werden abgesichert, die Mentorship-Library bleibt unverändert.
6. **KI-Zugang:**
   - Zuerst persönliche, widerrufbare Tokens.
   - OAuth (claude.ai-Connector) folgt im zweiten Schritt. Freigabe erst, wenn nachweislich geprüft ist, dass ein Token für den Research-Server ausgestellt wurde (Audience). Der Clerk-Fix vom 22.09.2026 muss dafür in der eingesetzten SDK-Version geprüft werden.
7. **Fund 3:** eigener kleiner PR mit Regressionstests. Bestehende Fehlzuordnungen werden nicht automatisch verändert.
8. **Phase a freigegeben unter Bedingungen:**
   - lokal beginnen
   - Preview-Push erst mit isolierter Testumgebung
   - Kauf, Webhooks, Kündigung und Zugang im Testmodus nachweisen
   - Regressionstests für Mentorship und Raid Map
   - Produktionsmigrationen und Livegang sind eine separate Freigabe

## 18. Neue Funde während Phase a

- **Die Migrationshistorie lässt sich nicht auf einer leeren DB abspielen.** Die Tabelle `Page` wurde nie per Migration angelegt; `20260521153000_add_mentorship_performance_indexes` scheitert deshalb auf einer frischen DB.
  - Eine neue Test-DB braucht einen Bootstrap: Schema von `main` einspielen, die bestehenden Migrationen als angewendet markieren, danach laufen die Research-Migrationen normal.
  - Das Skript dafür ist `scripts/research-bootstrap-test-db.mjs`.
