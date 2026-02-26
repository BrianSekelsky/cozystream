import { Component, inject, signal, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Router, RouterModule } from '@angular/router'
import { AuthService } from '../../services/auth.service'

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
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
