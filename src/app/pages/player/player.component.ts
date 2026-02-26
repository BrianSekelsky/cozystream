import {
  Component, inject, signal, computed, OnInit, OnDestroy,
  ElementRef, ViewChild,
} from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Location, CommonModule } from '@angular/common'
import { ApiService } from '../../services/api.service'
import { DisplaySettingsService } from '../../services/display-settings.service'
import { StreamInfo, PlayerSubtitleTrack } from '../../models/media.model'
import Hls from 'hls.js'

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './player.component.html',
})
export class PlayerComponent implements OnInit, OnDestroy {
  @ViewChild('videoEl') videoEl?: ElementRef<HTMLVideoElement>
  @ViewChild('progressBar') progressBar?: ElementRef<HTMLDivElement>

  private route = inject(ActivatedRoute)
  private router = inject(Router)
  private location = inject(Location)
  private api = inject(ApiService)
  ds = inject(DisplaySettingsService)

  // ── Stream state ────────────────────────────────────────────────────────

  streamUrl = signal('')
  streamInfo = signal<StreamInfo | null>(null)
  useHls = signal(false)
  unsupported = signal(false)
  loading = signal(true)

  // ── Playback state ──────────────────────────────────────────────────────

  isPlaying = signal(false)
  currentTime = signal(0)
  duration = signal(0)
  buffered = signal(0)
  volume = signal(1)
  isMuted = signal(false)
  isFullscreen = signal(false)

  // ── UI state ────────────────────────────────────────────────────────────

  controlsVisible = signal(true)
  showSubtitleMenu = signal(false)

  // ── Subtitle state ──────────────────────────────────────────────────────

  availableSubtitles = signal<PlayerSubtitleTrack[]>([])
  activeSubtitleIndex = signal<number | null>(null)

  // ── Computed ────────────────────────────────────────────────────────────

  progressPercent = computed(() => {
    const dur = this.duration()
    return dur > 0 ? (this.currentTime() / dur) * 100 : 0
  })

  bufferedPercent = computed(() => {
    const dur = this.duration()
    return dur > 0 ? (this.buffered() / dur) * 100 : 0
  })

  accentColor = computed(() => this.ds.settings().accentColor)

  // ── Private ─────────────────────────────────────────────────────────────

  private mediaId = 0
  private hls: Hls | null = null
  private progressInterval?: ReturnType<typeof setInterval>
  private controlsTimer?: ReturnType<typeof setTimeout>
  private startPosition = 0
  private knownDuration: number | null = null
  private savedTheme: string | null = null

  // ── Lifecycle ───────────────────────────────────────────────────────────

  ngOnInit() {
    // Force dark mode for the player (nav, scrollbars, etc.)
    this.savedTheme = document.documentElement.getAttribute('data-theme')
    document.documentElement.setAttribute('data-theme', 'dark')

    this.mediaId = Number(this.route.snapshot.paramMap.get('id'))
    this.startPosition = (history.state as any)?.startPosition ?? 0

    this.api.getStreamInfo(this.mediaId).subscribe({
      next: (info) => {
        this.streamInfo.set(info)
        this.buildSubtitleList(info)
        this.knownDuration = info.duration

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
        // Fallback: try direct play if info endpoint fails
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
    document.addEventListener('fullscreenchange', this.onFullscreenChange)
    this.startControlsAutoHide()
  }

  ngOnDestroy() {
    if (this.progressInterval) clearInterval(this.progressInterval)
    if (this.controlsTimer) clearTimeout(this.controlsTimer)

    const video = this.videoEl?.nativeElement
    if (video && video.currentTime > 0 && !video.ended) {
      const pos = video.currentTime + (this.useHls() ? this.startPosition : 0)
      this.api.saveProgress(this.mediaId, pos).subscribe()
    }

    if (this.hls) {
      this.hls.destroy()
      this.hls = null
    }

    // Kill any active transcode session
    if (this.useHls()) {
      this.api.killHlsSession(this.mediaId).subscribe()
    }

    document.removeEventListener('keydown', this.onKeyDown)
    document.removeEventListener('fullscreenchange', this.onFullscreenChange)

    // Restore the user's theme
    if (this.savedTheme) {
      document.documentElement.setAttribute('data-theme', this.savedTheme)
    }
  }

  // ── HLS initialization ──────────────────────────────────────────────────

  private initHls() {
    if (!Hls.isSupported()) {
      this.unsupported.set(true)
      this.loading.set(false)
      return
    }

    // Wait for the video element to be available via setTimeout
    setTimeout(() => {
      const video = this.videoEl?.nativeElement
      if (!video) {
        this.unsupported.set(true)
        this.loading.set(false)
        return
      }

      this.hls = new Hls()

      const hlsUrl = `/api/stream/${this.mediaId}/hls?start=${this.startPosition}`
      this.hls.loadSource(hlsUrl)
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

  // ── Subtitle list building ──────────────────────────────────────────────

  private buildSubtitleList(info: StreamInfo) {
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

  // ── Video event handlers ────────────────────────────────────────────────

  onTimeUpdate() {
    const video = this.videoEl?.nativeElement
    if (!video) return

    this.currentTime.set(video.currentTime + (this.useHls() ? this.startPosition : 0))

    // For HLS, video.duration grows as more segments arrive.
    // Use the known duration from the DB when available, otherwise
    // keep updating from the video element so the progress bar stays useful.
    if (this.knownDuration) {
      this.duration.set(this.knownDuration)
    } else if (video.duration && isFinite(video.duration)) {
      this.duration.set(video.duration + (this.useHls() ? this.startPosition : 0))
    }
  }

  onMetadataLoaded() {
    const video = this.videoEl?.nativeElement
    if (!video) return

    if (this.knownDuration) {
      this.duration.set(this.knownDuration)
    } else {
      this.duration.set(video.duration)
    }

    // Seek to start position for direct play
    if (!this.useHls() && this.startPosition > 0) {
      video.currentTime = this.startPosition
    }
  }

  onBufferUpdate() {
    const video = this.videoEl?.nativeElement
    if (video && video.buffered.length > 0) {
      this.buffered.set(video.buffered.end(video.buffered.length - 1))
    }
  }

  onVolumeChange() {
    const video = this.videoEl?.nativeElement
    if (video) {
      this.volume.set(video.volume)
      this.isMuted.set(video.muted)
    }
  }

  onVideoEnded() {
    const dur = this.knownDuration ?? this.videoEl?.nativeElement?.duration ?? 0
    if (dur > 0) {
      this.api.saveProgress(this.mediaId, dur, true).subscribe()
    }
    this.isPlaying.set(false)
    this.controlsVisible.set(true)
  }

  onVideoError() {
    // Only mark unsupported if we're in direct-play mode and actually have a src set
    // (avoid false positives during loading or HLS init)
    const video = this.videoEl?.nativeElement
    if (!this.useHls() && !this.loading() && video?.src) {
      this.unsupported.set(true)
    }
  }

  // ── Player controls ─────────────────────────────────────────────────────

  togglePlayPause(event?: MouseEvent) {
    if (event && (event.target as HTMLElement).closest('.player-controls')) return

    const video = this.videoEl?.nativeElement
    if (!video) return

    if (video.paused) {
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }

  seekTo(event: MouseEvent) {
    const video = this.videoEl?.nativeElement
    const bar = this.progressBar?.nativeElement
    if (!video || !bar) return

    const rect = bar.getBoundingClientRect()
    const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    const totalDuration = this.knownDuration ?? video.duration

    if (this.useHls()) {
      // For HLS, seeking to an absolute position in the movie requires
      // the seek target relative to the transcode start offset
      const absoluteTime = percent * totalDuration
      const relativeTime = absoluteTime - this.startPosition
      video.currentTime = Math.max(0, relativeTime)
      this.currentTime.set(absoluteTime)
    } else {
      const seekTime = percent * totalDuration
      video.currentTime = seekTime
      this.currentTime.set(seekTime)
    }
  }

  toggleMute() {
    const video = this.videoEl?.nativeElement
    if (video) {
      video.muted = !video.muted
    }
  }

  setVolume(event: Event) {
    const video = this.videoEl?.nativeElement
    const input = event.target as HTMLInputElement
    if (video) {
      video.volume = parseFloat(input.value)
      video.muted = false
    }
  }

  toggleFullscreen() {
    const container = this.videoEl?.nativeElement.closest('.player-container') as HTMLElement
    if (!container) return

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else {
      container.requestFullscreen().catch(() => {})
    }
  }

  private onFullscreenChange = () => {
    this.isFullscreen.set(!!document.fullscreenElement)
  }

  // ── Subtitle selection ──────────────────────────────────────────────────

  selectSubtitle(trackIndex: number | null) {
    this.activeSubtitleIndex.set(trackIndex)
    this.showSubtitleMenu.set(false)

    const video = this.videoEl?.nativeElement
    if (!video) return

    // Remove existing track elements
    const existingTracks = video.querySelectorAll('track')
    existingTracks.forEach(t => t.remove())

    // Disable all existing text tracks
    for (let i = 0; i < video.textTracks.length; i++) {
      video.textTracks[i].mode = 'disabled'
    }

    if (trackIndex === null) return

    // Find the selected subtitle info for label/language
    const subInfo = this.availableSubtitles().find(s => s.index === trackIndex)

    // Fetch the VTT content and create a blob URL
    // (avoids cross-origin issues with <track> element src)
    fetch(this.api.subtitleUrl(this.mediaId, trackIndex))
      .then(res => {
        if (!res.ok) throw new Error(`Subtitle fetch failed: ${res.status}`)
        return res.text()
      })
      .then(vttText => {
        const blob = new Blob([vttText], { type: 'text/vtt' })
        const blobUrl = URL.createObjectURL(blob)

        const track = document.createElement('track')
        track.kind = 'subtitles'
        track.src = blobUrl
        track.label = subInfo?.label ?? 'Subtitles'
        track.srclang = subInfo?.language ?? 'en'
        track.default = true
        video.appendChild(track)

        // Force the track to show
        setTimeout(() => {
          const lastTrack = video.textTracks[video.textTracks.length - 1]
          if (lastTrack) {
            lastTrack.mode = 'showing'
          }
        }, 50)
      })
      .catch(err => {
        console.error('[player] Failed to load subtitle:', err)
      })
  }

  // ── Keyboard shortcuts ──────────────────────────────────────────────────

  private onKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return

    const video = this.videoEl?.nativeElement
    if (!video) return

    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault()
        video.paused ? video.play().catch(() => {}) : video.pause()
        break
      case 'ArrowLeft':
        e.preventDefault()
        video.currentTime = Math.max(0, video.currentTime - 10)
        break
      case 'ArrowRight':
        e.preventDefault()
        video.currentTime = Math.min(video.duration, video.currentTime + 10)
        break
      case 'ArrowUp':
        e.preventDefault()
        video.volume = Math.min(1, video.volume + 0.1)
        break
      case 'ArrowDown':
        e.preventDefault()
        video.volume = Math.max(0, video.volume - 0.1)
        break
      case 'f':
        e.preventDefault()
        this.toggleFullscreen()
        break
      case 'm':
        e.preventDefault()
        this.toggleMute()
        break
      case 'c':
        e.preventDefault()
        this.showSubtitleMenu.set(!this.showSubtitleMenu())
        break
    }

    this.showControls()
  }

  // ── Controls visibility ─────────────────────────────────────────────────

  showControls() {
    this.controlsVisible.set(true)
    this.startControlsAutoHide()
  }

  private startControlsAutoHide() {
    if (this.controlsTimer) clearTimeout(this.controlsTimer)
    this.controlsTimer = setTimeout(() => {
      if (this.isPlaying() && !this.showSubtitleMenu()) {
        this.controlsVisible.set(false)
      }
    }, 3000)
  }

  // ── Utilities ───────────────────────────────────────────────────────────

  formatTime(seconds: number): string {
    if (!seconds || !isFinite(seconds)) return '0:00'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }
    return `${m}:${String(s).padStart(2, '0')}`
  }

  goBack() {
    this.location.back()
  }
}
