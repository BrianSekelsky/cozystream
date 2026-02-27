# Project Brief: CozyStream — Self-Hosted Media Server

## Overview

A self-hosted media server application that allows users to share their personal media libraries with small groups of family and friends. Media is served directly from the user's local machine. Think of it as a modern, simplified alternative to Plex or Jellyfin with first-class support for small group sharing.

**Name:** CozyStream

**Target Platforms (Phase 1):**
- Web app (browser-based client) ✅ Complete
- Smart TV apps (future phase)

**Developer Context:** The primary developer has a frontend/web background. The tech stack leans into that strength while keeping backend complexity manageable.

---

## Core Features (MVP)

### 1. Media Library Management
- User designates one or more local folders containing media files (movies, TV shows, music) ✅
- The server scans folders and indexes media files ✅
- Automatic metadata fetching (poster art, descriptions, genres, cast) from TMDB ✅
- Library auto-updates when files are added or removed ✅
- Manual metadata editing with TMDB search suggestions ✅
- Multiple poster selection per movie and per season ✅

### 2. Streaming & Playback
- Stream media from the host machine to any connected client ✅
- On-the-fly HLS transcoding for device compatibility (fallback to direct play when possible) ✅
- Resume playback across sessions (track watch progress) ✅
- Basic playback controls: play, pause, seek, volume ✅
- Subtitles (embedded extraction + external SRT/ASS/VTT → WebVTT) ✅

### 3. Collections & Organization
- Manual collections (create, rename, delete, add/remove items) ✅
- Filter-based collections by genre, director, or decade ✅
- Collection row reordering and visibility management ✅
- Favorites and watchlist per item ✅
- Continue watching row ✅
- Recently added row ✅

### 4. User Interface
- Clean, minimal browse/search interface (poster grid) ✅
- Detail pages for movies/shows with metadata, credits, and ratings ✅
- TV show drill-down: show → seasons → episodes ✅
- Real-time search with client-side filtering ✅
- Customizable themes (dark/light), accent colors, fonts, card sizes, layout options ✅

### 5. User Management & Auth
- Multi-user support with admin/member roles ✅
- Invite code registration system (admin generates codes) ✅
- JWT authentication with HTTP interceptor ✅
- Per-user favorites, watchlist, and watch progress ✅
- Admin user management panel ✅

### 6. Group Sharing (Future)
- Users can create or join groups (e.g., 5–20 people)
- Group members see a unified library combining all contributors' media
- Unified library view across group members' servers

---

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────┐
│                 User's Machine                   │
│                                                  │
│  ┌─────────────┐   ┌────────────────────────┐   │
│  │ Media Files  │──▶│   Node.js Server       │   │
│  │ (local disk) │   │   (Fastify)            │   │
│  └─────────────┘   │                        │   │
│                     │  - File indexing        │   │
│                     │  - Metadata fetching    │   │
│                     │  - Transcoding (FFmpeg) │   │
│                     │  - Streaming API        │   │
│                     │  - SQLite database      │   │
│                     └────────┬───────────────┘   │
│                              │                    │
└──────────────────────────────┼────────────────────┘
                               │ HTTP/HTTPS
                               ▼
              ┌────────────────────────────────┐
              │         Clients                │
              │  - Web app (Angular)           │
              │  - Smart TV (future)           │
              └────────────────────────────────┘
```

### Key Architectural Decisions

- **True self-hosted:** The server runs entirely on the user's machine. No cloud dependency for core functionality.
- **Single binary / simple install:** Package the server so users run one installer or command. Avoid requiring manual Docker or terminal setup.
- **SQLite for storage:** No external database to configure. Stores library index, user profiles, watch progress, and group info locally.
- **FFmpeg for transcoding:** Industry standard, handles virtually all media formats. Bundle it or prompt the user to install it.
- **Angular standalone components:** No NgModules — uses Angular's modern standalone component architecture with signals for state management.
- **NAT traversal:** For remote access and group sharing, use a tunneling solution (see Networking section below).

---

## Tech Stack

### Server (Backend)

| Component | Technology | Status |
|-----------|------------|--------|
| Runtime | **Node.js + TypeScript** | ✅ Implemented |
| Framework | **Fastify 5** | ✅ Implemented |
| Database | **SQLite via better-sqlite3** | ✅ Implemented |
| Transcoding | **FFmpeg** (via fluent-ffmpeg) | ✅ Implemented |
| Metadata | **TMDB API** (via moviedb-promise) | ✅ Implemented |
| File watching | **chokidar** | ✅ Implemented |
| Auth | **JWT** (@fastify/jwt) + **bcryptjs** | ✅ Implemented |
| Rate limiting | **@fastify/rate-limit** | ✅ Implemented |

### Client (Frontend)

| Component | Technology | Status |
|-----------|------------|--------|
| Framework | **Angular 18 + TypeScript** (standalone components) | ✅ Implemented |
| Build tool | **Angular CLI / esbuild** | ✅ Implemented |
| Styling | **Tailwind CSS 3.4** | ✅ Implemented |
| Video player | **Native HTML5 video + hls.js** (direct play + HLS transcoding) | ✅ Implemented |
| State management | **Angular Signals** (no external library) | ✅ Implemented |
| Routing | **Angular Router** (lazy-loaded routes) | ✅ Implemented |
| HTTP | **Angular HttpClient** | ✅ Implemented |
| Reactivity | **RxJS 7.8** | ✅ Implemented |

### Smart TV Apps (Future)

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | **Angular + Tizen/webOS SDK** | Samsung (Tizen) and LG (webOS) smart TVs run web apps natively. Reuse the Angular codebase with platform-specific navigation/remote control handling |
| Alternative | **Separate lightweight app** | Build a focused TV-optimized interface sharing the same API layer |

**Recommended approach:** Start with the web app (done). Smart TVs with web browsers can access it directly. Then build dedicated Tizen/webOS apps reusing Angular components for a native feel on Samsung/LG TVs.

### Packaging & Distribution

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Desktop packaging | **Electron** or **Tauri** (with embedded server) | Wraps server + UI into a single installable app. Users just download and run — no terminal needed |
| Alternative | **pkg** or **nexe** | Compile Node.js server into a standalone binary (lighter but no GUI tray icon) |

**Recommendation:** Use Electron or Tauri for the host application. It provides a system tray icon, settings UI, and bundles the server. The actual media browsing/playback UI is the Angular web app served by the embedded server.

---

## Networking & Remote Access

This is the hardest problem for self-hosted apps. Options in order of preference:

### Option A: Tailscale / ZeroTier (Recommended for MVP)
- Users install Tailscale (free for personal use, up to 100 devices)
- Creates a private mesh VPN — all group members can access each other's servers as if on the same LAN
- No port forwarding, no HTTPS certificates to manage
- Tradeoff: requires each user to install Tailscale separately

### Option B: Built-in Tunnel Service
- Build or integrate a relay/tunnel (similar to ngrok, Cloudflare Tunnel, or what Plex does)
- Provides a public URL for each server
- Tradeoff: you'd need to run relay infrastructure (cost + legal exposure since traffic routes through you)

### Option C: Manual Port Forwarding + Dynamic DNS
- User opens a port on their router and uses a dynamic DNS service
- Most flexible but worst UX — not suitable for non-technical users

**MVP Recommendation:** Start with Option A (Tailscale). It's free, secure, and avoids you running any infrastructure. Document the setup clearly. Revisit with a built-in tunnel later if needed.

---

## Data Model (Current SQLite Schema)

```
settings
  - key, value (key-value store for library_paths, tmdb_api_key, etc.)

media_items
  - id, title, sort_title, type (movie/show/episode/song/album), year, genre
  - file_path, file_size, duration, codec_info
  - tmdb_id, poster_url, backdrop_url, description, rating, director
  - is_favorite, in_watchlist (legacy, migrated to per-user tables)
  - added_at

users
  - id, username, password_hash, display_name, role (admin/member), created_at

invite_codes
  - code, created_by, used_by, created_at, used_at

user_favorites
  - user_id, media_item_id

user_watchlist
  - user_id, media_item_id

watch_progress
  - user_id, media_item_id, position_seconds, completed, updated_at

seasons
  - id, show_id (references media_items), season_number, title

episodes
  - id, season_id, episode_number, title, file_path, duration

collections
  - id, name, created_at

collection_items
  - collection_id, media_item_id
```

### Future Tables (for Group Sharing)

```
groups
  - id, name, invite_code, created_by, created_at

group_members
  - group_id, user_id, role (admin/member), joined_at
```

---

## Streaming Strategy

### Direct Play (Preferred) ✅ Implemented
- If the client supports the file's codec natively, stream the file directly via HTTP range requests
- Minimal server load, best quality

### HLS Transcoding (Fallback) ✅ Implemented
- If the client can't play the file's codec (non-H.264/AAC), transcode on-the-fly to HLS using FFmpeg
- H.264 (libx264, veryfast preset, CRF 23) with AAC audio, 6-second segments
- Client uses hls.js to play the adaptive stream
- Session management with idle timeout (30 minutes) and automatic cleanup
- Seekable transcoding with configurable video/audio track selection
- Cache directory: `~/.cozystream/transcode-cache`

### Subtitle Handling ✅ Implemented
- Extract embedded subtitles (SRT/ASS/SSA/mov_text) from video files via FFmpeg
- Serve as WebVTT for browser playback
- Support external subtitle files (.srt, .ass, .ssa, .vtt) alongside video files

---

## Project Structure (Current)

```
cozystream-angular/
├── server/                    # Node.js backend
│   ├── src/
│   │   ├── index.ts           # Entry point, Fastify setup
│   │   ├── routes/
│   │   │   ├── auth.ts        # Registration, login, invite codes, user mgmt
│   │   │   ├── library.ts     # Media CRUD, progress, favorites, TMDB
│   │   │   ├── streaming.ts   # Direct play + HLS transcoding endpoints
│   │   │   └── settings.ts    # App settings endpoints
│   │   ├── middleware/
│   │   │   └── auth.ts        # requireAuth() and requireAdmin() middleware
│   │   ├── services/
│   │   │   ├── scanner.ts     # File system scanning via chokidar
│   │   │   ├── metadata.ts    # TMDB API integration
│   │   │   ├── transcoder.ts  # FFmpeg HLS transcoding with session mgmt
│   │   │   └── probe.ts       # FFprobe codec detection
│   │   ├── db/
│   │   │   ├── schema.ts      # SQLite schema & migrations
│   │   │   ├── queries.ts     # Database access layer
│   │   │   └── auth-queries.ts # User & invite code queries
│   │   └── utils/
│   │       └── fileUtils.ts   # File path utilities
│   └── package.json
│
├── src/                       # Angular web app
│   ├── app/
│   │   ├── app.component.ts
│   │   ├── app.routes.ts      # Lazy-loaded route config with guards
│   │   ├── guards/
│   │   │   └── auth.guard.ts  # authGuard, adminGuard, guestGuard
│   │   ├── interceptors/
│   │   │   └── auth.interceptor.ts  # JWT Bearer token + 401 handling
│   │   ├── models/
│   │   │   ├── media.model.ts # MediaItem, DisplaySettings, Collection types
│   │   │   └── auth.model.ts  # User, AuthResponse, InviteCode types
│   │   ├── pages/
│   │   │   ├── login/         # Login page
│   │   │   ├── register/      # Registration (first-user setup + invite code)
│   │   │   ├── browse/        # Library grid view
│   │   │   ├── detail/        # Media detail page
│   │   │   ├── player/        # Video playback (direct + HLS)
│   │   │   ├── edit/          # Metadata editing
│   │   │   └── settings/      # App settings (setup, layout, appearance, users)
│   │   ├── components/
│   │   │   ├── layout/        # App shell (header, nav, theme toggle)
│   │   │   ├── media-card/    # Movie poster card (default + DVD case modes)
│   │   │   ├── show-card/     # TV show card
│   │   │   ├── season-card/   # Season card
│   │   │   ├── episode-row/   # Episode list row
│   │   │   ├── person-tile/   # Cast/crew tile
│   │   │   ├── poster-image/  # Reusable poster image component
│   │   │   ├── collection-row/           # Horizontal scroll row
│   │   │   ├── filter-row/               # Filter-based collection row
│   │   │   ├── collection-manager/       # Collection management modal
│   │   │   ├── add-to-collection-modal/  # Add-to-collection modal
│   │   │   └── season-poster-picker/     # Season poster selection
│   │   ├── services/
│   │   │   ├── auth.service.ts           # JWT auth, user state, invite codes
│   │   │   ├── api.service.ts            # HTTP client for all API calls
│   │   │   ├── display-settings.service.ts  # Theme, fonts, layout prefs
│   │   │   ├── collections.service.ts    # Manual + filter collections
│   │   │   └── row-order.service.ts      # Collection row ordering
│   │   └── utils/
│   │       └── color.utils.ts # Accent color contrast checking
│   ├── styles.css             # Global styles, Tailwind directives, themes
│   ├── index.html
│   └── main.ts
│
├── angular.json               # Angular CLI config
├── tailwind.config.js         # Tailwind theme (custom colors, fonts)
├── proxy.conf.json            # Dev proxy: /api → localhost:3001
├── tsconfig.json
├── package.json               # Root dependencies
└── media-server-project-brief.md
```

---

## Angular-Specific Patterns

### Standalone Components
All components use Angular's standalone architecture (no NgModules). Each component declares its own imports directly:
```typescript
@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, ...],
  ...
})
```

### State Management with Signals
State is managed using Angular's built-in Signals API throughout:
- `signal()` for writable reactive state
- `computed()` for derived values
- `effect()` for side effects (localStorage persistence, DOM updates)
- No external state library (no NgRx, no Redux)

### Service Architecture
- **AuthService** — JWT token management, login/register/logout, user state signals, invite code management
- **ApiService** — centralized HTTP client wrapping all `/api` endpoints
- **DisplaySettingsService** — reactive theme/font/layout preferences via signals, persisted to localStorage
- **CollectionsService** — manages manual (API-backed) and filter-based (local) collections
- **RowOrderService** — manages browse page collection row ordering

### Routing
All page components are lazy-loaded with functional route guards:
```
/login → LoginComponent (guestGuard)
/register → RegisterComponent (guestGuard)
/ (LayoutComponent shell, authGuard)
├── '' → redirect to 'browse'
├── 'browse' → BrowseComponent
├── 'detail/:id' → DetailComponent
├── 'player/:id' → PlayerComponent
├── 'edit/:id' → EditComponent
├── 'settings' → SettingsComponent
└── '**' → redirect to 'browse'
```

### Development Setup
- `npm run dev` — runs server and client concurrently
- `npm run dev:server` — `tsx watch server/src/index.ts` (port 3001)
- `npm run dev:client` — `ng serve` with proxy config (port 4200)
- Proxy: `/api/*` → `http://localhost:3001`

### Theming
- CSS custom properties for colors (`--color-surface`, `--color-accent`, etc.)
- `[data-theme="dark|light"]` attribute on `<html>` for theme switching
- Custom font families: `neue-haas-grotesk-text` (sans), `freight-text-pro` (serif), `IBM Plex Mono` (mono)
- All theme logic in `DisplaySettingsService` with signal-driven DOM updates

---

## Development Phases

### Phase 1: Local Server + Web UI ✅ COMPLETE
- ~~Set up project with server and Angular client~~
- ~~Implement folder scanning and file indexing~~
- ~~Fetch metadata from TMDB for movies/TV~~
- ~~Build browse UI (poster grid, detail page, TV show drill-down)~~
- ~~Implement direct-play streaming via HTTP range requests~~
- ~~Basic video player with controls~~
- ~~Single-user mode (no auth)~~

### Phase 1.5: UI Polish & Collections ✅ COMPLETE
- ~~Manual metadata editing with TMDB suggestions~~
- ~~Multiple poster selection (movie and season level)~~
- ~~Manual and filter-based collections~~
- ~~Collection management (reorder, hide, rename)~~
- ~~Favorites and watchlist~~
- ~~Customizable theming (dark/light, accent colors, fonts, layout)~~
- ~~Responsive grid with adjustable card sizes~~
- ~~Search functionality~~
- ~~DVD Case browse mode (experimental 3D poster display with hover reveal)~~
- ~~Configurable card spacing (horizontal gap between posters)~~
- ~~Card text alignment (left/center)~~
- ~~Accent color contrast checking with suggestions~~

### Phase 2: Transcoding + Playback Polish ✅ COMPLETE
- ~~FFmpeg transcoding to HLS for incompatible formats~~
- ~~hls.js integration for HLS playback~~
- ~~Subtitle extraction (embedded + external) to WebVTT~~
- ~~Codec compatibility detection (direct play vs transcode decision)~~
- ~~Transcode session management with idle timeout and cleanup~~
- Improved player UI (keyboard shortcuts, fullscreen behavior) — ongoing

### Phase 3: Multi-User ✅ MOSTLY COMPLETE
- ~~User registration and JWT auth~~
- ~~Invite code system (admin generates, new users redeem)~~
- ~~Per-user favorites, watchlist, and watch progress~~
- ~~Admin user management panel~~
- ~~Route guards (auth, admin, guest)~~
- ~~Rate limiting on auth endpoints~~
- Group sharing (unified library across servers) — future

### Phase 4: Packaging + Smart TV (Next)
- Package server into Electron or Tauri app with system tray
- Document Tailscale setup for remote access
- Build Samsung Tizen and/or LG webOS app using shared Angular components
- Installer for Windows and macOS

---

## API Endpoints (Current)

| Method | Path | Description |
|--------|------|-------------|
| **Auth** | | |
| POST | `/api/auth/register` | Register user (first user = admin, others need invite code) |
| POST | `/api/auth/login` | Login, returns JWT token |
| GET | `/api/auth/me` | Current user from token |
| GET | `/api/auth/status` | Check if any users exist (for initial setup) |
| POST | `/api/auth/invite-codes` | Generate invite code (admin) |
| GET | `/api/auth/invite-codes` | List invite codes (admin) |
| DELETE | `/api/auth/invite-codes/:code` | Delete invite code (admin) |
| GET | `/api/auth/users` | List users (admin) |
| **Library** | | |
| GET | `/api/library` | All media items (optional `?type=` filter) |
| GET | `/api/library/recent` | Recently added (24 items) |
| GET | `/api/library/continue` | Continue watching items |
| GET | `/api/library/:id` | Single item detail |
| PUT | `/api/library/:id` | Update metadata |
| POST | `/api/library/scan` | Trigger library scan |
| GET | `/api/library/:id/progress` | Get watch progress |
| POST | `/api/library/:id/progress` | Save watch progress |
| POST | `/api/library/:id/favorite` | Toggle favorite (per-user) |
| POST | `/api/library/:id/watchlist` | Toggle watchlist (per-user) |
| GET | `/api/library/:id/credits` | Get credits (cast/crew) |
| GET | `/api/library/:id/search-suggestions` | TMDB search |
| POST | `/api/library/:id/apply-suggestion` | Apply TMDB metadata |
| **TMDB** | | |
| GET | `/api/tv/:tmdbId/season/:num/poster` | Season poster |
| GET | `/api/tv/:tmdbId/season/:num/posters` | Season poster options |
| GET | `/api/movie/:tmdbId/posters` | Movie poster options |
| **Streaming** | | |
| GET | `/api/stream/:id` | Direct play via HTTP range requests |
| GET | `/api/stream/:id/info` | Codec info + direct play/transcode decision |
| GET | `/api/stream/:id/hls` | HLS playlist (starts transcode if needed) |
| GET | `/api/stream/:id/hls/:file` | HLS .ts segment serving |
| DELETE | `/api/stream/:id/hls` | Kill transcode session |
| GET | `/api/stream/:id/subtitles/:track` | Extract subtitle track to WebVTT |
| **Settings** | | |
| GET | `/api/settings` | Get app settings |
| POST | `/api/settings` | Save settings |
| GET | `/api/settings/pick-folder` | Native folder picker |
| **Collections** | | |
| * | `/api/collections/*` | Collection CRUD |
| GET | `/health` | Health check |

---

## Key Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| NAT traversal complexity | Start with Tailscale; defer built-in tunneling |
| Transcoding performance on weak hardware | Default to direct play; make transcoding opt-in; show codec compatibility warnings |
| Smart TV app approval/distribution | Samsung and LG have developer programs; alternatively, sideload or use the web app in the TV browser |
| Legal risk around sharing features | Position as personal media server; don't market sharing as primary feature |
| FFmpeg bundling and licensing | FFmpeg is LGPL/GPL — document this; consider prompting users to install it separately |
| Angular Smart TV compatibility | Tizen/webOS run web apps natively; Angular's AOT compilation and tree-shaking keep bundle sizes manageable for TV hardware |

---

## Getting Started (for new contributors)

The project is already scaffolded and running. To get started:

1. Clone the repo and run `npm install` at root
2. Install server dependencies: `cd server && npm install`
3. Ensure FFmpeg is installed on your system
4. Set up a TMDB API key in the server settings
5. Run `npm run dev` to start both server (port 3001) and client (port 4200)
6. Open `http://localhost:4200` in your browser
7. Go to Settings to add your media library paths and trigger a scan

This brief can be shared directly with Claude in VS Code (Claude Code) to provide full project context.
