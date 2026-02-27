import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core'

import { FormsModule } from '@angular/forms'
import { Router, RouterModule } from '@angular/router'
import { AuthService } from '../../services/auth.service'

@Component({
    imports: [FormsModule, RouterModule],
    templateUrl: './login.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {
  private auth = inject(AuthService)
  private router = inject(Router)

  username = ''
  password = ''
  error = signal('')
  loading = signal(false)

  ngOnInit(): void {
    this.auth.checkStatus().subscribe({
      next: (status) => {
        if (status.setupRequired) {
          this.router.navigate(['/register'])
        }
      },
    })
  }

  login(): void {
    this.error.set('')
    this.loading.set(true)
    this.auth.login(this.username, this.password).subscribe({
      next: () => {
        this.router.navigate(['/browse'])
      },
      error: (err) => {
        this.loading.set(false)
        this.error.set(err?.error?.error ?? 'Login failed')
      },
    })
  }
}
