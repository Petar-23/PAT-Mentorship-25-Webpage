# Security Operations

Dieses Runbook beschreibt die externen Schritte, die nicht allein durch einen Code-Deploy erledigt werden können. Keine Secrets in Tickets, Logs oder Chat kopieren.

## Rollout-Status 2026-07-10

Bereits erledigt:

- Pre-Migration-Backup erstellt und geprüft; Migration `20260710120000_security_entitlement_lifecycle` auf Production angewendet und verifiziert.
- Production-Runtime auf den gepoolten Prisma-Postgres-Endpunkt umgestellt.
- Privaten Blob-Store `pat-private-pdfs` angelegt und ausschließlich mit Production als `BLOB_PRIVATE_READ_WRITE_TOKEN` verbunden.
- `CLERK_ADMIN_ORGANIZATION_ID`, getrennte `CRON_SECRET`/`AGENT_UPLOAD_TOKEN`, `TRADINGVIEW_COOKIE_ENCRYPTION_KEY`, Playback-TTL und das deaktivierte Legacy-Migrationsflag in Production gesetzt.
- `NEXT_PUBLIC_BUNNY_API_KEY` aus Vercel und den lokalen Environment-Dateien entfernt.

Noch vor dem Alias-Cutover erforderlich:

- Den ehemals öffentlich exponierten Bunny Stream API Key rotieren und den neuen Wert ausschließlich als `BUNNY_API_KEY` setzen.
- Bunny Embed-Key, Read-Only-Webhook-Key, Webhook-URL und die notwendigen Production-/Candidate-Referrer vorbereiten. Player Token Authentication, `BlockNoneReferrer` und die Direct-Play-Sperre erst nach dem Aliaswechsel und einem erfolgreichen Signed-Playback-Test erzwingen; die alte Live-Version verwendet noch unsignierte Embeds.
- In Clerk die selbstständige Erstellung weiterer Organisationen deaktivieren, sofern sie keine Produktfunktion ist.
- Die finalen Production-Environment-Scopes am erzeugten Deployment kontrollieren.

Bewusst nach dem Code-Cutover:

- Bestehende öffentliche PDFs in den privaten Store migrieren und erst nach erfolgreichem Zugriffstest die öffentlichen Originale löschen.
- Die einmalige TradingView-Cookie-Migration kurz aktivieren, verifizieren und sofort wieder deaktivieren.

Verbleibende Provider-Grenze: Prisma Postgres erlaubt in der eingesetzten verwalteten Umgebung keine frei angelegte zweite Rolle. Der Versuch, eine getrennte Runtime-/DDL-Rolle anzulegen, wird providerseitig abgewiesen. Bis zu einer Migration auf einen Provider mit Rollenverwaltung bleibt die Runtime-Rolle deshalb privilegierter als vorgesehen; gepoolter Runtime- und direkter Migrationsendpunkt trennen den Zugriffspfad, nicht die Datenbankidentität.

## Blocker vor dem nächsten Production-Deploy

1. Provider-Logs und Git-History auf konkrete Secret-Expositionen prüfen. Clerk-, Stripe-, PayPal-, Discord- und andere Credentials nur rotieren, wenn ein Leak, ungewöhnliche Provider-Aktivität oder ein sonstiger belastbarer Indikator vorliegt; der Audit hat für diese Keys keinen History-Leak belegt.
2. `NEXT_PUBLIC_BUNNY_API_KEY` aus allen Vercel-Umgebungen und lokalen Dateien entfernen und den betroffenen Bunny-Key zwingend rotieren. Ein API-Key darf niemals ein `NEXT_PUBLIC_`-Präfix tragen.
3. `CLERK_ADMIN_ORGANIZATION_ID` in jeder Umgebung auf die exakte Plattform-Organisation setzen. Fehlt der Wert oder zeigt er auf die falsche Organisation, sperrt der Admin-Check absichtlich fail-closed alle Admin- und Owner-Routen. Die Clerk-Einstellung zur selbstständigen Erstellung neuer Organisationen deaktivieren, sofern sie nicht ausdrücklich als Produktfunktion benötigt wird.
4. Bunny Stream unmittelbar vor dem Candidate-Build vorbereiten:
   - Den exponierten Stream API Key rotieren und den neuen Wert ausschließlich serverseitig setzen. Uploads und Provider-Jobs während dieses kurzen Übergangs pausieren, weil bestehende Deployments den alten Key-Snapshot behalten.
   - `BUNNY_EMBED_TOKEN_KEY` als ausschließlich serverseitiges Secret setzen.
   - `BUNNY_PLAYBACK_TOKEN_TTL_SECONDS=300` verwenden; nur kurzzeitig und nicht über 15 Minuten erhöhen.
   - Production-Domains und die exakten Candidate-Hosts als Allowed Referrers vorbereiten.
   - Den Webhook auf `/api/webhooks/bunny` setzen. Bunny v1 verwendet automatisch den Library **Read-Only API Key** als Signing-Secret; diesen Wert server-only als `BUNNY_WEBHOOK_SIGNING_SECRET` setzen, niemals an Browser/Client ausgeben und nach früherer Public-Exposition rotieren. Ohne Secret antwortet die Route absichtlich fail-closed.
   - Noch nicht Player Token Authentication, `BlockNoneReferrer` oder die Direct-Play/File-Access-Sperre aktivieren. Diese Enforcement-Schalter erst nach dem Aliaswechsel und erfolgreichem Signed-Playback-Test setzen.
5. Einen separaten Vercel-Blob-Store mit Access `Private` anlegen. Der Access-Typ eines bestehenden Stores ist nicht nachträglich änderbar. Dessen Token ausschließlich als `BLOB_PRIVATE_READ_WRITE_TOKEN` setzen. Der bestehende öffentliche Store bleibt nur für öffentliche Bilder.
6. Einen zufälligen 32-Byte-Schlüssel als `TRADINGVIEW_COOKIE_ENCRYPTION_KEY` setzen. Für den bestehenden Plaintext-Datensatz `ALLOW_LEGACY_TRADINGVIEW_COOKIE_MIGRATION=true` nur einmal kurz aktivieren, die Migration über den Admin-Pfad auslösen und verifizieren und das Flag unmittelbar wieder auf `false` setzen.
7. Vor dem Code-Deploy die neue Prisma-Migration über den direkten Migrationsendpunkt ausführen und verifizieren. Wo der Provider Rollenverwaltung unterstützt, einen separaten DDL-User verwenden und den Runtime-User auf DML-/Sequence-Rechte begrenzen. Bei Prisma Postgres die oben dokumentierte Provider-Grenze explizit als Restrisiko behandeln; unterschiedliche Endpunkte derselben Rolle sind keine echte Least-Privilege-Trennung.
8. `CRON_SECRET` und `AGENT_UPLOAD_TOKEN` als getrennte zufällige Werte mit mindestens 32 Zeichen setzen. Fehlende Werte sperren die betreffenden Routen absichtlich fail-closed.

## Bestehende öffentliche PDFs migrieren

Neue PDF-Uploads schlagen ohne Private-Store-Token mit `503` fehl und werden als `private` gespeichert. Die Download-Route prüft Clerk-Login plus Mentorship-Entitlement und streamt mit `Cache-Control: private, no-store`.

Bestehende `*.public.blob.vercel-storage.com/pdfs/...`-Objekte bleiben technisch öffentlich, auch wenn die Anwendung sie nur noch über die geschützte Route ausgibt. Sie müssen deshalb separat migriert werden:

1. Inventar aller nicht-leeren `Video.pdfUrl`-Werte exportieren, ohne URLs in öffentliche Logs zu schreiben.
2. Jedes Objekt serverseitig in den privaten Store kopieren oder über die Admin-Oberfläche neu hochladen.
3. `Video.pdfUrl` auf das interne Format `/api/download/pdf/<videoId>/<datei>?blob=<private-pathname>` aktualisieren.
4. Download mit berechtigtem Mitglied testen; anonyme und abgelaufene Accounts müssen `401` beziehungsweise `403` erhalten.
5. Erst danach das alte öffentliche Blob löschen und bekannte alte URLs auf `404` prüfen.

Bis Schritt 5 abgeschlossen ist, bleibt die Kenntnis einer alten Public-URL ein Rest-Risiko.

Der Migrationsjob läuft standardmäßig read-only und gibt keine Blob-URLs aus:

```bash
npm run pdf:migrate-private
```

Das geschützte Manifest muss außerhalb des Repositories liegen. Der Job legt es mit Modus `0600` an und protokolliert dort die ursprüngliche URL, Hashes, ETags und jeden dauerhaften Phasenübergang. Nach Prüfung des Inventory-Counts zuerst die Migrationsphase trocken ausführen:

```bash
npm run pdf:migrate-private -- --phase=migrate --manifest=/absolute/private/pdf-migration.jsonl
```

Für den Canary anschließend denselben Kandidaten explizit scopen und dessen eigenen Count/Digest ablesen:

```bash
npm run pdf:migrate-private -- --phase=migrate --manifest=/absolute/private/pdf-migration.jsonl --environment-id=production --video-id=<video-id> --limit=1
```

Danach genau diesen einen Datensatz ohne öffentliche Löschung migrieren:

```bash
npm run pdf:migrate-private -- --phase=migrate --apply --manifest=/absolute/private/pdf-migration.jsonl --environment-id=production --video-id=<video-id> --expect-count=1 --expect-digest=<dry-run-digest> --limit=1
```

Der Job prüft Downloadgröße und `%PDF-`-Magic, verwendet einen vollständigen SHA-256 für den deterministischen privaten Pfad, liest die private Kopie erneut vollständig ein und aktualisiert `Video.pdfUrl` per Compare-and-set. Ein PostgreSQL Advisory Lock verhindert Parallelruns. Öffentliche Originale bleiben in dieser Phase immer bestehen.

Nach erfolgreichem berechtigten `200`-, anonymen `401`- und unberechtigten `403`-Test die private Kopie gegen DB und Manifest verifizieren:

```bash
npm run pdf:migrate-private -- --phase=verify --manifest=/absolute/private/pdf-migration.jsonl --environment-id=production
npm run pdf:migrate-private -- --phase=verify --apply --manifest=/absolute/private/pdf-migration.jsonl --environment-id=production --expect-count=1 --expect-digest=<verify-dry-run-digest>
```

Erst danach in einem separaten, explizit bestätigten Lauf das öffentliche Original konditional mit dem manifestierten ETag löschen:

```bash
npm run pdf:migrate-private -- --phase=delete --manifest=/absolute/private/pdf-migration.jsonl --environment-id=production
npm run pdf:migrate-private -- --phase=delete --apply --manifest=/absolute/private/pdf-migration.jsonl --environment-id=production --expect-count=1 --expect-digest=<delete-dry-run-digest> --acknowledge-public-deletion
```

Vor jeder Apply-Phase denselben Befehl ohne `--apply`, `--expect-count` und `--expect-digest` ausführen und anschließend exakt Count und Digest übernehmen. Damit erkennt der Job nicht nur Mengenänderungen, sondern auch einen Austausch der Kandidaten bei gleicher Anzahl. Das Manifest bindet den Lauf zusätzlich an Environment-ID, vollständigen Hash des direkten DB-Zugangs und Fingerprint des privaten Store-Tokens.

Für alle Phasen muss die geschützte Operations-Umgebung `MIGRATION_DATABASE_URL` oder `DIRECT_URL` als direkten, nicht gepoolten PostgreSQL-Endpunkt bereitstellen; nur damit bleibt der Advisory Lock über die gesamte Session wirksam. Für `migrate` und `verify` ist zusätzlich `BLOB_PRIVATE_READ_WRITE_TOKEN` nötig, für `delete` außerdem der davon verschiedene `BLOB_READ_WRITE_TOKEN`. Das Manifest bis zum bestätigten Abschlussinventar geschützt aufbewahren und anschließend nach der internen Aufbewahrungsrichtlinie entfernen.

DB-Credentials und privaten Blob-Token zwischen `migrate`, `verify` und `delete` nicht rotieren: Ihre Fingerprints sind absichtlich Teil des Manifest-Kontexts. Falls eine Rotation unvermeidbar ist, den Lauf stoppen und das Manifest manuell reconciliieren; den Kontext-Guard nicht entfernen oder überschreiben.

## Sicherer Alias-Cutover

1. Zwei identische Production-Target-Candidates ohne Alias bauen. Candidate A erhält `ALLOW_LEGACY_TRADINGVIEW_COOKIE_MIGRATION=true`, Candidate B `false`; beide müssen auf demselben Security-Commit und denselben übrigen Secrets basieren.
2. Candidate B anonym und mit nicht-mutierenden Checks prüfen. Candidate A vor dem Cutover nicht als Admin unter `/mentorship/indicators` öffnen, weil dies die Production-DB bereits verschlüsseln würde, während die alte Live-Version nur Plaintext versteht.
3. Provider-Jobs und Uploads kurz pausieren, Candidate A promoten und als echter Plattform-Admin genau einmal `/mentorship/indicators` laden.
4. In der DB verifizieren, dass der Session-Wert `version: 2`, `algorithm: aes-256-gcm`, `iv`, `ciphertext` und `authTag`, aber kein Plaintext-`cookie`-Feld enthält. Die Admin-Seite neu laden und erfolgreiche Entschlüsselung bestätigen.
5. Unmittelbar Candidate B promoten und erneut prüfen, dass die verschlüsselte Session bei deaktivierter Legacy-Migration lesbar bleibt.
6. Signed Playback auf der Production-Domain testen. Erst danach Bunny Player Token Authentication und `BlockNoneReferrer` aktivieren sowie Direct Play/File Access sperren. Anschließend berechtigtes Playback sowie abgewiesene unsigned/unauthorisierte Requests erneut testen.
7. Nach einem Stabilitätsfenster die PDF-Migration beginnen. Nach Cookie- oder PDF-Migration nicht auf die alte Anwendungsversion zurückrollen; vorwärts reparieren oder zuerst die betreffenden Daten-/Provider-Enforcements kompatibel zurückführen.

## Datenbankmigrationen

`vercel-build` führt bewusst keine Migration aus. Der Runtime-User hinter `DATABASE_URL` soll nur die für die Anwendung notwendigen DML-Rechte besitzen und darf keine Schemaänderungen ausführen.

Migrationen laufen in einem separaten geschützten CI-/Operations-Job:

```bash
MIGRATION_DATABASE_URL='postgresql://...' npm run db:migrate:deploy
```

Alternativ akzeptiert das Script `DIRECT_URL`. Es beendet sich fail-closed, wenn keine der beiden Variablen gesetzt ist, und fällt niemals auf die Runtime-`DATABASE_URL` zurück. Ist die Migration-URL bytegleich zur Runtime-`DATABASE_URL`, bricht das Script ebenfalls ab. Vorher Backup/PITR-Status und anschließend Prisma-Migrationsstatus prüfen.

## Secret- und Env-Hygiene

- Lokale `.env`, `.env.local`, `.env.development` und `.env.production` mit Dateirechten `600` halten. `.env.example` enthält ausschließlich leere Platzhalter.
- Mit `git ls-files '.env*'` prüfen, dass nur `.env.example` versioniert ist.
- Production-, Preview- und Development-Secrets getrennt halten. Preview darf keine Production-Webhook-Secrets oder DDL-Datenbankrechte erhalten.
- `AGENT_UPLOAD_TOKEN` als unabhängigen zufälligen Wert mit mindestens 32 Zeichen erzeugen, nur über `Authorization: Bearer ...` senden und regelmäßig rotieren. TUS-Signaturen laufen standardmäßig 15 Minuten und maximal 60 Minuten.
- `MENTORSHIP_ACCESS_OVERRIDE_EMAILS` ist eine optionale, komma-separierte Allowlist verifizierter Clerk-Primary-Emails. Leer lassen, wenn kein Break-glass-Zugang nötig ist; Einträge quartalsweise rezertifizieren. Es gibt keinen hardcodierten Override mehr.
- Cron-, Webhook- und Agent-Secrets dürfen nicht wiederverwendet werden.

## Release-Gate

Vor jedem Security-Release lokal oder in CI ausführen:

```bash
npm run test:security
npx prisma validate
npx prisma generate
npx next typegen
npx tsc --noEmit
npm run lint
npm run build
npm audit --omit=dev
```

Danach in Preview prüfen:

- Login, Checkout und Clerk-Redirects funktionieren unter der CSP.
- Analytics/Clarity laden erst nach Consent und erzeugen keine CSP-Verstöße.
- Anonyme PDF-Downloads liefern `401`; Nutzer ohne Entitlement `403`; berechtigte Nutzer erhalten das PDF ohne öffentliche Blob-URL.
- Bunny Playback verwendet ausschließlich kurzlebige serverseitig signierte Embed-URLs.
- Unsigned oder falsch signierte Bunny-/Stripe-/PayPal-Webhooks werden abgelehnt.

Security-Header zusätzlich mit Browser DevTools und einem externen Header-Scanner gegen Preview und Production prüfen. CSP-Verstöße zuerst in Preview beheben; die Policy nicht pauschal auf weitere Origins öffnen.
