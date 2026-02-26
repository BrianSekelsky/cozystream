import { Component, inject, signal, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { ApiService } from '../../services/api.service'
import { DisplaySettingsService } from '../../services/display-settings.service'
import { AuthService } from '../../services/auth.service'
import { AppSettings, ColorScheme } from '../../models/media.model'
import { checkContrast, suggestBetterColors, ContrastResult } from '../../utils/color.utils'
import type { User, InviteCode } from '../../models/auth.model'

const COLOR_SCHEME_OPTIONS: { value: ColorScheme; label: string; darkBg: string; lightBg: string }[] = [
  { value: 'default',  label: 'Default',  darkBg: 'rgb(10 10 10)',   lightBg: 'rgb(245 245 245)' },
  { value: 'midnight', label: 'Midnight', darkBg: 'rgb(12 14 26)',   lightBg: 'rgb(238 241 248)' },
  { value: 'ember',    label: 'Ember',    darkBg: 'rgb(18 16 12)',   lightBg: 'rgb(250 246 240)' },
  { value: 'forest',   label: 'Forest',   darkBg: 'rgb(10 14 10)',   lightBg: 'rgb(240 245 240)' },
  { value: 'rose',     label: 'Rose',     darkBg: 'rgb(18 12 14)',   lightBg: 'rgb(248 240 242)' },
  { value: 'slate',    label: 'Slate',    darkBg: 'rgb(16 18 20)',   lightBg: 'rgb(240 242 244)' },
]

const ACCENT_COLORS = [
  { label: 'Red',    color: '#e50914' },
  { label: 'Blue',   color: '#2563eb' },
  { label: 'Purple', color: '#7c3aed' },
  { label: 'Green',  color: '#16a34a' },
  { label: 'Orange', color: '#ea580c' },
  { label: 'Pink',   color: '#db2777' },
  { label: 'Teal',   color: '#0891b2' },
  { label: 'Yellow', color: '#ca8a04' },
]

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
})
export class SettingsComponent implements OnInit {
  ds = inject(DisplaySettingsService)
  auth = inject(AuthService)
  private api = inject(ApiService)

  colorSchemeOptions = COLOR_SCHEME_OPTIONS
  accentColors = ACCENT_COLORS
  fontOptions = [
    { value: 'sans' as const, label: 'Sans-serif' },
    { value: 'serif' as const, label: 'Serif' },
    { value: 'mono' as const, label: 'Monospace' },
  ]
  posterCornerOptions = [
    { value: 'none' as const, label: 'None' },
    { value: 'small' as const, label: 'Small' },
    { value: 'large' as const, label: 'Large' },
  ]
  detailLayoutOptions = [
    { value: 'backdrop' as const, label: 'Backdrop' },
    { value: 'poster-header' as const, label: 'Poster Header' },
    { value: 'none' as const, label: 'None' },
  ]
  rowSpacingOptions = [
    { value: 'compact' as const, label: 'Compact' },
    { value: 'comfortable' as const, label: 'Comfortable' },
    { value: 'spacious' as const, label: 'Spacious' },
  ]
  cardSizeOptions = [
    { value: 'small' as const, label: 'Small' },
    { value: 'medium' as const, label: 'Medium' },
    { value: 'large' as const, label: 'Large' },
  ]
  backdropBlurOptions = [
    { value: 'none' as const, label: 'None' },
    { value: 'light' as const, label: 'Light' },
    { value: 'heavy' as const, label: 'Heavy' },
  ]
  settings = signal<AppSettings>({ library_paths: [], tmdb_api_key: '' })
  tmdbKey = ''
  picking = signal(false)
  saving = signal(false)
  message = signal('')
  messageType = signal<'success' | 'error'>('success')
  manualPath = ''
  activeTab = signal<'setup' | 'layout' | 'appearance' | 'users'>('setup')
  contrastInfo = signal<ContrastResult | null>(null)
  colorSuggestions = signal<string[]>([])

  private originalPaths: string[] = []

  ngOnInit() {
    this.api.getSettings().subscribe({
      next: (s) => {
        this.settings.set(s)
        this.tmdbKey = s.tmdb_api_key
        this.originalPaths = [...s.library_paths]
      },
    })
    this.updateContrastInfo(this.ds.settings().accentColor)
  }

  onPresetColorClick(hex: string) {
    this.ds.update({ accentColor: hex })
    this.updateContrastInfo(hex)
  }

  onCustomColorChange(hex: string) {
    this.ds.update({ accentColor: hex })
    this.updateContrastInfo(hex)
  }

  applySuggestion(hex: string) {
    this.ds.update({ accentColor: hex })
    this.updateContrastInfo(hex)
  }

  private updateContrastInfo(hex: string) {
    const info = checkContrast(hex)
    this.contrastInfo.set(info)
    this.colorSuggestions.set(info.passesAll ? [] : suggestBetterColors(hex, 5))
  }

  removePath(path: string) {
    this.settings.update((s) => ({
      ...s,
      library_paths: s.library_paths.filter((p) => p !== path),
    }))
  }

  addManualPath() {
    const p = this.manualPath.trim()
    if (!p) return
    this.settings.update((s) => ({
      ...s,
      library_paths: s.library_paths.includes(p) ? s.library_paths : [...s.library_paths, p],
    }))
    this.manualPath = ''
  }

  pickFolder() {
    this.picking.set(true)
    this.message.set('')
    this.api.pickFolder().subscribe({
      next: (result) => {
        if (!result.cancelled && result.path) {
          this.settings.update((s) => ({
            ...s,
            library_paths: s.library_paths.includes(result.path!)
              ? s.library_paths
              : [...s.library_paths, result.path!],
          }))
        }
        this.picking.set(false)
      },
      error: (err) => {
        this.picking.set(false)
        this.messageType.set('error')
        const detail = err?.error?.error ?? err?.message ?? 'Failed to open folder picker.'
        this.message.set(detail + ' You can type a path manually below.')
      },
    })
  }

  setColorScheme(v: ColorScheme) { this.ds.update({ colorScheme: v }) }
  setHeadingFont(f: string) { this.ds.update({ headingFont: f as 'sans' | 'serif' | 'mono' }) }
  setTitleFont(f: string) { this.ds.update({ titleFont: f as 'sans' | 'serif' | 'mono' }) }
  setDetailFont(f: string) { this.ds.update({ detailFont: f as 'sans' | 'serif' | 'mono' }) }
  setBodyFont(f: string) { this.ds.update({ bodyFont: f as 'sans' | 'serif' | 'mono' }) }
  fontPreviewFamily(v: string): string {
    if (v === 'serif') return 'serif'
    if (v === 'mono') return 'monospace'
    return 'sans-serif'
  }
  setDetailLayout(v: string) { this.ds.update({ detailLayout: v as 'backdrop' | 'poster-header' | 'none' }) }
  setRowSpacing(v: string) { this.ds.update({ rowSpacing: v as 'compact' | 'comfortable' | 'spacious' }) }
  setCardSize(v: string) { this.ds.update({ cardSize: v as 'small' | 'medium' | 'large' }) }
  setBackdropBlur(v: string) { this.ds.update({ detailBackdropBlur: v as 'none' | 'light' | 'heavy' }) }

  save() {
    this.saving.set(true)
    this.message.set('')

    const currentPaths = this.settings().library_paths
    const pathsChanged =
      currentPaths.length !== this.originalPaths.length ||
      currentPaths.some((p, i) => p !== this.originalPaths[i])

    const payload: Partial<AppSettings> = { tmdb_api_key: this.tmdbKey }
    if (pathsChanged) {
      payload.library_paths = currentPaths
    }

    this.api.saveSettings(payload as AppSettings).subscribe({
      next: () => {
        this.messageType.set('success')
        this.message.set(pathsChanged ? 'Settings saved. Library scan started.' : 'Settings saved.')
        this.originalPaths = [...currentPaths]
        this.saving.set(false)
      },
      error: (err) => {
        this.messageType.set('error')
        this.message.set(err?.error?.error ?? err?.message ?? 'Failed to save settings.')
        this.saving.set(false)
      },
    })
  }

  // --- Users tab (admin only) ---
  inviteCodes = signal<InviteCode[]>([])
  users = signal<User[]>([])
  generatingCode = signal(false)
  newlyGeneratedCode = signal('')

  loadUsersTab() {
    this.auth.getInviteCodes().subscribe({
      next: (codes) => this.inviteCodes.set(codes),
    })
    this.auth.getUsers().subscribe({
      next: (users) => this.users.set(users),
    })
  }

  generateInviteCode() {
    this.generatingCode.set(true)
    this.newlyGeneratedCode.set('')
    this.auth.createInviteCode().subscribe({
      next: (res) => {
        this.newlyGeneratedCode.set(res.code)
        this.generatingCode.set(false)
        this.auth.getInviteCodes().subscribe({
          next: (codes) => this.inviteCodes.set(codes),
        })
      },
      error: () => {
        this.generatingCode.set(false)
      },
    })
  }

  deleteInviteCode(code: string) {
    this.auth.deleteInviteCode(code).subscribe({
      next: () => {
        this.inviteCodes.update((codes) => codes.filter((c) => c.code !== code))
      },
    })
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
  }
}
