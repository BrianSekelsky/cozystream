import { Component, inject, signal, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { Location } from '@angular/common'
import { ApiService } from '../../services/api.service'

@Component({
  selector: 'app-player',
  standalone: true,
  templateUrl: './player.component.html',
})
export class PlayerComponent implements OnInit, OnDestroy {
  @ViewChild('videoEl') videoEl?: ElementRef<HTMLVideoElement>

  private route = inject(ActivatedRoute)
  private router = inject(Router)
  private location = inject(Location)
  private api = inject(ApiService)

  streamUrl = signal('')
  unsupported = signal(false)
  private mediaId = 0
  private progressInterval?: ReturnType<typeof setInterval>

  ngOnInit() {
    this.mediaId = Number(this.route.snapshot.paramMap.get('id'))
    const startPosition = (history.state as any)?.startPosition ?? 0
    this.streamUrl.set(this.api.streamUrl(this.mediaId))

    // Seek to start position once video is ready
    setTimeout(() => {
      if (this.videoEl && startPosition > 0) {
        this.videoEl.nativeElement.currentTime = startPosition
      }
    }, 500)

    // Save progress every 10 seconds
    this.progressInterval = setInterval(() => {
      const video = this.videoEl?.nativeElement
      if (video && !video.paused && video.currentTime > 0) {
        const pos = video.currentTime
        const dur = video.duration
        const completed = dur > 0 && (dur - pos) < 60
        this.api.saveProgress(this.mediaId, pos, completed).subscribe()
      }
    }, 10000)
  }

  ngOnDestroy() {
    if (this.progressInterval) clearInterval(this.progressInterval)
    const video = this.videoEl?.nativeElement
    if (video && video.currentTime > 0 && !video.ended) {
      this.api.saveProgress(this.mediaId, video.currentTime).subscribe()
    }
  }

  onVideoEnded() {
    const video = this.videoEl?.nativeElement
    if (video) {
      this.api.saveProgress(this.mediaId, video.duration, true).subscribe()
    }
  }

  onVideoError() {
    this.unsupported.set(true)
  }

  goBack() {
    this.location.back()
  }
}
