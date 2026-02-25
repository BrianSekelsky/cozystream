import { Injectable, inject, signal, computed, effect } from '@angular/core'
import { ApiService } from './api.service'
import { Collection, MediaItem } from '../models/media.model'

// ── Storage keys ────────────────────────────────────────────────────────────

const OVERRIDES_KEY = 'cozystream:collection-overrides'
const FILTERS_KEY = 'cozystream:filter-collections'
const OLD_CATEGORIES_KEY = 'cozystream:categories'

// ── Default filter collections ──────────────────────────────────────────────

const DEFAULT_FILTERS: Collection[] = [
  { id: 'horror',    name: 'Horror',          itemIds: [], isManual: false, filterType: 'genre', filterValue: 'Horror' },
  { id: 'scifi',     name: 'Science Fiction',  itemIds: [], isManual: false, filterType: 'genre', filterValue: 'Science Fiction' },
  { id: 'comedy',    name: 'Comedy',           itemIds: [], isManual: false, filterType: 'genre', filterValue: 'Comedy' },
  { id: 'animation', name: 'Animation',        itemIds: [], isManual: false, filterType: 'genre', filterValue: 'Animation' },
  { id: 'drama',     name: 'Drama',            itemIds: [], isManual: false, filterType: 'genre', filterValue: 'Drama' },
]

// ── Override helpers ────────────────────────────────────────────────────────

interface Override {
  name?: string
  hidden?: boolean
}

function loadOverrides(): Record<string, Override> {
  try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY) ?? '{}') }
  catch { return {} }
}

function saveOverrides(overrides: Record<string, Override>) {
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides))
}

function applyOverrides(all: Collection[], overrides: Record<string, Override>): Collection[] {
  return all
    .filter((c) => !overrides[c.id]?.hidden)
    .map((c) => overrides[c.id]?.name ? { ...c, name: overrides[c.id].name! } : c)
}

// ── Filter collection persistence ───────────────────────────────────────────

function loadFilterCollections(): Collection[] {
  // Migration: convert old categories format
  const oldRaw = localStorage.getItem(OLD_CATEGORIES_KEY)
  if (oldRaw) {
    try {
      const oldCats = JSON.parse(oldRaw) as Array<{ id: string; label: string; filterType: string; filterValue: string }>
      const migrated: Collection[] = oldCats.map((c) => ({
        id: c.id,
        name: c.label,
        itemIds: [],
        isManual: false,
        filterType: c.filterType as 'genre' | 'director' | 'decade',
        filterValue: c.filterValue,
      }))
      localStorage.setItem(FILTERS_KEY, JSON.stringify(migrated))
      localStorage.removeItem(OLD_CATEGORIES_KEY)
      return migrated
    } catch { /* fall through */ }
  }

  try {
    const raw = localStorage.getItem(FILTERS_KEY)
    if (!raw) return DEFAULT_FILTERS
    return JSON.parse(raw) as Collection[]
  } catch {
    return DEFAULT_FILTERS
  }
}

function saveFilterCollections(filters: Collection[]) {
  localStorage.setItem(FILTERS_KEY, JSON.stringify(filters))
}

// ── Filter matching (exported for use in browse page) ───────────────────────

export function matchesFilter(item: MediaItem, col: Collection): boolean {
  if (col.filterType === 'genre') {
    if (!item.genre) return false
    const genres = item.genre.split(',').map((g) => g.trim().toLowerCase())
    return genres.includes(col.filterValue!.toLowerCase())
  }
  if (col.filterType === 'director') {
    if (!item.director) return false
    return item.director.toLowerCase().includes(col.filterValue!.toLowerCase())
  }
  if (col.filterType === 'decade') {
    if (!item.year) return false
    const decade = Math.floor(item.year / 10) * 10
    return String(decade) === col.filterValue
  }
  return false
}

// ── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class CollectionsService {
  private api = inject(ApiService)
  private apiCollections = signal<Collection[]>([])
  private filterCollections = signal<Collection[]>(loadFilterCollections())
  private overrides = signal<Record<string, Override>>(loadOverrides())

  collections = signal<Collection[]>([])

  hiddenCollections = computed(() => {
    const all = [...this.apiCollections(), ...this.filterCollections()]
    return all.filter((c) => !c.isManual && this.overrides()[c.id]?.hidden)
  })

  constructor() {
    effect(() => {
      saveFilterCollections(this.filterCollections())
    })
  }

  loadCollections() {
    this.api.getCollections().subscribe({
      next: (all) => {
        this.apiCollections.set(all)
        this.updateCollections()
      },
      error: () => {},
    })
  }

  // ── Item-based collection operations ────────────────────────────────────

  removeCollection(id: string) {
    // Check if it's a filter collection
    const filter = this.filterCollections().find((c) => c.id === id)
    if (filter) {
      this.filterCollections.update((prev) => prev.filter((c) => c.id !== id))
      this.updateCollections()
      return
    }

    const col = this.apiCollections().find((c) => c.id === id)
    if (!col) return
    if (col.isManual) {
      this.api.deleteCollection(id).subscribe()
      this.apiCollections.update((prev) => prev.filter((c) => c.id !== id))
    } else {
      const next = { ...this.overrides(), [id]: { ...this.overrides()[id], hidden: true } }
      this.overrides.set(next)
      saveOverrides(next)
    }
    this.updateCollections()
  }

  renameCollection(id: string, name: string) {
    // Check if it's a filter collection
    const filter = this.filterCollections().find((c) => c.id === id)
    if (filter) {
      this.filterCollections.update((prev) =>
        prev.map((c) => c.id === id ? { ...c, name } : c)
      )
      this.updateCollections()
      return
    }

    const col = this.apiCollections().find((c) => c.id === id)
    if (!col) return
    if (col.isManual) {
      this.api.renameCollection(id, name).subscribe()
      this.apiCollections.update((prev) => prev.map((c) => c.id === id ? { ...c, name } : c))
    } else {
      const next = { ...this.overrides(), [id]: { ...this.overrides()[id], name } }
      this.overrides.set(next)
      saveOverrides(next)
    }
    this.updateCollections()
  }

  restoreCollection(id: string) {
    const next = { ...this.overrides() }
    if (next[id]) {
      delete next[id].hidden
      if (!next[id].name) delete next[id]
    }
    this.overrides.set(next)
    saveOverrides(next)
    this.updateCollections()
  }

  // ── Filter collection operations ────────────────────────────────────────

  addFilterCollection(name: string, filterType: 'genre' | 'director' | 'decade', filterValue: string) {
    const id = crypto.randomUUID()
    this.filterCollections.update((prev) => [...prev, {
      id, name, itemIds: [], isManual: false, filterType, filterValue,
    }])
    this.updateCollections()
  }

  updateFilterCollection(id: string, patch: Partial<Pick<Collection, 'name' | 'filterType' | 'filterValue'>>) {
    this.filterCollections.update((prev) =>
      prev.map((c) => c.id === id ? { ...c, ...patch } : c)
    )
    this.updateCollections()
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private updateCollections() {
    const all = [...this.apiCollections(), ...this.filterCollections()]
    this.collections.set(applyOverrides(all, this.overrides()))
  }
}
