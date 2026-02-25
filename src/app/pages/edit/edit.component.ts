import { Component, inject, signal, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { ActivatedRoute, Router } from '@angular/router'
import { ApiService } from '../../services/api.service'
import { MediaItem, MovieSuggestion } from '../../models/media.model'

@Component({
  selector: 'app-edit',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit.component.html',
})
export class EditComponent implements OnInit {
  private route = inject(ActivatedRoute)
  router = inject(Router)
  private api = inject(ApiService)

  item = signal<MediaItem | null>(null)
  saving = signal(false)
  saveMsg = signal<string | null>(null)

  // Form fields
  title = ''
  year = ''
  genre = ''
  description = ''
  rating = ''
  posterUrl = ''
  backdropUrl = ''

  // TMDB suggestions
  searchQuery = ''
  searchYear = ''
  suggestions = signal<MovieSuggestion[]>([])
  loadingSuggestions = signal(false)
  applyingId = signal<string | null>(null)

  private itemId = 0

  ngOnInit() {
    this.itemId = parseInt(this.route.snapshot.paramMap.get('id') ?? '0')
    this.api.getMediaById(this.itemId).subscribe({
      next: (data) => {
        this.item.set(data)
        this.title = data.title
        this.year = data.year != null ? String(data.year) : ''
        this.genre = data.genre ?? ''
        this.description = data.description ?? ''
        this.rating = data.rating != null ? String(data.rating) : ''
        this.posterUrl = data.poster_url ?? ''
        this.backdropUrl = data.backdrop_url ?? ''
        this.searchQuery = data.title
        this.searchYear = data.year != null ? String(data.year) : ''
      },
      error: console.error,
    })
  }

  goBack() { this.router.navigate([-1]) }

  save() {
    this.saving.set(true)
    this.saveMsg.set(null)
    this.api.updateMediaItem(this.itemId, {
      title: this.title || undefined,
      year: this.year ? parseInt(this.year) : null,
      genre: this.genre || null,
      description: this.description || null,
      rating: this.rating ? parseFloat(this.rating) : null,
      poster_url: this.posterUrl || null,
      backdrop_url: this.backdropUrl || null,
    } as Partial<MediaItem>).subscribe({
      next: (updated) => {
        this.item.set(updated)
        this.saveMsg.set('Saved!')
        setTimeout(() => this.saveMsg.set(null), 2000)
        this.saving.set(false)
      },
      error: () => {
        this.saveMsg.set('Save failed')
        this.saving.set(false)
      },
    })
  }

  searchSuggestions() {
    if (!this.searchQuery.trim()) return
    this.loadingSuggestions.set(true)
    this.suggestions.set([])
    const year = this.searchYear ? parseInt(this.searchYear) : undefined
    this.api.searchSuggestions(this.itemId, this.searchQuery, year).subscribe({
      next: (results) => {
        this.suggestions.set(results)
        this.loadingSuggestions.set(false)
      },
      error: () => this.loadingSuggestions.set(false),
    })
  }

  applySuggestion(s: MovieSuggestion) {
    this.applyingId.set(s.tmdbId)
    this.api.applySuggestion(this.itemId, s.tmdbId).subscribe({
      next: (updated) => {
        this.item.set(updated)
        this.title = updated.title
        this.year = updated.year != null ? String(updated.year) : ''
        this.genre = updated.genre ?? ''
        this.description = updated.description ?? ''
        this.rating = updated.rating != null ? String(updated.rating) : ''
        this.posterUrl = updated.poster_url ?? ''
        this.backdropUrl = updated.backdrop_url ?? ''
        this.suggestions.set([])
        this.saveMsg.set('Metadata applied!')
        setTimeout(() => this.saveMsg.set(null), 2000)
        this.applyingId.set(null)
      },
      error: () => {
        this.saveMsg.set('Apply failed')
        this.applyingId.set(null)
      },
    })
  }
}
