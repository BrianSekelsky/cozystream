import { Component, ChangeDetectionStrategy, inject, signal, Input, Output, EventEmitter, OnInit } from '@angular/core'

import { ApiService } from '../../services/api.service'
import { SeasonPosterOption } from '../../models/media.model'

@Component({
    selector: 'app-season-poster-picker',
    imports: [],
    templateUrl: './season-poster-picker.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeasonPosterPickerComponent implements OnInit {
  @Input({ required: true }) tmdbId!: string
  @Input({ required: true }) seasonNumber!: number
  @Input() currentPosterUrl: string | null = null
  @Output() selected = new EventEmitter<string>()
  @Output() closed = new EventEmitter<void>()

  private api = inject(ApiService)

  posters = signal<SeasonPosterOption[]>([])
  loading = signal(true)

  ngOnInit() {
    this.api.getSeasonPosters(this.tmdbId, this.seasonNumber).subscribe({
      next: (results) => {
        this.posters.set(results)
        this.loading.set(false)
      },
      error: () => this.loading.set(false),
    })
  }

  selectPoster(url: string) {
    this.selected.emit(url)
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.closed.emit()
    }
  }

  isSelected(url: string): boolean {
    return url === this.currentPosterUrl
  }

  langLabel(lang: string | null): string {
    if (!lang || lang === 'en') return ''
    return lang.toUpperCase()
  }
}
