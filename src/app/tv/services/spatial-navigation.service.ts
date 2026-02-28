import { Injectable, inject, OnDestroy } from '@angular/core'
import { Router } from '@angular/router'

/** Key codes for webOS remote and standard keyboard */
const KEY = {
  UP: 'ArrowUp',
  DOWN: 'ArrowDown',
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
  ENTER: 'Enter',
  BACK: 'GoBack',       // webOS keyCode 461
  BACK_CODE: 461,
  ESCAPE: 'Escape',
} as const

interface FocusableRect {
  el: HTMLElement
  rect: DOMRect
}

@Injectable({ providedIn: 'root' })
export class SpatialNavigationService implements OnDestroy {
  private router = inject(Router)
  private keyHandler = this.onKeyDown.bind(this)

  init(): void {
    document.addEventListener('keydown', this.keyHandler)
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.keyHandler)
  }

  /** Focus the first focusable element in a container, or globally */
  focusFirst(container?: HTMLElement): void {
    const root = container ?? document.body
    const el = root.querySelector<HTMLElement>('[tabindex], button, a, input, [data-tv-focus]')
    el?.focus()
  }

  /** Focus a specific element by selector */
  focusSelector(selector: string): void {
    const el = document.querySelector<HTMLElement>(selector)
    el?.focus()
  }

  private onKeyDown(e: KeyboardEvent): void {
    // Handle webOS Back button (keyCode 461)
    if (e.keyCode === KEY.BACK_CODE || e.key === KEY.BACK || e.key === KEY.ESCAPE) {
      e.preventDefault()
      e.stopPropagation()
      this.router.navigateByUrl(this.getBackRoute())
      return
    }

    // Arrow key navigation
    if (e.key === KEY.UP || e.key === KEY.DOWN || e.key === KEY.LEFT || e.key === KEY.RIGHT) {
      const focused = document.activeElement as HTMLElement
      if (!focused || focused === document.body) {
        // Nothing focused — focus first available element
        this.focusFirst()
        e.preventDefault()
        return
      }

      // Don't interfere with input fields for left/right (cursor movement)
      if (focused.tagName === 'INPUT' && (e.key === KEY.LEFT || e.key === KEY.RIGHT)) {
        return
      }

      const next = this.findNextFocusable(focused, e.key)
      if (next) {
        e.preventDefault()
        next.focus()
        next.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
      }
    }
  }

  private findNextFocusable(current: HTMLElement, direction: string): HTMLElement | null {
    const all = this.getAllFocusable()
    if (all.length === 0) return null

    const currentRect = current.getBoundingClientRect()
    const cx = currentRect.left + currentRect.width / 2
    const cy = currentRect.top + currentRect.height / 2

    let best: HTMLElement | null = null
    let bestScore = Infinity

    for (const { el, rect } of all) {
      if (el === current) continue

      const ex = rect.left + rect.width / 2
      const ey = rect.top + rect.height / 2

      // Check if the element is in the right direction
      let valid = false
      switch (direction) {
        case KEY.UP:    valid = ey < cy - 5; break
        case KEY.DOWN:  valid = ey > cy + 5; break
        case KEY.LEFT:  valid = ex < cx - 5; break
        case KEY.RIGHT: valid = ex > cx + 5; break
      }
      if (!valid) continue

      // Score: prefer elements that are more aligned on the cross-axis
      const dx = ex - cx
      const dy = ey - cy

      let score: number
      if (direction === KEY.UP || direction === KEY.DOWN) {
        // For vertical movement, prioritize vertical proximity, penalize horizontal distance
        score = Math.abs(dy) + Math.abs(dx) * 3
      } else {
        // For horizontal movement, prioritize horizontal proximity, penalize vertical distance
        score = Math.abs(dx) + Math.abs(dy) * 3
      }

      if (score < bestScore) {
        bestScore = score
        best = el
      }
    }

    return best
  }

  private getAllFocusable(): FocusableRect[] {
    const elements = document.querySelectorAll<HTMLElement>(
      '[tabindex]:not([tabindex="-1"]), button:not(:disabled), a[href], input:not(:disabled), [data-tv-focus]'
    )

    const result: FocusableRect[] = []
    elements.forEach((el) => {
      const rect = el.getBoundingClientRect()
      // Only include visible elements
      if (rect.width > 0 && rect.height > 0) {
        result.push({ el, rect })
      }
    })
    return result
  }

  private getBackRoute(): string {
    // Navigate back through route hierarchy
    const url = this.router.url
    if (url.startsWith('/player/')) return url.replace('/player/', '/detail/')
    if (url.startsWith('/detail/')) return '/browse'
    if (url === '/login') return '/setup'
    return '/browse'
  }
}
