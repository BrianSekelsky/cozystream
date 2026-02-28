import { CanActivateFn, Router } from '@angular/router'
import { inject } from '@angular/core'
import { TvAuthService } from '../services/tv-auth.service'
import { TvApiService } from '../services/tv-api.service'

/** Redirects to /setup if no server URL is configured */
export const tvSetupGuard: CanActivateFn = () => {
  const api = inject(TvApiService)
  const router = inject(Router)
  if (api.getServerUrl()) return true
  router.navigate(['/setup'])
  return false
}

/** Redirects to /login if user is not authenticated */
export const tvAuthGuard: CanActivateFn = () => {
  const auth = inject(TvAuthService)
  const router = inject(Router)
  if (auth.isLoggedIn()) return true
  router.navigate(['/login'])
  return false
}
