# Brand Guidelines - PAT Mentorship

## Farben

### Primär
- **Gold/Amber:** `#F59E0B` (amber-500) - CTAs, Highlights
- **Dark:** `#0A0A0A` - Hintergrund
- **White:** `#FFFFFF` - Text auf Dark

### Sekundär  
- **Gray-900:** `#171717` - Cards, Sections
- **Gray-800:** `#262626` - Borders, Dividers
- **Gray-400:** `#A3A3A3` - Muted Text

### Akzente
- **Green:** `#22C55E` - Success, Profit
- **Red:** `#EF4444` - Error, Loss
- **Blue:** `#3B82F6` - Links, Info

## Typography

- **Headlines:** Font-bold, tracking-tight
- **Body:** Font-normal, text-gray-300
- **Small:** Text-sm, text-gray-400

## Spacing

- Sections: `py-20` bis `py-32`
- Cards: `p-6` bis `p-8`
- Gaps: `gap-4`, `gap-6`, `gap-8`

## Animationen

- Dauer: 200-500ms
- Easing: ease-out für Enter, ease-in für Exit
- Subtle > Flashy
- Framer Motion für komplexe Animationen

## Komponenten-Stil

### Buttons
```tsx
// Primary
className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-6 py-3 rounded-lg transition-colors"

// Secondary  
className="border border-gray-700 hover:border-gray-600 text-white px-6 py-3 rounded-lg transition-colors"
```

### Cards
```tsx
className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm"
```

## Do's & Don'ts

✅ Dunkles, professionelles Design
✅ Gold als Akzentfarbe für wichtige Elemente
✅ Viel Whitespace
✅ Subtile Animationen

❌ Bunte, überladene Designs
❌ Zu viele Animationen
❌ Light Mode (gibt es nicht)
❌ Comic Sans oder ähnliche Fonts
