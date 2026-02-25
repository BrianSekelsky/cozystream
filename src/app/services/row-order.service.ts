import { Injectable, signal } from '@angular/core'

const ORDER_KEY = 'cozystream:row-order'

function load(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ORDER_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    // Migration: convert old RowEntry[] format ({ kind, id }) to string[]
    if (raw.length > 0 && typeof raw[0] === 'object' && 'kind' in raw[0]) {
      const migrated = raw.map((e: { id: string }) => e.id)
      localStorage.setItem(ORDER_KEY, JSON.stringify(migrated))
      return migrated
    }
    return raw as string[]
  } catch { return [] }
}

export function mergeRowOrder(
  savedOrder: string[],
  allIds: string[],
): string[] {
  const idSet = new Set(allIds)
  const result = savedOrder.filter((id) => idSet.has(id))
  const seen = new Set(result)

  for (const id of allIds) {
    if (!seen.has(id)) result.push(id)
  }

  return result
}

@Injectable({ providedIn: 'root' })
export class RowOrderService {
  readonly rawOrder = signal<string[]>(load())

  saveOrder(order: string[]): void {
    this.rawOrder.set(order)
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(order)) } catch {}
  }
}
