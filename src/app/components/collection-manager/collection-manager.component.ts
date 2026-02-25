import { Component, Output, EventEmitter, inject, signal, computed, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { RowOrderService, mergeRowOrder } from '../../services/row-order.service'
import { CollectionsService } from '../../services/collections.service'
import { Collection } from '../../models/media.model'

const DECADES = ['1920','1930','1940','1950','1960','1970','1980','1990','2000','2010','2020']

@Component({
  selector: 'app-collection-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './collection-manager.component.html',
})
export class CollectionManagerComponent implements OnInit {
  @Output() closed = new EventEmitter<void>()

  private rowOrderService = inject(RowOrderService)
  private collectionsService = inject(CollectionsService)

  rows = computed(() =>
    mergeRowOrder(
      this.rowOrderService.rawOrder(),
      this.collectionsService.collections().map((c) => c.id),
    )
  )

  dragIndex = signal<number | null>(null)
  dragOverIndex = signal<number | null>(null)

  // Inline rename
  editingId = signal<string | null>(null)
  editingLabel = ''

  // Add filter form
  showAddForm = signal(false)
  addLabel = ''
  addFilterType: 'genre' | 'director' | 'decade' = 'genre'
  addFilterValue = ''
  decades = DECADES

  hiddenCollections = computed(() => this.collectionsService.hiddenCollections())

  ngOnInit() {
    this.collectionsService.loadCollections()
  }

  close() { this.closed.emit() }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  getCollection(id: string): Collection | undefined {
    return this.collectionsService.collections().find((c) => c.id === id)
  }

  getLabel(id: string): string {
    return this.getCollection(id)?.name ?? ''
  }

  getSubtitle(id: string): string | null {
    const col = this.getCollection(id)
    if (!col?.filterType) return null
    return `${col.filterType}: ${col.filterType === 'decade' ? `${col.filterValue}s` : col.filterValue}`
  }

  isAuto(id: string): boolean {
    const col = this.getCollection(id)
    return col ? !col.isManual && !col.filterType : false
  }

  isFilter(id: string): boolean {
    return !!this.getCollection(id)?.filterType
  }

  getItemCount(id: string): number | null {
    const col = this.getCollection(id)
    if (!col || col.filterType) return null
    return col.itemIds.length
  }

  // ── Drag and drop ──────────────────────────────────────────────────────────

  onDragStart(index: number) { this.dragIndex.set(index) }
  onDragOver(e: DragEvent, index: number) { e.preventDefault(); this.dragOverIndex.set(index) }

  onDrop(toIndex: number) {
    const from = this.dragIndex()
    if (from === null || from === toIndex) { this.clearDrag(); return }
    const next = [...this.rows()]
    const [moved] = next.splice(from, 1)
    next.splice(toIndex, 0, moved)
    this.rowOrderService.saveOrder(next)
    this.clearDrag()
  }

  clearDrag() { this.dragIndex.set(null); this.dragOverIndex.set(null) }

  // ── Rename ─────────────────────────────────────────────────────────────────

  startEdit(id: string, e: Event) {
    e.stopPropagation()
    this.editingId.set(id)
    this.editingLabel = this.getLabel(id)
  }

  commitEdit(id: string) {
    const trimmed = this.editingLabel.trim()
    if (trimmed && trimmed !== this.getLabel(id)) {
      this.collectionsService.renameCollection(id, trimmed)
    }
    this.editingId.set(null)
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  deleteEntry(id: string) {
    this.collectionsService.removeCollection(id)
    this.rowOrderService.saveOrder(this.rows().filter((r) => r !== id))
  }

  // ── Restore hidden ─────────────────────────────────────────────────────────

  restoreCollection(id: string) {
    this.collectionsService.restoreCollection(id)
  }

  // ── Add filter collection ──────────────────────────────────────────────────

  setAddFilterType(t: string) {
    this.addFilterType = t as 'genre' | 'director' | 'decade'
    this.addFilterValue = ''
  }

  addFilterCollection() {
    if (!this.addLabel.trim() || !this.addFilterValue.trim()) return
    this.collectionsService.addFilterCollection(
      this.addLabel.trim(),
      this.addFilterType,
      this.addFilterValue.trim(),
    )
    this.addLabel = ''
    this.addFilterType = 'genre'
    this.addFilterValue = ''
    this.showAddForm.set(false)
  }
}
