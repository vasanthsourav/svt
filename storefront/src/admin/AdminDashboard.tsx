import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { inr } from '../lib/format'

interface Stats { products: number; lowStock: number; customers: number; orders: number; revenue: number; toFulfil: number }

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => { api.get<{ stats: Stats }>('/admin/stats').then((d) => setStats(d.stats)).catch(() => {}) }, [])

  const cards = [
    { label: 'Revenue', value: stats ? inr(stats.revenue) : '—', sub: 'Paid orders', accent: 'text-emerald-600' },
    { label: 'Orders', value: stats?.orders ?? '—', sub: `${stats?.toFulfil ?? 0} to fulfil`, accent: 'text-maroon' },
    { label: 'Products', value: stats?.products ?? '—', sub: `${stats?.lowStock ?? 0} low on stock`, accent: 'text-indigo-600' },
    { label: 'Customers', value: stats?.customers ?? '—', sub: 'Registered', accent: 'text-gold-dark' }
  ]

  return (
    <div>
      <h1 className="font-serif uppercase tracking-tight text-3xl text-maroon mb-1">Dashboard</h1>
      <p className="text-stone-500 mb-8">Overview of your online store</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <p className="text-xs uppercase tracking-wide text-stone-400 font-semibold">{c.label}</p>
            <p className={`text-3xl font-bold mt-2 ${c.accent}`}>{c.value}</p>
            <p className="text-xs text-stone-500 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <Link to="/admin/products" className="card p-6 hover:shadow-lg transition">
          <h2 className="font-serif text-xl text-maroon">Manage Products & Stock →</h2>
          <p className="text-sm text-stone-500 mt-1">Add new items, upload photos, update prices and stock counts.</p>
        </Link>
        <Link to="/admin/orders" className="card p-6 hover:shadow-lg transition">
          <h2 className="font-serif text-xl text-maroon">Process Orders →</h2>
          <p className="text-sm text-stone-500 mt-1">Pack, ship with consignment number + LR copy, and mark delivered.</p>
        </Link>
      </div>
    </div>
  )
}
