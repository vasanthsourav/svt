export const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

export const dateTime = (s?: string | null) =>
  s ? new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

export const dateOnly = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'

// Resolve image paths: backend /uploads paths or absolute http(s) URLs both work.
export const imgUrl = (u?: string | null) => (!u ? '' : u.startsWith('http') ? u : u)

export interface ProductSize {
  id: number; label: string; stock: number; inStock: boolean
}

export interface Product {
  id: number; name: string; slug: string; description?: string; category: string
  fabric?: string; price: number; mrp?: number | null; stock: number; inStock: boolean
  hasSizes: boolean; sizes: ProductSize[]
  images: string[]; image?: string | null; isActive: boolean; isFeatured: boolean
}

export interface OrderItem {
  id: number; productId: number; name: string; price: number; quantity: number; image?: string | null; size?: string | null
}

export interface Order {
  id: number; orderNumber: string; status: string; total: number; paymentMode: string
  paidAt?: string | null
  shipping: { name: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string }
  carrier?: string | null; trackingNumber?: string | null; trackingUrl?: string | null; lrCopyUrl?: string | null
  shippedAt?: string | null; deliveredAt?: string | null
  history: { status: string; at: string; note?: string | null }[]
  createdAt: string
  customer?: { id: number; name?: string; email?: string; phone?: string }
  items: OrderItem[]
}

export const STATUS_FLOW = ['PENDING', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED'] as const

export const statusLabel: Record<string, string> = {
  PENDING: 'Awaiting Payment', PAID: 'Confirmed', PACKED: 'Packed',
  SHIPPED: 'Shipped', DELIVERED: 'Delivered', CANCELLED: 'Cancelled'
}

export const statusChip: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  PACKED: 'bg-sky-100 text-sky-800',
  SHIPPED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-rose-100 text-rose-700'
}
