import {
  Component, ChangeDetectionStrategy, inject, signal, computed,
  OnInit, OnDestroy, ElementRef, ViewChild,
} from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { ApiService } from '../../../services/api.service'
import { WebosPlatformService } from '../../services/webos-platform.service'
import type { StreamInfo, PlayerSubtitleTrack } from '../../../models/media.model'
import Hls from 'hls.js'
import { TvAuthService } from '../../services/tv-auth.service'

@Component({
  selector: 'tv-player',
  standalone: true,
  template: `
    <div class="player-container" (mousemove)="showControls()" (click)="togglePlayPause()">
      @if (loading()) {
        <div class="player-loading">Loading...</div>
      }

      @if (unsupported()) {
        <div class="player-error">
          <p>This format is not supported for playback.</p>
          <button class="tv-button tv-button-primary" (click)="goBack()" tabindex="0">
            Go Back
          </button>
        </div>
      }

      <video
        #videoEl
        [src]="useHls() ? undefined : streamUrl()"
        (timeupdate)="onTimeUpdate()"
        (loadedmetadata)="onMetadataLoaded()"
        (progress)="onBufferUpdate()"
        (volumechange)="onVolumeChange()"
        (play)="isPlaying.set(true)"
        (pause)="isPlaying.set(false)"
        (ended)="onVideoEnded()"
        (error)="onVideoError()"
        autoplay
        playsinline
        class="player-video"
      ></video>

      <!-- Controls overlay -->
      <div class="player-controls" [class.visible]="controlsVisible()" (click)="$event.stopPropagation()">
        <!-- Progress bar -->
        <div class="player-progress" #progressBar (click)="seekTo($event)">
          <div class="player-buffered" [style.width.%]="bufferedPercent()"></div>
          <div class="player-played" [style.width.%]="progressPercent()"></div>
        </div>

        <div class="player-controls-row">
          <div class="player-time">
            {{ formatTime(currentTime()) }} / {{ formatTime(duration()) }}
          </div>

          <div class="player-center-controls">
            <button class="player-btn" (click)="seekRelative(-30)" tabindex="0">-30s</button>
            <button class="player-btn" (click)="seekRelative(-10)" tabindex="0">-10s</button>
            <button class="player-btn player-btn-play" (click)="togglePlayPause()" tabindex="0">
              {{ isPlaying() ? 'Pause' : 'Play' }}
            </button>
            <button class="player-btn" (click)="seekRelative(10)" tabindex="0">+10s</button>
            <button class="player-btn" (click)="seekRelative(30)" tabindex="0">+30s</button>
          </div>

          <div class="player-right-controls">
            @if (availableSubtitles().length > 0) {
              <button class="player-btn" (click)="toggleSubtitleMenu()" tabindex="0">
                CC {{ activeSubtitleIndex() !== null ? 'On' : 'Off' }}
              </button>
            }
          </div>
        </div>

        <!-- Subtitle menu overlay -->
        @if (showSubtitleMenu()) {
          <div class="subtitle-menu" (click)="$event.stopPropagation()">
            <button
              class="subtitle-option tv-focusable"
              [class.active]="activeSubtitleIndex() === null"
              (click)="selectSubtitle(null)"
              tabindex="0"
            >
              Off
            </button>
            @for (sub of availableSubtitles(); track sub.index) {
              <button
                class="subtitle-option tv-focusable"
                [class.active]="activeSubtitleIndex() === sub.index"
                (click)="selectSubtitle(sub.index)"
                tabindex="0"
              >
                {{ sub.label }}
              </button>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .player-container {
      position: relative;
      width: 1920px;
      height: 1080px;
      background: #000;
      overflow: hidden;
      cursor: none;
    }
    .player-video {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .player-loading, .player-error {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1.5rem;
      font-size: 1.3rem;
      color: #ccc;
      z-index: 20;
      background: rgba(0,0,0,0.8);
    }
    .player-controls {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 1.5rem 3rem 2rem;
      background: linear-gradient(transparent, rgba(0,0,0,0.9));
      opacity: 0;
      transition: opacity 0.3s ease;
      z-index: 10;
    }
    .player-controls.visible {
      opacity: 1;
      cursor: default;
    }
    .player-progress {
      position: relative;
      width: 100%;
      height: 6px;
      background: #333;
      border-radius: 3px;
      cursor: pointer;
      margin-bottom: 1rem;
    }
    .player-buffered {
      position: absolute;
      height: 100%;
      background: #555;
      border-radius: 3px;
    }
    .player-played {
      position: absolute;
      height: 100%;
      background: var(--accent-color, #6366f1);
      border-radius: 3px;
    }
    .player-controls-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .player-time {
      font-size: 0.9rem;
      color: #ccc;
      min-width: 150px;
    }
    .player-center-controls {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .player-right-controls {
      display: flex;
      align-items: center;
      gap: 1rem;
      min-width: 150px;
      justify-content: flex-end;
    }
    .player-btn {
      padding: 0.5rem 1rem;
      font-size: 0.9rem;
      color: #e5e5e5;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 0.375rem;
      cursor: pointer;
    }
    .player-btn:focus {
      outline: var(--focus-ring);
      outline-offset: 2px;
    }
    .player-btn-play {
      padding: 0.5rem 2rem;
      font-size: 1.1rem;
      font-weight: 600;
    }
    .subtitle-menu {
      position: absolute;
      bottom: 100%;
      right: 3rem;
      background: rgba(20,20,20,0.95);
      border-radius: 0.5rem;
      padding: 0.5rem;
      margin-bottom: 0.5rem;
      min-width: 200px;
    }
    .subtitle-option {
      display: block;
      width: 100%;
      padding: 0.75rem 1rem;
      font-size: 0.95rem;
      color: #ccc;
      background: transparent;
      border: none;
      border-radius: 0.375rem;
      text-align: left;
      cursor: pointer;
    }
    .subtitle-option.active {
      color: var(--accent-color, #6366f1);
      font-weight: 600;
    }
    .subtitle-option:focus {
      outline: var(--focus-ring);
      outline-offset: -2px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvPlayerComponent implements OnInit, OnDestroy {
  @ViewChild('videoEl') videoEl?: ElementRef<HTMLVideoElement>
  @ViewChild('progressBar') progressBar?: ElementRef<HTMLDivElement>

  private route = inject(ActivatedRoute)
  private router = inject(Router)
  private api = inject(ApiService)
  private platform = inject(WebosPlatformService)
  private tvAuth = inject(TvAuthService)

  // Stream state
  streamUrl = signal('')
  useHls = signal(false)
  unsupported = signal(false)
  loading = signal(true)

  // Playback state
  isPlaying = signal(false)
  currentTime = signal(0)
  duration = signal(0)
  buffered = signal(0)
  volume = signal(1)

  // UI state
  controlsVisible = signal(true)
  showSubtitleMenu = signal(false)

  // Subtitles
  availableSubtitles = signal<PlayerSubtitleTrack[]>([])
  activeSubtitleIndex = signal<number | null>(null)

  // Computed
  progressPercent = computed(() => {
    const dur = this.duration()
    return dur > 0 ? (this.currentTime() / dur) * 100 : 0
  })

  bufferedPercent = computed(() => {
    const dur = this.duration()
    return dur > 0 ? (this.buffered() / dur) * 100 : 0
  })

  // Private
  private mediaId = 0
  private hls: Hls | null = null
  private progressInterval?: ReturnType<typeof setInterval>
  private controlsTimer?: ReturnType<typeof setTimeout>
  private startPosition = 0
  private knownDuration: number | null = null
  private currentSubtitleBlobUrl: string | null = null

  // Media key codes (webOS)
  private static MEDIA_PLAY = 415
  private static MEDIA_PAUSE = 19
  private static MEDIA_STOP = 413
  private static MEDIA_REWIND = 412
  private static MEDIA_FORWARD = 417

  ngOnInit(): void {
    this.mediaId = Number(this.route.snapshot.paramMap.get('id'))
    this.startPosition = (history.state as any)?.startPosition ?? 0

    this.platform.keepScreenOn(true)

    this.api.getStreamInfo(this.mediaId).subscribe({
      next: (info) => {
        this.knownDuration = info.duration
        this.buildSubtitleList(info)

        if (info.canDirectPlay) {
          this.streamUrl.set(info.directPlayUrl)
          this.useHls.set(false)
          this.loading.set(false)
        } else {
          this.useHls.set(true)
          this.initHls()
        }
      },
      error: () => {
        this.streamUrl.set(this.api.streamUrl(this.mediaId))
        this.useHls.set(false)
        this.loading.set(false)
      },
    })

    // Save progress every 10 seconds
    this.progressInterval = setInterval(() => {
      const video = this.videoEl?.nativeElement
      if (video && !video.paused && video.currentTime > 0) {
        const pos = video.currentTime + (this.useHls() ? this.startPosition : 0)
        const dur = this.knownDuration ?? video.duration
        const completed = dur > 0 && (dur - pos) < 60
        this.api.saveProgress(this.mediaId, pos, completed).subscribe()
      }
    }, 10000)

    document.addEventListener('keydown', this.onKeyDown)
    this.startControlsAutoHide()
  }

  ngOnDestroy(): void {
    if (this.progressInterval) clearInterval(this.progressInterval)
    if (this.controlsTimer) clearTimeout(this.controlsTimer)

    this.platform.keepScreenOn(false)

    const video = this.videoEl?.nativeElement
    if (video && video.currentTime > 0 && !video.ended) {
      const pos = video.currentTime + (this.useHls() ? this.startPosition : 0)
      this.api.saveProgress(this.mediaId, pos).subscribe()
    }

    if (this.hls) {
      this.hls.destroy()
      this.hls = null
    }

    if (this.useHls()) {
      this.api.killHlsSession(this.mediaId).subscribe()
    }

    document.removeEventListener('keydown', this.onKeyDown)

    if (this.currentSubtitleBlobUrl) {
      URL.revokeObjectURL(this.currentSubtitleBlobUrl)
    }
  }

  // HLS
  private initHls(): void {
    if (!Hls.isSupported()) {
      this.unsupported.set(true)
      this.loading.set(false)
      return
    }

    setTimeout(() => {
      const video = this.videoEl?.nativeElement
      if (!video) {
        this.unsupported.set(true)
        this.loading.set(false)
        return
      }

      const token = this.tvAuth.getToken()
      this.hls = new Hls({
        xhrSetup: (xhr) => {
          if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`)
          }
        },
      })

      const hlsUrl = `${this.api.streamUrl(this.mediaId)}/hls?start=${this.startPosition}`
      // For TV, streamUrl already returns full URL
      this.hls.loadSource(hlsUrl.replace('/stream/', '/stream/'))
      this.hls.attachMedia(video)

      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        this.loading.set(false)
        video.play().catch(() => {})
      })

      this.hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          this.unsupported.set(true)
          this.loading.set(false)
        }
      })
    }, 0)
  }

  // Subtitle list
  private buildSubtitleList(info: StreamInfo): void {
    const subs: PlayerSubtitleTrack[] = []
    for (const track of info.subtitleTracks) {
      if (!track.extractable) continue
      subs.push({
        index: track.index,
        label: track.title || track.language || `Track ${track.index}`,
        language: track.language,
        type: 'embedded',
      })
    }
    for (const ext of info.externalSubtitles) {
      subs.push({
        index: ext.index,
        label: ext.language
          ? `${ext.language}${ext.forced ? ' (Forced)' : ''}`
          : `External ${ext.index - 999}`,
        language: ext.language,
        type: 'external',
      })
    }
    this.availableSubtitles.set(subs)
  }

  // Video events
  onTimeUpdate(): void {
    const video = this.videoEl?.nativeElement
    if (!video) return
    this.currentTime.set(video.currentTime + (this.useHls() ? this.startPosition : 0))
    if (this.knownDuration) {
      this.duration.set(this.knownDuration)
    } else if (video.duration && isFinite(video.duration)) {
      this.duration.set(video.duration + (this.useHls() ? this.startPosition : 0))
    }
  }

  onMetadataLoaded(): void {
    const video = this.videoEl?.nativeElement
    if (!video) return
    if (this.knownDuration) {
      this.duration.set(this.knownDuration)
    } else {
      this.duration.set(video.duration)
    }
    if (!this.useHls() && this.startPosition > 0) {
      video.currentTime = this.startPosition
    }
  }

  onBufferUpdate(): void {
    const video = this.videoEl?.nativeElement
    if (video && video.buffered.length > 0) {
      this.buffered.set(video.buffered.end(video.buffered.length - 1))
    }
  }

  onVolumeChange(): void {
    const video = this.videoEl?.nativeElement
    if (video) this.volume.set(video.volume)
  }

  onVideoEnded(): void {
    const dur = this.knownDuration ?? this.videoEl?.nativeElement?.duration ?? 0
    if (dur > 0) {
      this.api.saveProgress(this.mediaId, dur, true).subscribe()
    }
    this.isPlaying.set(false)
    this.controlsVisible.set(true)
  }

  onVideoError(): void {
    const video = this.videoEl?.nativeElement
    if (!this.useHls() && !this.loading() && video?.src) {
      this.unsupported.set(true)
    }
  }

  // Controls
  togglePlayPause(): void {
    const video = this.videoEl?.nativeElement
    if (!video) return
    if (video.paused) {
      video.play().catch(() => {})
    } else {
      video.pause()
    }
    this.showControls()
  }

  seekRelative(seconds: number): void {
    const video = this.videoEl?.nativeElement
    if (!video) return
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds))
    this.showControls()
  }

  seekTo(event: MouseEvent): void {
    const video = this.videoEl?.nativeElement
    const bar = this.progressBar?.nativeElement
    if (!video || !bar) return

    const rect = bar.getBoundingClientRect()
    const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    const totalDuration = this.knownDuration ?? video.duration

    if (this.useHls()) {
      const absoluteTime = percent * totalDuration
      video.currentTime = Math.max(0, absoluteTime - this.startPosition)
      this.currentTime.set(absoluteTime)
    } else {
      const seekTime = percent * totalDuration
      video.currentTime = seekTime
      this.currentTime.set(seekTime)
    }
  }

  toggleSubtitleMenu(): void {
    this.showSubtitleMenu.set(!this.showSubtitleMenu())
  }

  selectSubtitle(trackIndex: number | null): void {
    this.activeSubtitleIndex.set(trackIndex)
    this.showSubtitleMenu.set(false)

    const video = this.videoEl?.nativeElement
    if (!video) return

    const existingTracks = video.querySelectorAll('track')
    existingTracks.forEach(t => t.remove())

    if (this.currentSubtitleBlobUrl) {
      URL.revokeObjectURL(this.currentSubtitleBlobUrl)
      this.currentSubtitleBlobUrl = null
    }

    for (let i = 0; i < video.textTracks.length; i++) {
      video.textTracks[i].mode = 'disabled'
    }

    if (trackIndex === null) return

    const subInfo = this.availableSubtitles().find(s => s.index === trackIndex)
    const subUrl = this.api.subtitleUrl(this.mediaId, trackIndex)
    const token = this.tvAuth.getToken()

    fetch(subUrl, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(res => {
        if (!res.ok) throw new Error(`Subtitle fetch failed: ${res.status}`)
        return res.text()
      })
      .then(vttText => {
        const blob = new Blob([vttText], { type: 'text/vtt' })
        const blobUrl = URL.createObjectURL(blob)
        this.currentSubtitleBlobUrl = blobUrl

        const track = document.createElement('track')
        track.kind = 'subtitles'
        track.src = blobUrl
        track.label = subInfo?.label ?? 'Subtitles'
        track.srclang = subInfo?.language ?? 'en'
        track.default = true
        video.appendChild(track)

        setTimeout(() => {
          const lastTrack = video.textTracks[video.textTracks.length - 1]
          if (lastTrack) lastTrack.mode = 'showing'
        }, 50)
      })
      .catch(err => console.error('[tv-player] Subtitle error:', err))
  }

  // Keyboard / remote
  private onKeyDown = (e: KeyboardEvent): void => {
    const video = this.videoEl?.nativeElement
    if (!video) return

    // Media keys (webOS remote)
    switch (e.keyCode) {
      case TvPlayerComponent.MEDIA_PLAY:
      case TvPlayerComponent.MEDIA_PAUSE:
        e.preventDefault()
        this.togglePlayPause()
        return
      case TvPlayerComponent.MEDIA_STOP:
        e.preventDefault()
        this.goBack()
        return
      case TvPlayerComponent.MEDIA_REWIND:
        e.preventDefault()
        this.seekRelative(-30)
        return
      case TvPlayerComponent.MEDIA_FORWARD:
        e.preventDefault()
        this.seekRelative(30)
        return
    }

    // Standard keys
    switch (e.key) {
      case ' ':
      case 'Enter':
        // Only handle Enter if not focused on a button
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'BUTTON') return
        e.preventDefault()
        this.togglePlayPause()
        break
      case 'ArrowLeft':
        if (!this.showSubtitleMenu()) {
          e.preventDefault()
          this.seekRelative(-10)
        }
        break
      case 'ArrowRight':
        if (!this.showSubtitleMenu()) {
          e.preventDefault()
          this.seekRelative(10)
        }
        break
    }

    this.showControls()
  }

  // Controls visibility
  showControls(): void {
    this.controlsVisible.set(true)
    this.startControlsAutoHide()
  }

  private startControlsAutoHide(): void {
    if (this.controlsTimer) clearTimeout(this.controlsTimer)
    this.controlsTimer = setTimeout(() => {
      if (this.isPlaying() && !this.showSubtitleMenu()) {
        this.controlsVisible.set(false)
      }
    }, 5000)
  }

  // Utilities
  formatTime(seconds: number): string {
    if (!seconds || !isFinite(seconds)) return '0:00'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
  }

  goBack(): void {
    this.router.navigate(['/detail', this.mediaId])
  }
}
