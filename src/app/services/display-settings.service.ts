import { Injectable, signal, effect } from '@angular/core'
import { DisplaySettings, DEFAULT_DISPLAY_SETTINGS, ColorScheme } from '../models/media.model'

const STORAGE_KEY = 'cozystream:display'

function fontToClass(font: 'sans' | 'serif' | 'mono'): string {
  if (font === 'serif') return 'font-serif'
  if (font === 'mono') return 'font-mono'
  return 'font-sans'
}

interface SchemeColors {
  surface: string
  surfaceRaised: string
  overlayRgb: string        // R G B for overlay tints (white-ish in dark, black-ish in light)
  textRgb: string           // R G B for foreground text
  surfaceRgb: string        // R G B for nav gradient etc.
}

const COLOR_SCHEMES: Record<ColorScheme, { dark: SchemeColors; light: SchemeColors }> = {
  default: {
    dark:  { surface: 'rgb(10 10 10)',   surfaceRaised: 'rgb(18 18 18)',   overlayRgb: '255 255 255', textRgb: '255 255 255', surfaceRgb: '10 10 10' },
    light: { surface: 'rgb(245 245 245)', surfaceRaised: 'rgb(255 255 255)', overlayRgb: '0 0 0',       textRgb: '20 20 20',    surfaceRgb: '245 245 245' },
  },
  midnight: {
    dark:  { surface: 'rgb(12 14 26)',   surfaceRaised: 'rgb(20 24 40)',   overlayRgb: '180 190 230', textRgb: '200 210 232', surfaceRgb: '12 14 26' },
    light: { surface: 'rgb(238 241 248)', surfaceRaised: 'rgb(248 249 252)', overlayRgb: '20 25 50',    textRgb: '26 30 46',    surfaceRgb: '238 241 248' },
  },
  ember: {
    dark:  { surface: 'rgb(18 16 12)',   surfaceRaised: 'rgb(28 24 20)',   overlayRgb: '230 210 180', textRgb: '240 230 215', surfaceRgb: '18 16 12' },
    light: { surface: 'rgb(250 246 240)', surfaceRaised: 'rgb(255 253 248)', overlayRgb: '50 40 20',    textRgb: '45 35 20',    surfaceRgb: '250 246 240' },
  },
  forest: {
    dark:  { surface: 'rgb(10 14 10)',   surfaceRaised: 'rgb(18 24 18)',   overlayRgb: '180 220 180', textRgb: '200 220 200', surfaceRgb: '10 14 10' },
    light: { surface: 'rgb(240 245 240)', surfaceRaised: 'rgb(248 252 248)', overlayRgb: '20 40 20',    textRgb: '26 36 26',    surfaceRgb: '240 245 240' },
  },
  rose: {
    dark:  { surface: 'rgb(18 12 14)',   surfaceRaised: 'rgb(28 20 24)',   overlayRgb: '230 180 200', textRgb: '232 200 210', surfaceRgb: '18 12 14' },
    light: { surface: 'rgb(248 240 242)', surfaceRaised: 'rgb(252 248 249)', overlayRgb: '50 20 30',    textRgb: '46 26 32',    surfaceRgb: '248 240 242' },
  },
  slate: {
    dark:  { surface: 'rgb(16 18 20)',   surfaceRaised: 'rgb(24 28 30)',   overlayRgb: '200 210 220', textRgb: '210 215 220', surfaceRgb: '16 18 20' },
    light: { surface: 'rgb(240 242 244)', surfaceRaised: 'rgb(248 249 250)', overlayRgb: '25 30 40',    textRgb: '30 34 40',    surfaceRgb: '240 242 244' },
  },
}

@Injectable({ providedIn: 'root' })
export class DisplaySettingsService {
  private _settings = signal<DisplaySettings>(this.load())
  readonly settings = this._settings.asReadonly()

  constructor() {
    // Persist to localStorage and apply CSS whenever settings change
    effect(() => {
      const s = this._settings()
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch {}
      this.applyToDOM(s)
    })
  }

  update(patch: Partial<DisplaySettings>): void {
    this._settings.update((prev) => ({ ...prev, ...patch }))
  }

  headingFontClass(): string {
    return fontToClass(this._settings().headingFont)
  }

  titleFontClass(): string {
    return fontToClass(this._settings().titleFont)
  }

  detailFontClass(): string {
    return fontToClass(this._settings().detailFont)
  }

  bodyFontClass(): string {
    return fontToClass(this._settings().bodyFont)
  }

  private load(): DisplaySettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        // Migration: roundedPosters → posterCorners
        if ('roundedPosters' in parsed && !('posterCorners' in parsed)) {
          parsed.posterCorners = parsed.roundedPosters ? 'small' : 'none'
          delete parsed.roundedPosters
        }
        return { ...DEFAULT_DISPLAY_SETTINGS, ...parsed }
      }
    } catch {}
    return { ...DEFAULT_DISPLAY_SETTINGS }
  }

  private applyToDOM(s: DisplaySettings): void {
    const root = document.documentElement
    root.setAttribute('data-theme', s.theme)
    root.style.setProperty('--color-accent', s.accentColor)

    // Color scheme
    const scheme = COLOR_SCHEMES[s.colorScheme] ?? COLOR_SCHEMES.default
    const colors = s.theme === 'light' ? scheme.light : scheme.dark
    root.style.setProperty('--color-surface', colors.surface)
    root.style.setProperty('--color-surface-raised', colors.surfaceRaised)
    root.style.setProperty('--color-surface-overlay', `rgb(${colors.overlayRgb} / 0.06)`)
    root.style.setProperty('--text-rgb', colors.textRgb)
    root.style.setProperty('--surface-rgb', colors.surfaceRgb)

    // Row spacing
    const spacingMap = { compact: '1.5rem', comfortable: '2rem', spacious: '3rem' }
    root.style.setProperty('--row-spacing', spacingMap[s.rowSpacing])

    // Card size (column offset)
    const offsetMap = { small: '2', medium: '0', large: '-2' }
    root.style.setProperty('--card-columns-offset', offsetMap[s.cardSize])

    // Font attributes (used by CSS for size compensation)
    root.setAttribute('data-body-font', s.bodyFont)
    root.setAttribute('data-heading-font', s.headingFont)
  }
}
