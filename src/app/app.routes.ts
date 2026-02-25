import { Routes } from '@angular/router'
import { LayoutComponent } from './components/layout/layout.component'

export const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,
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
