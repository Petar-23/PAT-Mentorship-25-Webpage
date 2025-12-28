import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

export default [
  ...nextCoreWebVitals,
  // project-specific ignores (zusätzlich zu Next.js Defaults)
  {
    ignores: ['lib/generated/prisma/**'],
  },
  // Diese Regeln sind in unserem Codebase aktuell zu "hart" und würden tausende Refactors erzwingen.
  // Wir lassen sie als Warnungen laufen, damit `npm run lint` nicht blockiert, aber man sie trotzdem sieht.
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs,mts,cjs,cts}'],
    rules: {
      'react-hooks/error-boundaries': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/static-components': 'warn',
    },
  },
]


