import {
  Component, Input, inject, signal,
  ViewChild, ElementRef, AfterViewInit, OnDestroy,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Collection, MediaItem } from '../../models/media.model'
import { MediaCardComponent } from '../media-card/media-card.component'
import { CollectionsService } from '../../services/collections.service'

const DECADES = ['1920','1930','1940','1950','1960','1970','1980','1990','2000','2010','2020']

@Component({
  selector: 'app-filter-row',
  standalone: true,
  imports: [CommonModule, FormsModule, MediaCardComponent],
  templateUrl: './filter-row.component.html',
})
export class FilterRowComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) collection!: Collection
  @Input({ required: true }) items: MediaItem[] = []

  @ViewChild('scrollEl') scrollEl!: ElementRef<HTMLDivElement>

  private collectionsService = inject(CollectionsService)

  canScrollLeft = signal(false)
  canScrollRight = signal(false)
  showEditor = signal(false)

  // Editor form state
  editorLabel = ''
  editorFilterType: 'genre' | 'director' | 'decade' = 'genre'
  editorFilterValue = ''
  decades = DECADES

  private ro?: ResizeObserver

  ngAfterViewInit() {
    const el = this.scrollEl?.nativeElement
    if (!el) return
    this.updateScrollState()
    el.addEventListener('scroll', this.updateScrollState.bind(this), { passive: true })
    this.ro = new ResizeObserver(() => this.updateScrollState())
    this.ro.observe(el)
  }

  ngOnDestroy() {
    const el = this.scrollEl?.nativeElement
    if (el) el.removeEventListener('scroll', this.updateScrollState.bind(this))
    this.ro?.disconnect()
  }

  updateScrollState() {
    const el = this.scrollEl?.nativeElement
    if (!el) return
    this.canScrollLeft.set(el.scrollLeft > 0)
    this.canScrollRight.set(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }

  scroll(direction: 'left' | 'right') {
    const el = this.scrollEl?.nativeElement
    if (!el) return
    const card = el.firstElementChild as HTMLElement | null
    const cardWidth = card ? card.offsetWidth + 12 : 200
    el.scrollBy({ left: direction === 'right' ? cardWidth * 3 : -(cardWidth * 3), behavior: 'smooth' })
  }

  openEditor() {
    this.editorLabel = this.collection.name
    this.editorFilterType = this.collection.filterType!
    this.editorFilterValue = this.collection.filterValue!
    this.showEditor.set(true)
  }

  setEditorFilterType(t: string) {
    this.editorFilterType = t as 'genre' | 'director' | 'decade'
    this.editorFilterValue = ''
  }

  saveEditor() {
    if (!this.editorLabel.trim() || !this.editorFilterValue.trim()) return
    this.collectionsService.updateFilterCollection(this.collection.id, {
      name: this.editorLabel.trim(),
      filterType: this.editorFilterType,
      filterValue: this.editorFilterValue.trim(),
    })
    this.showEditor.set(false)
  }
}
