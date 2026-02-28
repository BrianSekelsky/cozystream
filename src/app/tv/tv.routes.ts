import { Routes } from '@angular/router'
import { tvAuthGuard, tvSetupGuard } from './guards/tv-auth.guard'
import { TvLayoutComponent } from './components/tv-layout.component'

export const tvRoutes: Routes = [
  {
    path: 'setup',
    loadComponent: () =>
      import('./pages/setup/tv-setup.component').then((m) => m.TvSetupComponent),
  },
  {
    path: 'login',
    canActivate: [tvSetupGuard],
    loadComponent: () =>
      import('./pages/login/tv-login.component').then((m) => m.TvLoginComponent),
  },
  {
    path: '',
    component: TvLayoutComponent,
    canActivate: [tvSetupGuard, tvAuthGuard],
    children: [
      { path: '', redirectTo: 'browse', pathMatch: 'full' },
      {
        path: 'browse',
        loadComponent: () =>
          import('./pages/browse/tv-browse.component').then((m) => m.TvBrowseComponent),
      },
      {
        path: 'detail/:id',
        loadComponent: () =>
          import('./pages/detail/tv-detail.component').then((m) => m.TvDetailComponent),
      },
      {
        path: 'player/:id',
        loadComponent: () =>
          import('./pages/player/tv-player.component').then((m) => m.TvPlayerComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'browse' },
]
