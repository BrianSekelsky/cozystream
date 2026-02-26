# Project Brief: Self-Hosted Media Server

## Overview

A self-hosted media server application that allows users to share their personal media libraries with small groups of family and friends. Media is served directly from the user's local machine. Think of it as a modern, simplified alternative to Plex or Jellyfin with first-class support for small group sharing.

**Working Name:** TBD (placeholder: "MediaShare")

**Target Platforms (Phase 1):**
- Web app (browser-based client)
- Smart TV apps (Samsung Tizen + LG webOS — both accept Angular web apps)

**Developer Context:** The primary developer has a frontend/web background with Angular experience. The tech stack should lean into that strength while keeping backend complexity manageable.

---

## IMPORTANT: Angular Rewrite Context

**A React frontend already exists for this project.** The Angular client is a full reconstruction — not a port or refactor. The existing React app should be treated as the **design reference and feature spec** for the Angular rebuild.

### How to approach the rewrite:

1. **The React app is located in `packages/client-react/`.** Before building any Angular component, examine the corresponding React component to understand the UI layout, features, user interactions, and visual design.
2. **The backend (`packages/server/`) does not change.** The Angular app consumes the exact same API endpoints. Do not modify the server.
3. **Build the Angular app in a new directory: `packages/client/`.** This is the new primary client. The React app remains in `client-react/` as a reference only.
4. **Work component by component.** Do not attempt to rewrite the entire frontend in one pass. For each page/component:
   - Read the React version to understand what it does
   - Rebuild it in Angular using Angular idioms (services, signals/RxJS, template syntax)
   - Ensure it connects to the same API endpoints
   - Verify visual parity with the React version
5. **Carry over styles directly.** Tailwind CSS utility classes are framework-agnostic and can be reused as-is from the React templates. Copy class strings from JSX into Angular templates.
6. **Carry over static assets.** Any images, icons, or fonts from the React app should be copied to the Angular app's `assets/` directory.

### What transfers directly from React → Angular:
- Tailwind CSS class strings (copy from JSX to Angular templates)
- API endpoint URLs and request/response shapes
- Route paths and page structure
- Static assets (images, icons, fonts)
- General component hierarchy and layout logic
- Data models / TypeScript interfaces

### What must be fully rewritten:
- Every component (JSX → Angular templates + TypeScript classes)
- State management (React hooks/Zustand → Angular services with signals or RxJS)
- Routing (React Router → Angular Router)
- HTTP layer (fetch/axios → Angular HttpClient)
- Context providers → Angular dependency injection
- Any React-specific libraries → Angular equivalents

---

## Core Features (MVP)

These features should all be present in the React reference app. Rebuild each one in Angular.

### 1. Media Library Management
- User designates one or more local folders containing media files (movies, TV shows, music)
- The server scans folders and indexes media files
- Automatic metadata fetching (poster art, descriptions, genres, cast) from public APIs (TMDB for film/TV, MusicBrainz for music)
- Library auto-updates when files are added or removed

### 2. Streaming & Playback
- Stream media from the host machine to any connected client (browser or smart TV)
- On-the-fly transcoding for device compatibility (fallback to direct play when possible)
- Resume playback across devices (track watch progress)
- Basic playback controls: play, pause, seek, volume, subtitles (if available in file)

### 3. Group Sharing
- Users can create or join groups (e.g., 5–20 people)
- Group members see a unified library combining all contributors' media
- Simple invite system (invite link or code)
- Each group member has their own profile (watch history, continue watching)

### 4. User Interface
- Clean, minimal browse/search interface (grid of posters)
- Detail pages for movies/shows with metadata
- Basic filtering: genre, media type, recently added
- **Match the existing React app's UI exactly** — use it as the visual spec

---

## Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────┐
│                 User's Machine                   │
│                                                  │
│  ┌─────────────┐   ┌────────────────────────┐   │
│  │ Media Files  │──▶│   Node.js Server       │   │
│  │ (local disk) │   │   (NO CHANGES)         │   │
│  └─────────────┘   │                        │   │
│                     │  - File indexing        │   │
│                     │  - Metadata fetching    │   │
│                     │  - Transcoding (FFmpeg) │   │
│                     │  - Streaming API        │   │
│                     │  - Auth & group mgmt    │   │
│                     │  - SQLite database      │   │
│                     └────────┬───────────────┘   │
│                              │                    │
└──────────────────────────────┼────────────────────┘
                               │ HTTP/HTTPS
                               ▼
              ┌────────────────────────────────┐
              │         Clients                │
              │  - Web app (Angular) ← NEW     │
              │  - Smart TV (Angular-based)    │
              │                                │
              │  - React app (reference only)  │
              └────────────────────────────────┘
```

### Key Architectural Decisions

- **True self-hosted:** The server runs entirely on the user's machine. No cloud dependency for core functionality.
- **Single binary / simple install:** Package the server so users run one installer or command. Avoid requiring manual Docker or terminal setup.
- **SQLite for storage:** No external database to configure. Stores library index, user profiles, watch progress, and group info locally.
- **FFmpeg for transcoding:** Industry standard, handles virtually all media formats. Bundle it or prompt the user to install it.
- **NAT traversal:** For remote access and group sharing, use a tunneling solution (see Networking section below).

---

## Recommended Tech Stack

### Server (Backend) — ALREADY BUILT, DO NOT MODIFY

| Component | Technology |
|-----------|------------|
| Runtime | **Node.js + TypeScript** |
| Framework | **Fastify** |
| Database | **SQLite via better-sqlite3** |
| Transcoding | **FFmpeg** (via fluent-ffmpeg) |
| Metadata | **TMDB API** + **MusicBrainz API** |
| File watching | **chokidar** |
| Auth | **JWT tokens** |

### Client (Frontend) — ANGULAR REWRITE

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | **Angular 18+ (standalone components)** | Developer's primary strength; strong TypeScript integration; standalone components reduce boilerplate |
| Build tool | **Angular CLI (esbuild)** | Built-in, fast builds with esbuild since Angular 17+ |
| Styling | **Tailwind CSS** | Already used in React app; classes transfer directly to Angular templates |
| Video player | **hls.js** or **Video.js** | HLS streaming in browser; same libraries work regardless of framework |
| State management | **Angular Signals** (preferred) or **RxJS** | Signals are simpler and more intuitive for component state; RxJS for async streams like search-as-you-type |
| HTTP | **Angular HttpClient** | Built-in, supports interceptors for JWT auth headers |
| Routing | **Angular Router** | Built-in, supports lazy loading for page-level code splitting |
| Forms | **Reactive Forms** | For settings, group creation, login/registration |

### Smart TV Apps

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Samsung (Tizen) | **Angular build output + config.xml** | Tizen runs standard web apps; `ng build` output deploys directly with a Tizen config wrapper |
| LG (webOS) | **Angular build output + appinfo.json** | webOS runs standard web apps; same Angular build with webOS config wrapper |
| TV navigation | **Custom D-pad directive** | Angular directive to handle arrow key / remote control focus management across components |

**Approach:** Build the web app first. Test in TV browsers for early validation. Later, wrap the same `ng build` output with platform config files for Tizen/webOS app store submission.

### Packaging & Distribution

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Desktop packaging | **Electron** (with embedded server) | Wraps server + UI into a single installable app. Users just download and run — no terminal needed |
| Alternative | **pkg** or **nexe** | Compile Node.js server into a standalone binary (lighter than Electron but no GUI tray icon) |

**Recommendation:** Use Electron for the host application. It provides a system tray icon, settings UI, and bundles the server. The actual media browsing/playback UI is the Angular web app served by the embedded server.

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

## Data Model (SQLite Schema — Simplified)

Already implemented in the server. The Angular app consumes this data via the API.

```
users
  - id, username, password_hash, display_name, created_at

groups
  - id, name, invite_code, created_by, created_at

group_members
  - group_id, user_id, role (admin/member), joined_at

media_items
  - id, title, type (movie/show/episode/song/album), year, genre
  - file_path, file_size, duration, codec_info
  - tmdb_id, poster_url, backdrop_url, description
  - contributed_by (user_id), group_id
  - added_at

watch_progress
  - user_id, media_item_id, position_seconds, completed, updated_at

seasons (for TV shows)
  - id, show_id (references media_items), season_number, title

episodes (for TV shows)
  - id, season_id, episode_number, title, file_path, duration
```

---

## Streaming Strategy

Already implemented in the server. The Angular app needs to support playback for these strategies:

### Direct Play (Preferred)
- If the client supports the file's codec natively, stream the file directly via HTTP range requests
- Use the HTML5 `<video>` element

### HLS Transcoding (Fallback)
- Server transcodes to HLS and provides an .m3u8 playlist URL
- Client uses **hls.js** to play the adaptive stream

### Subtitle Handling
- Server provides subtitles as WebVTT via API
- Angular video player component renders subtitle tracks

---

## Angular Project Structure

```
packages/client/                    # NEW Angular app
├── src/
│   ├── app/
│   │   ├── app.component.ts        # Root component
│   │   ├── app.routes.ts           # Route definitions
│   │   ├── app.config.ts           # App-level providers (HttpClient, Router)
│   │   │
│   │   ├── pages/                   # Route-level components (lazy loaded)
│   │   │   ├── browse/
│   │   │   │   └── browse.component.ts
│   │   │   ├── detail/
│   │   │   │   └── detail.component.ts
│   │   │   ├── player/
│   │   │   │   └── player.component.ts
│   │   │   ├── groups/
│   │   │   │   └── groups.component.ts
│   │   │   ├── settings/
│   │   │   │   └── settings.component.ts
│   │   │   └── login/
│   │   │       └── login.component.ts
│   │   │
│   │   ├── components/              # Shared UI components
│   │   │   ├── media-card/
│   │   │   │   └── media-card.component.ts
│   │   │   ├── video-player/
│   │   │   │   └── video-player.component.ts
│   │   │   ├── layout/
│   │   │   │   └── layout.component.ts
│   │   │   └── media-row/
│   │   │       └── media-row.component.ts
│   │   │
│   │   ├── services/                # Injectable services
│   │   │   ├── api.service.ts       # HttpClient wrapper for all API calls
│   │   │   ├── auth.service.ts      # JWT token management
│   │   │   ├── library.service.ts   # Media library state
│   │   │   └── player.service.ts    # Playback state & progress tracking
│   │   │
│   │   ├── guards/                  # Route guards
│   │   │   └── auth.guard.ts
│   │   │
│   │   ├── interceptors/            # HTTP interceptors
│   │   │   └── auth.interceptor.ts  # Attach JWT to outgoing requests
│   │   │
│   │   ├── models/                  # TypeScript interfaces
│   │   │   ├── media.model.ts
│   │   │   ├── user.model.ts
│   │   │   └── group.model.ts
│   │   │
│   │   └── directives/              # Custom directives
│   │       └── dpad-nav.directive.ts # D-pad navigation for TV remote support
│   │
│   ├── assets/                      # Copied from React app
│   ├── styles.css                   # Tailwind imports + global styles
│   ├── index.html
│   └── main.ts
│
├── angular.json
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.app.json
└── package.json

packages/client-react/              # EXISTING React app (reference only)
│   └── (existing React source — do not modify, use as design reference)

packages/server/                    # EXISTING backend (do not modify)
│   └── (existing server source)
```

---

## Angular Rewrite Phases

### Phase 1: Scaffold + Core Pages (focus here first)
1. Generate new Angular project with standalone components: `ng new client --standalone --style=css --routing`
2. Install and configure Tailwind CSS
3. Set up Angular HttpClient and auth interceptor
4. Create TypeScript interfaces/models (can copy from React app's types)
5. Build the API service matching the existing server endpoints
6. **Rebuild pages in this order** (examine the React version of each before building):
   - Layout (shell with nav) → reference `client-react/src/components/Layout.tsx`
   - Browse page (poster grid) → reference `client-react/src/pages/Browse.tsx`
   - Media Card component → reference `client-react/src/components/MediaCard.tsx`
   - Detail page → reference `client-react/src/pages/Detail.tsx`
   - Player page + Video Player component → reference `client-react/src/pages/Player.tsx`

### Phase 2: Auth + Groups
7. Login/Registration pages → reference React equivalents
8. Auth guard for protected routes
9. Groups page (create, join, manage) → reference React equivalent
10. Per-user watch history and profiles

### Phase 3: Settings + Polish
11. Settings page (folder management, account) → reference React equivalent
12. Continue Watching row on browse page
13. Search functionality
14. Error handling and loading states throughout

### Phase 4: Smart TV + Packaging
15. Create D-pad navigation directive for remote control support
16. Test Angular build in Samsung/LG TV browsers
17. Wrap `ng build` output for Tizen (config.xml) and webOS (appinfo.json)
18. Submit to Samsung TV Seller Office and LG Seller Lounge
19. Package server + Angular app into Electron for desktop distribution

---

## Key Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Angular rewrite diverges from React design | Always examine the React component before building the Angular version; aim for visual parity |
| NAT traversal complexity | Start with Tailscale; defer built-in tunneling |
| Transcoding performance on weak hardware | Default to direct play; make transcoding opt-in; show codec compatibility warnings |
| Smart TV app approval/distribution | Samsung and LG have free developer programs; alternatively, sideload or use the web app in the TV browser |
| Legal risk around sharing features | Position as personal media server; don't market sharing as primary feature; consult IP attorney |
| FFmpeg bundling and licensing | FFmpeg is LGPL/GPL — document this; consider prompting users to install it separately |

---

## Getting Started

To begin the Angular rewrite:

1. **Examine the existing React app first:** Browse `packages/client-react/src/` to understand the full component tree, pages, and features
2. **Scaffold the Angular project:** `cd packages && ng new client --standalone --style=css --routing`
3. **Set up Tailwind:** Follow Angular + Tailwind setup, copy `tailwind.config.js` settings from the React app
4. **Copy shared assets:** Move images, icons, and fonts from `client-react/src/assets/` to `client/src/assets/`
5. **Copy TypeScript interfaces:** Adapt type definitions from the React app to Angular models
6. **Start building component by component**, following the Phase 1 order above

This brief can be shared directly with Claude in VS Code (Claude Code) to begin the Angular rewrite.
