/**
 * Farbschema der Landingpage: Auto folgt Sonnenauf- und -untergang am Standort der Zeitzone (DACH),
 * sonst 7 bis 19 Uhr. Das Schema steht als data-mode am Wrapper .pat-lf, nicht global am Dokument.
 *
 * applyLandingTheme wird zweimal genutzt:
 * 1. als Inline-Skript vor dem ersten Paint (THEME_BOOT_SCRIPT, per toString), damit nichts flackert,
 * 2. von der Client-Insel ThemeSwitch für Umschalten und stündliche Wechsel.
 * Deshalb muss die Funktion eigenständig bleiben: keine Verweise auf andere Modulvariablen,
 * keine Hilfsfunktionen von außen, nur Syntax, die ohne Transpiler-Hilfen auskommt.
 */

export const THEME_STORAGE_KEY = 'pat-mode'

export type ThemePreference = 'auto' | 'light' | 'dark'
export type ThemeMode = 'light' | 'dark'
export type ThemeState = { pref: ThemePreference; mode: ThemeMode; rise: string; set: string }

export function applyLandingTheme(el: Element, requested: ThemePreference | null, animate: boolean): ThemeState {
  var rad = Math.PI / 180
  var zones: Record<string, [number, number]> = {
    'Europe/Berlin': [51.2, 10.4],
    'Europe/Vienna': [47.6, 14.1],
    'Europe/Zurich': [46.8, 8.2],
    'Europe/Luxembourg': [49.8, 6.1],
    'Europe/Vaduz': [47.2, 9.5],
    'Europe/Busingen': [47.7, 8.7],
  }
  function sunTimes(date: Date, lat: number, lng: number) {
    var dayMs = 864e5, J1970 = 2440588, J2000 = 2451545, J0 = 0.0009, e = rad * 23.4397
    var toDays = function (d: Date) { return d.valueOf() / dayMs - 0.5 + J1970 - J2000 }
    var fromJ = function (j: number) { return new Date((j + 0.5 - J1970) * dayMs) }
    var lw = rad * -lng, phi = rad * lat, d = toDays(date)
    var n = Math.round(d - J0 - lw / (2 * Math.PI))
    var ds = J0 + lw / (2 * Math.PI) + n
    var M = rad * (357.5291 + 0.98560028 * ds)
    var L = M + rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) + rad * 102.9372 + Math.PI
    var dec = Math.asin(Math.sin(e) * Math.sin(L))
    var Jnoon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L)
    var w = Math.acos((Math.sin(rad * -0.833) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)))
    var a = J0 + (w + lw) / (2 * Math.PI) + n
    var Jset = J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L)
    return { rise: fromJ(Jnoon - (Jset - Jnoon)), set: fromJ(Jset) }
  }
  function hhmm(d: Date) { return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes() }

  var now = new Date()
  var tz = ''
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '' } catch (err) { tz = '' }
  var rise: Date, set: Date, day: boolean
  var loc = Object.prototype.hasOwnProperty.call(zones, tz) ? zones[tz] : null
  var t = loc ? sunTimes(now, loc[0], loc[1]) : null
  if (t && !isNaN(t.rise.valueOf()) && !isNaN(t.set.valueOf())) {
    rise = t.rise; set = t.set; day = now >= rise && now < set
  } else {
    rise = new Date(now); rise.setHours(7, 0, 0, 0)
    set = new Date(now); set.setHours(19, 0, 0, 0)
    day = now >= rise && now < set
  }

  var pref: ThemePreference = 'auto'
  if (requested) pref = requested
  else {
    try {
      var stored = window.localStorage.getItem('pat-mode')
      if (stored === 'light' || stored === 'dark') pref = stored
    } catch (err) { pref = 'auto' }
  }
  var mode: ThemeMode = pref === 'auto' ? (day ? 'light' : 'dark') : pref
  if (animate && el.getAttribute('data-mode') !== mode) {
    el.setAttribute('data-theming', '')
    window.setTimeout(function () { el.removeAttribute('data-theming') }, 700)
  }
  el.setAttribute('data-mode', mode)
  return { pref: pref, mode: mode, rise: hhmm(rise), set: hhmm(set) }
}

/**
 * Läuft synchron beim Parsen, als erstes Kind von .pat-lf: setzt data-js (Zeichnungen dürfen sich
 * erst aufbauen, wenn Skripte laufen) und das Farbschema, bevor der Browser zum ersten Mal zeichnet.
 */
export const THEME_BOOT_SCRIPT =
  '(function(s){var el=s&&s.parentNode;if(!el||!el.setAttribute)return;el.setAttribute("data-js","");' +
  'try{(' + applyLandingTheme.toString() + ')(el,null,false)}catch(e){}})(document.currentScript)'
