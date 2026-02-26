import { Component, inject, signal, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Router, RouterModule } from '@angular/router'
import { AuthService } from '../../services/auth.service'

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.component.html',
})
export class RegisterComponent implements OnInit {
  private auth = inject(AuthService)
  private router = inject(Router)

  username = ''
  displayName = ''
  password = ''
  confirmPassword = ''
  inviteCode = ''
  error = signal('')
  loading = signal(false)
  setupRequired = signal(false)

  ngOnInit(): void {
    this.auth.checkStatus().subscribe({
      next: (status) => {
        this.setupRequired.set(status.setupRequired)
      },
    })
  }

  register(): void {
    if (this.password !== this.confirmPassword) {
      this.error.set('Passwords do not match')
      return
    }

    this.error.set('')
    this.loading.set(true)
    this.auth
      .register(
        this.username,
        this.password,
        this.displayName,
        this.setupRequired() ? undefined : this.inviteCode
      )
      .subscribe({
        next: () => {
          this.router.navigate(['/browse'])
        },
        error: (err) => {
          this.loading.set(false)
          this.error.set(err?.error?.error ?? 'Registration failed')
        },
      })
  }
}
