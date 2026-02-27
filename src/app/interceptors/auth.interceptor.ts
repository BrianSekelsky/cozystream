import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http'
import { inject } from '@angular/core'
import { catchError, throwError } from 'rxjs'
import { AuthService } from '../services/auth.service'

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService)

  // Ensure cookies are sent with every request (needed for httpOnly auth cookie via dev proxy)
  req = req.clone({ withCredentials: true })

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/')) {
        auth.logout()
      }
      return throwError(() => error)
    })
  )
}
