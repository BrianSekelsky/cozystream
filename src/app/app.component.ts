import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { DisplaySettingsService } from './services/display-settings.service'

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    templateUrl: './app.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  // Inject so the service is instantiated (applies CSS vars + theme on startup)
  private displaySettings = inject(DisplaySettingsService)

  ngOnInit() {}
}
