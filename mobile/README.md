# PAT Mentorship für iOS

Die lokale Vorschau enthält die PAT-Studienfilme **Fair Value Gaps** und **Das Wochenprofil**. Die App spielt sie im Hoch- und Querformat ab, speichert sie auf Wunsch auf dem Gerät und merkt sich Wiedergabestelle und Abschluss. Im Bereich „Zugang“ öffnet sich die bestehende Mentorship-Website im Browser.

## Auf dem iPhone öffnen

Auf diesem Mac startet ein Doppelklick auf **iPhone-Vorschau.command** den Entwicklungsserver. Verbinde das iPhone mit demselben privaten WLAN, öffne die Kamera und scanne den QR-Code. Auf dem iPhone wird eine mit Expo SDK 58 kompatible Version von Expo Go benötigt. Der Server liefert die zwei Vorschaufilme über dieselbe Adresse wie die App.

Für eine frische Arbeitskopie brauchst du Node 24 LTS. Führe die folgenden Befehle im Ordner `mobile` aus.

```sh
npm ci
npm start -- --go --lan
```

## Auf dem Mac ansehen

```sh
npm run export:web
npm run preview
```

Die Vorschau läuft auf diesem Mac unter [127.0.0.1:4178](http://127.0.0.1:4178). Sie speichert gewählte Filme in IndexedDB. Ein Service Worker hält Oberfläche und Schriften für den nächsten Offline-Start bereit.

## Nativen Build prüfen

```sh
npm run typecheck
npm run export:ios
npm run prebuild:ios
```

Der Prebuild erzeugt `ios/PATMentorship.xcodeproj`. Mit vollständigem Xcode und iOS-Simulator startet `npm run ios` den nativen Build. Der JavaScript-Export ist ein Hermes-Bundle. Eine installierbare iOS-Fassung erfordert zusätzlich Apples Build-Werkzeuge.

Für einen Flugmodustest nach vollständigem Beenden der nativen App wird ein Build mit eingebettetem JavaScript benötigt. Setze beim Erstellen dieses Builds `EXPO_PUBLIC_PREVIEW_MEDIA_ORIGIN` auf die vom iPhone erreichbare Adresse des laufenden Medienservers. In der Expo-Go-Entwicklung ermittelt die App die Adresse aus der aktuellen Metro-Sitzung.

## Umfang der Vorschau

- Die App liefert beide MP4-Dateien zum Abspielen oder Herunterladen auf Anfrage. Im nativen App-Bundle liegen Bilder und Schriften.
- Native Downloads landen im app-eigenen Verzeichnis. Erst nach Eingang aller erwarteten Bytes wird ein Film als gespeichert angezeigt. Die Vorschau enthält keine bezahlten Unterrichtsvideos.
- Native Anmeldung, persönlicher Kurskatalog und befristete Offline-Lizenzen für die geschützten Bunny-Lektionen sind offen. Die beiden Vorschaufilme testen lokale Wiedergabe und Speicherverhalten.

Die beiden MP4-Fassungen stammen aus den lokalen PAT-Projekten `artifacts/x-fvg-evolution-20261018` und `artifacts/x-weekly-profile-20261019`. Die Schriftlizenzen liegen unter `assets/fonts`.
