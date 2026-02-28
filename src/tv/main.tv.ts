import { bootstrapApplication } from '@angular/platform-browser'
import { tvAppConfig } from './app.config.tv'
import { TvAppComponent } from '../app/tv/tv-app.component'

bootstrapApplication(TvAppComponent, tvAppConfig)
  .catch((err) => console.error(err))
