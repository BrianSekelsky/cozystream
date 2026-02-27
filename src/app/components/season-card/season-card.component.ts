import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core'

import { DisplaySettingsService } from '../../services/display-settings.service'
import { inject } from '@angular/core'

@Component({
    selector: 'app-season-card',
    imports: [],
    templateUrl: './season-card.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeasonCardComponent {
  @Input({ required: true }) season!: number
  @Input({ required: true }) episodeCount!: number
  @Input() posterUrl: string | null = null
  @Output() selected = new EventEmitter<number>()
  @Output() editPoster = new EventEmitter<number>()

  ds = inject(DisplaySettingsService)

  handleEditPoster(event: MouseEvent) {
    event.stopPropagation()
    this.editPoster.emit(this.season)
  }

  posterCornerClass(): string {
    const c = this.ds.settings().posterCorners
    if (c === 'small') return 'rounded-lg'
    if (c === 'large') return 'rounded-2xl'
    return ''
  }
}
