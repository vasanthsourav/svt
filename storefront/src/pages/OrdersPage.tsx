import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { Order } from '../lib/format'
import { inr, dateOnly, statusLabel, statusChip } from '../lib/format'

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<{ orders: Order[] }>('/orders').then((d) => setOrders(d.orders)).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="min-h-[50vh] grid place-items-center"><div className="h-10 w-10 rounded-full border-4 border-maroon/20 border-t-maroon animate-spin" /></div>

  return (
    <div className="container-px py-10">
      <h1 className="font-serif text-4xl md:text-5xl uppercase tracking-tight text-maroon mb-8">My Orders</h1>
      {orders.length === 0 ? (
        <div className="text-center py-20 text-stone-400">
          <p className="font-serif text-2xl text-maroon mb-2">No orders yet</p>
          <Link to="/shop" className="btn-primary px-8 py-3 mt-4 inline-flex">Start Shopping</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <Link to={`/orders/${o.id}`} key={o.id} className="card p-5 flex flex-wrap items-center gap-4 hover:shadow-lg transition">
              <div className="flex -space-x-3">
                {o.items.slice(0, 3).map((it) => (
                  <div key={it.id} className="h-14 w-12 rounded-lg border-2 border-white overflow-hidden bg-cream-dark">
                    {it.image && <img src={it.image} className="h-full w-full object-cover" />}
                  </div>
                ))}
              </div>
              <div className="flex-1 min-w-[180px]">
                <p className="font-mono text-sm text-maroon font-semibold">{o.orderNumber}</p>
                <p className="text-xs text-stone-500">{dateOnly(o.createdAt)} · {o.items.length} item{o.items.length === 1 ? '' : 's'}</p>
              </div>
              <span className={`chip ${statusChip[o.status]}`}>{statusLabel[o.status] || o.status}</span>
              <div className="text-right">
                <p className="font-bold text-maroon">{inr(o.total)}</p>
                <p className="text-xs text-stone-400">View details →</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
