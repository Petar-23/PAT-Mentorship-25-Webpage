import { permanentRedirect } from 'next/navigation'

// Die Landingpage lag im Soft Launch unter /lp-v3 und ist jetzt die Startseite.
export default function LandingV3Redirect() {
  permanentRedirect('/')
}
