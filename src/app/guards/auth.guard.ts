import { CanActivateFn, Router } from '@angular/router'
import { inject } from '@angular/core'
import { AuthService } from '../services/auth.service'

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService)
  const router = inject(Router)
  if (auth.isLoggedIn()) return true
  router.navigate(['/login'])
  return false
}

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService)
  const router = inject(Router)
  if (auth.isAdmin()) return true
  router.navigate(['/browse'])
  return false
}

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService)
  const router = inject(Router)
  if (!auth.isLoggedIn()) return true
  router.navigate(['/browse'])
  return false
}
