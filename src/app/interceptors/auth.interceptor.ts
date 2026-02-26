import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http'
import { inject } from '@angular/core'
import { catchError, throwError } from 'rxjs'
import { AuthService } from '../services/auth.service'

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService)
  const token = auth.getToken()

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
    })
  )
}
