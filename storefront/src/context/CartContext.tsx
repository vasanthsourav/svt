import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Product, ProductSize } from '../lib/format'

export interface CartLine {
  key: string          // unique per product+size, e.g. "12:34" or "12:0"
  productId: number
  sizeId: number | null
  size: string | null  // label, e.g. "M" / "32"
  name: string
  price: number
  image?: string | null
  slug: string
  stock: number        // stock for THIS size (or product stock if one-size)
  quantity: number
}

interface CartCtx {
  lines: CartLine[]
  count: number
  subtotal: number
  add: (product: Product, qty?: number, size?: ProductSize | null) => void
  setQty: (key: string, qty: number) => void
  remove: (key: string) => void
  clear: () => void
  lineFor: (productId: number, sizeId?: number | null) => CartLine | undefined
}

const Ctx = createContext<CartCtx>(null as any)
export const useCart = () => useContext(Ctx)

const KEY = 'svt_shop_cart'
const lineKey = (productId: number, sizeId: number | null) => `${productId}:${sizeId || 0}`

function clampQty(qty: number, stock: number | undefined): number {
  const cap = Number.isFinite(stock) && (stock as number) > 0 ? (stock as number) : 999
  const n = Math.round(Number(qty) || 1)
  return Math.max(1, Math.min(cap, n))
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
  })

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(lines)) }, [lines])

  const add: CartCtx['add'] = (product, qty = 1, size = null) => {
    const sizeId = size?.id ?? null
    const key = lineKey(product.id, sizeId)
    const stock = size ? size.stock : product.stock
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key)
      if (existing) {
        return prev.map((l) => l.key === key ? { ...l, quantity: clampQty(l.quantity + qty, stock) } : l)
      }
      return [...prev, {
        key, productId: product.id, sizeId, size: size?.label ?? null,
        name: product.name, price: product.price, image: product.image, slug: product.slug,
        stock, quantity: clampQty(qty, stock)
      }]
    })
  }

  const setQty: CartCtx['setQty'] = (key, qty) =>
    setLines((prev) => prev.map((l) => l.key === key ? { ...l, quantity: clampQty(qty, l.stock) } : l))

  const remove: CartCtx['remove'] = (key) => setLines((prev) => prev.filter((l) => l.key !== key))
  const clear = () => setLines([])
  const lineFor: CartCtx['lineFor'] = (productId, sizeId = null) =>
    lines.find((l) => l.key === lineKey(productId, sizeId ?? null))

  const count = lines.reduce((s, l) => s + l.quantity, 0)
  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0)

  return (
    <Ctx.Provider value={{ lines, count, subtotal, add, setQty, remove, clear, lineFor }}>
      {children}
    </Ctx.Provider>
  )
}
