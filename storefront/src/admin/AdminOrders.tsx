import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { Order } from '../lib/format'
import { inr, dateOnly, statusLabel, statusChip } from '../lib/format'

const FILTERS = ['ALL', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED', 'PENDING', 'CANCELLED']

export default function AdminOrders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [filter, setFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get<{ orders: Order[] }>(`/admin/orders?status=${filter}`).then((d) => setOrders(d.orders)).finally(() => setLoading(false))
  }, [filter])

  return (
    <div>
      <h1 className="font-serif uppercase tracking-tight text-3xl text-maroon mb-1">Orders</h1>
      <p className="text-stone-500 mb-6">Process and track customer orders</p>

      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`chip px-4 py-2 ${filter === f ? 'bg-maroon text-cream' : 'bg-white text-stone-600 hover:bg-cream-dark'}`}>
            {f === 'ALL' ? 'All' : statusLabel[f] || f}
          </button>
        ))}
      </div>

      {loading ? <p className="text-stone-400">Loading…</p> : orders.length === 0 ? (
        <div className="card p-12 text-center text-stone-400">No orders in this view.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-dark text-stone-600">
              <tr>
                <th className="text-left p-3">Order</th>
                <th className="text-left p-3">Customer</th>
                <th className="text-left p-3">Date</th>
                <th className="text-right p-3">Total</th>
                <th className="text-center p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-dark">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-cream cursor-pointer" onClick={() => navigate(`/admin/orders/${o.id}`)}>
                  <td className="p-3 font-mono text-maroon font-semibold">{o.orderNumber}</td>
                  <td className="p-3">
                    <p className="text-stone-800">{o.customer?.name || o.shipping.name}</p>
                    <p className="text-xs text-stone-400">{o.customer?.phone || o.shipping.phone}</p>
                  </td>
                  <td className="p-3 text-stone-500">{dateOnly(o.createdAt)}</td>
                  <td className="p-3 text-right font-semibold">{inr(o.total)}</td>
                  <td className="p-3 text-center"><span className={`chip ${statusChip[o.status]}`}>{statusLabel[o.status] || o.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
