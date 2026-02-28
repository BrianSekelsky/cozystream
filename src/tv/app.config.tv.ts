import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core'
import { provideRouter, withPreloading, PreloadAllModules } from '@angular/router'
import { provideHttpClient, withInterceptors } from '@angular/common/http'
import { tvRoutes } from '../app/tv/tv.routes'
import { tvAuthInterceptor } from '../app/tv/interceptors/tv-auth.interceptor'
import { ApiService } from '../app/services/api.service'
import { TvApiService } from '../app/tv/services/tv-api.service'
import { AuthService } from '../app/services/auth.service'
import { TvAuthService } from '../app/tv/services/tv-auth.service'

export const tvAppConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(tvRoutes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([tvAuthInterceptor])),
    { provide: ApiService, useExisting: TvApiService },
    { provide: AuthService, useExisting: TvAuthService },
  ],
}
