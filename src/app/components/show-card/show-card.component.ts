import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { ShowGroup } from '../../models/media.model'
import { DisplaySettingsService } from '../../services/display-settings.service'
import { inject } from '@angular/core'

@Component({
  selector: 'app-show-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './show-card.component.html',
})
export class ShowCardComponent {
  @Input({ required: true }) show!: ShowGroup
  @Output() selected = new EventEmitter<ShowGroup>()

  ds = inject(DisplaySettingsService)

  posterCornerClass(): string {
    const c = this.ds.settings().posterCorners
    if (c === 'small') return 'rounded-lg'
    if (c === 'large') return 'rounded-2xl'
    return ''
  }
}
