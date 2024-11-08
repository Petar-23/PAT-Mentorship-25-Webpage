// src/lib/stores/cookie-settings.ts
import { create } from 'zustand'

type CookieSettingsStore = {
  isOpen: boolean
  openSettings: () => void
  closeSettings: () => void
}

export const useCookieSettings = create<CookieSettingsStore>((set) => ({
  isOpen: false,
  openSettings: () => set({ isOpen: true }),
  closeSettings: () => set({ isOpen: false }),
}))