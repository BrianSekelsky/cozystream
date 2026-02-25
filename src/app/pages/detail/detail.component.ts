import { Component, inject, signal, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { ActivatedRoute, Router } from '@angular/router'
import { Location } from '@angular/common'
import { ApiService } from '../../services/api.service'
import { DisplaySettingsService } from '../../services/display-settings.service'
import { MediaItem, WatchProgress, CreditsResult } from '../../models/media.model'
import { PersonTileComponent } from '../../components/person-tile/person-tile.component'

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  const gb = bytes / 1_073_741_824
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1_048_576).toFixed(0)} MB`
}


@Component({
  selector: 'app-detail',
  standalone: true,
  imports: [CommonModule, PersonTileComponent],
  templateUrl: './detail.component.html',
})
export class DetailComponent implements OnInit {
  ds = inject(DisplaySettingsService)
  private api = inject(ApiService)
  private route = inject(ActivatedRoute)
  private router = inject(Router)
  private location = inject(Location)

  loading = signal(true)
  item = signal<MediaItem | null>(null)
  progress = signal<WatchProgress | null>(null)
  credits = signal<CreditsResult | null>(null)

  resumePosition = signal(0)
  canResume = signal(false)
  progressPercent = signal(0)
  genres = signal<string[]>([])

  protected formatDuration = formatDuration
  protected formatFileSize = formatFileSize

  posterCornerClass(): string {
    const c = this.ds.settings().posterCorners
    if (c === 'small') return 'rounded-lg'
    if (c === 'large') return 'rounded-2xl'
    return ''
  }

  backdropBlurClass(): string {
    const b = this.ds.settings().detailBackdropBlur
    if (b === 'light') return 'blur-sm'
    if (b === 'heavy') return 'blur-xl'
    return ''
  }

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'))
    Promise.all([
      this.api.getMediaById(id).toPromise(),
      this.api.getProgress(id).toPromise(),
    ]).then(([media, prog]) => {
      if (media) {
        this.item.set(media)
        const pos = prog?.position_seconds ?? 0
        this.resumePosition.set(pos)
        this.canResume.set(pos > 10)
        if (media.duration && pos > 10) {
          this.progressPercent.set(Math.min(100, (pos / media.duration) * 100))
        }
        this.genres.set(media.genre ? [media.genre] : [])

        if (media.tmdb_id) {
          this.api.getCredits(id).subscribe({
            next: (c) => {
              this.credits.set(c)
              if (c.genres.length) this.genres.set(c.genres)
            },
            error: () => {},
          })
        }
      }
      this.loading.set(false)
    }).catch(() => this.loading.set(false))
  }

  directors() {
    return this.credits()?.directors ?? []
  }

  directorNames(): string {
    return this.directors().map(d => d.name).join(', ')
  }

  /** True if ANY director also appears in the Writers crew category */
  anyDirectorIsWriter(): boolean {
    const dirs = this.directors()
    if (!dirs.length) return false
    const allWriters = this.credits()?.crewCategories?.find(c => c.label === 'Writers')?.people ?? []
    return dirs.some(d => allWriters.some(w => w.name === d.name))
  }

  directorLabel(): string {
    const plural = this.directors().length > 1
    if (this.anyDirectorIsWriter()) {
      return plural ? 'Directors & Writers' : 'Director & Writer'
    }
    return plural ? 'Directors' : 'Director'
  }

  writers() {
    const allWriters = this.credits()?.crewCategories?.find(c => c.label === 'Writers')?.people ?? []
    const dirNames = new Set(this.directors().map(d => d.name))
    return allWriters.filter(w => !dirNames.has(w.name))
  }

  writersLabel(): string {
    const w = this.writers()
    if (this.anyDirectorIsWriter()) {
      return w.length === 1 ? 'Other Writer' : 'Other Writers'
    }
    return w.length === 1 ? 'Writer' : 'Writers'
  }

  nonWriterCrewCategories() {
    return this.credits()?.crewCategories?.filter(c => c.label !== 'Writers') ?? []
  }

  goBack() { this.location.back() }

  goToEdit() {
    this.router.navigate(['/edit', this.item()!.id])
  }

  play(fromStart: boolean) {
    const startPosition = fromStart ? 0 : this.resumePosition()
    this.router.navigate(['/player', this.item()!.id], {
      state: { startPosition },
    })
  }
}
