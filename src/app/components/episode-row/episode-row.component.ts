import { Component, Input, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Router } from '@angular/router'
import { MediaItem } from '../../models/media.model'

function extractEpisodeNum(title: string): number {
  const m = title.match(/S\d{1,2}E(\d{1,2})/i)
  return m ? parseInt(m[1]) : 0
}

function extractEpisodeTitle(title: string): string {
  const m = title.match(/S\d{1,2}E\d{1,2}\s+-\s+(.+)$/i)
  return m ? m[1].trim() : ''
}

@Component({
  selector: 'app-episode-row',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './episode-row.component.html',
})
export class EpisodeRowComponent {
  @Input({ required: true }) episode!: MediaItem

  private router = inject(Router)

  get epNum(): number { return extractEpisodeNum(this.episode.title) }
  get epNumPadded(): string { return String(this.epNum).padStart(2, '0') }
  get epTitle(): string { return extractEpisodeTitle(this.episode.title) }

  play() {
    this.router.navigate(['/player', this.episode.id])
  }
}
