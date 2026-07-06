'use client'

export function FooterCookieSettingsButton() {
  const openSettings = () => {
    window.dispatchEvent(new CustomEvent('openCookieSettings'))
  }

  return (
    <button
      onClick={openSettings}
      className="flex items-center gap-3 text-gray-400 hover:text-gray-300 transition-colors group"
    >
      <svg
        className="h-5 w-5"
        viewBox="0 0 256 256"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M164.5 24a12 12 0 0 0-13.6 13.6A36 36 0 0 1 108.4 80a12 12 0 0 0-13.9 13.9A36 36 0 0 1 52.1 136.3a12 12 0 0 0-13.6 13.6A92 92 0 1 0 164.5 24Zm22.1 161.8A68 68 0 0 1 61 157a60 60 0 0 0 57.5-57.5A60 60 0 0 0 176 42a68 68 0 0 1 10.6 143.8ZM84 172a16 16 0 1 1-16-16 16 16 0 0 1 16 16Zm48 24a16 16 0 1 1-16-16 16 16 0 0 1 16 16Zm44-40a16 16 0 1 1-16-16 16 16 0 0 1 16 16Zm-32-28a12 12 0 1 1-12-12 12 12 0 0 1 12 12Z" />
      </svg>
      <span className="text-sm font-medium">Cookie-Einstellungen</span>
      <svg
        className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>
    </button>
  )
}
