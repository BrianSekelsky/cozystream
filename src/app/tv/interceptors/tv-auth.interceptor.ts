import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http'
import { inject } from '@angular/core'
import { catchError, throwError } from 'rxjs'
import { TvAuthService } from '../services/tv-auth.service'

export const tvAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(TvAuthService)
  const token = auth.getToken()

  // Add Bearer token instead of cookies (cross-origin TV app)
  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    })
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/')) {
        auth.logout()
      }
      return throwError(() => error)
    }),
  )
}
