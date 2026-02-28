import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { SpatialNavigationService } from './services/spatial-navigation.service'
import { WebosPlatformService } from './services/webos-platform.service'

@Component({
  selector: 'tv-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
  styles: [`
    :host {
      display: block;
      width: 1920px;
      height: 1080px;
      overflow: hidden;
      background: #0a0a0a;
      color: #e5e5e5;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvAppComponent implements OnInit {
  private spatialNav = inject(SpatialNavigationService)
  private platform = inject(WebosPlatformService)

  ngOnInit(): void {
    this.spatialNav.init()
    this.platform.registerMediaKeys()
  }
}
