import { Injectable, signal, effect } from '@angular/core'
import { DisplaySettings, DEFAULT_DISPLAY_SETTINGS } from '../models/media.model'

const STORAGE_KEY = 'cozystream:display'

function fontToClass(font: 'sans' | 'serif' | 'mono'): string {
  if (font === 'serif') return 'font-serif'
  if (font === 'mono') return 'font-mono'
  return 'font-sans'
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
