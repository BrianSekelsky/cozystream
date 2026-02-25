import { Component, inject, OnInit } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { DisplaySettingsService } from './services/display-settings.service'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  // Inject so the service is instantiated (applies CSS vars + theme on startup)
  private displaySettings = inject(DisplaySettingsService)

  ngOnInit() {}
}
