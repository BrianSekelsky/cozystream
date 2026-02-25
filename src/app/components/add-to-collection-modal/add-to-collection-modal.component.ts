import { Component, Input, Output, EventEmitter, inject, signal, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { MediaItem, Collection } from '../../models/media.model'
import { ApiService } from '../../services/api.service'

@Component({
  selector: 'app-add-to-collection-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './add-to-collection-modal.component.html',
})
export class AddToCollectionModalComponent implements OnInit {
  @Input({ required: true }) item!: MediaItem
  @Output() closed = new EventEmitter<void>()

  private api = inject(ApiService)

  collections = signal<Collection[]>([])
  loading = signal(true)
  creating = signal(false)
  newName = ''

  ngOnInit() {
    this.api.getCollections().subscribe({
      next: (all) => {
        this.collections.set(all.filter((c) => c.isManual))
        this.loading.set(false)
      },
      error: () => this.loading.set(false),
    })
  }

  isInCollection(col: Collection): boolean {
    return col.itemIds.includes(this.item.id)
  }

  toggle(col: Collection) {
    if (this.isInCollection(col)) {
      this.api.removeFromCollection(col.id, this.item.id).subscribe(() => {
        this.collections.update((cols) =>
          cols.map((c) => c.id === col.id
            ? { ...c, itemIds: c.itemIds.filter((id) => id !== this.item.id) }
            : c
          )
        )
      })
    } else {
      this.api.addToCollection(col.id, this.item.id).subscribe(() => {
        this.collections.update((cols) =>
          cols.map((c) => c.id === col.id
            ? { ...c, itemIds: [...c.itemIds, this.item.id] }
            : c
          )
        )
      })
    }
  }

  createCollection() {
    const name = this.newName.trim()
    if (!name) return
    this.api.createCollection(name).subscribe((col) => {
      this.api.addToCollection(col.id, this.item.id).subscribe(() => {
        this.collections.update((cols) => [...cols, { ...col, itemIds: [this.item.id] }])
        this.newName = ''
        this.creating.set(false)
      })
    })
  }
}
