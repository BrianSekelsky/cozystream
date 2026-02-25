import { Component, Input, inject } from '@angular/core'
import { CommonModule } from '@angular/common'
import { DisplaySettingsService } from '../../services/display-settings.service'

@Component({
  selector: 'app-person-tile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './person-tile.component.html',
})
export class PersonTileComponent {
  ds = inject(DisplaySettingsService)

  @Input({ required: true }) name!: string
  @Input() subtitle: string | undefined
  @Input() profileUrl: string | null = null
  @Input() size: 'default' | 'large' = 'default'

  initials(): string {
    return this.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  }

  sizeClass(): string {
    return this.size === 'large' ? 'w-32' : 'w-20'
  }

  imgSizeClass(): string {
    return this.size === 'large' ? 'w-32 h-44' : 'w-20 h-28'
  }

  nameSizeClass(): string {
    return this.size === 'large' ? 'text-sm' : 'text-xs'
  }

  cornerClass(): string {
    const c = this.ds.settings().posterCorners
    if (c === 'small') return 'rounded'
    if (c === 'large') return 'rounded-lg'
    return 'rounded-sm'
  }
}
