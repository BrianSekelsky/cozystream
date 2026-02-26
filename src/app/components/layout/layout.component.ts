import { Component, inject, signal } from '@angular/core'
import { RouterOutlet, RouterLink, Router, NavigationEnd, ActivatedRoute } from '@angular/router'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { filter } from 'rxjs/operators'
import { DisplaySettingsService } from '../../services/display-settings.service'
import { AuthService } from '../../services/auth.service'
import { CollectionManagerComponent } from '../collection-manager/collection-manager.component'

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, CommonModule, FormsModule, CollectionManagerComponent],
  templateUrl: './layout.component.html',
})
export class LayoutComponent {
  ds = inject(DisplaySettingsService)
  auth = inject(AuthService)
  private router = inject(Router)

  searchQuery = ''
  isOnBrowse = signal(false)
  showCategoryManager = signal(false)

  constructor() {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.isOnBrowse.set(e.urlAfterRedirects === '/browse' || e.urlAfterRedirects.startsWith('/browse'))
        if (!e.urlAfterRedirects.startsWith('/browse')) {
          this.searchQuery = ''
          this.showCategoryManager.set(false)
        } else {
          // Sync search query from URL on navigation
          const url = new URL(e.urlAfterRedirects, 'http://x')
          this.searchQuery = url.searchParams.get('q') ?? ''
        }
      })
  }

  onSearchChange(value: string) {
    this.searchQuery = value
    this.router.navigate(['/browse'], {
      queryParams: value ? { q: value } : {},
      replaceUrl: true,
    })
  }

  toggleTheme() {
    const next = this.ds.settings().theme === 'dark' ? 'light' : 'dark'
    this.ds.update({ theme: next })
  }
}
