#!/bin/zsh
set -eu
cd -- "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
bundled_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
if [[ -x "$bundled_node/node" ]]; then export PATH="$bundled_node:$PATH"; fi
if [[ ! -x node_modules/.bin/expo ]]; then
  print 'Im Ordner mobile fehlen die Projektpakete. Installiere sie mit npm ci.'
  exit 1
fi
print 'Öffne die Kamera auf deinem iPhone im selben WLAN und scanne den Expo-Go-Code.'
print 'Dieses Fenster stellt die beiden Vorschaufilme bereit. Beenden mit Ctrl+C.'
export EXPO_NO_TELEMETRY=1
exec ./node_modules/.bin/expo start --go --lan
