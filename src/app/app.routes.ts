import { Routes } from '@angular/router'
import { LayoutComponent } from './components/layout/layout.component'
import { authGuard, adminGuard, guestGuard } from './guards/auth.guard'

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'browse', pathMatch: 'full' },
      {
        path: 'browse',
        loadComponent: () =>
          import('./pages/browse/browse.component').then((m) => m.BrowseComponent),
      },
      {
        path: 'detail/:id',
        loadComponent: () =>
          import('./pages/detail/detail.component').then((m) => m.DetailComponent),
      },
      {
        path: 'settings',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/settings/settings.component').then((m) => m.SettingsComponent),
      },
      {
        path: 'player/:id',
        loadComponent: () =>
          import('./pages/player/player.component').then((m) => m.PlayerComponent),
      },
      {
        path: 'edit/:id',
        loadComponent: () =>
          import('./pages/edit/edit.component').then((m) => m.EditComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'browse' },
]
