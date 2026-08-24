import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api, getToken } from '../lib/api'
import type { Order } from '../lib/format'
import { inr, dateTime, statusLabel, statusChip } from '../lib/format'
import Icon from '../components/Icon'

export default function AdminOrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [carrier, setCarrier] = useState('India Post')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [lrFile, setLrFile] = useState<File | null>(null)

  const load = () => api.get<{ order: Order }>(`/admin/orders/${id}`).then((d) => setOrder(d.order)).catch(() => setOrder(null)).finally(() => setLoading(false))
  useEffect(() => { load() }, [id])

  const act = async (path: string, body?: any) => {
    setBusy(true)
    try { const { order } = await api.post<{ order: Order }>(`/admin/orders/${id}/${path}`, body); setOrder(order); toast.success('Updated') }
    catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  // Ship needs multipart (LR file) — send via fetch directly.
  const ship = async () => {
    if (!trackingNumber.trim()) return toast.error('Enter the consignment / tracking number')
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('carrier', carrier); fd.append('trackingNumber', trackingNumber.trim())
      if (lrFile) fd.append('lrCopy', lrFile)
      const res = await fetch(`/api/admin/orders/${id}/ship`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Ship failed')
      setOrder(data.order); toast.success('Marked as shipped')
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  if (loading) return <p className="text-stone-400">Loading…</p>
  if (!order) return <p className="text-stone-500">Order not found.</p>

  return (
    <div>
      <button onClick={() => navigate('/admin/orders')} className="btn-ghost mb-4 text-sm">← All orders</button>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-serif uppercase tracking-tight text-3xl text-maroon">{order.orderNumber}</h1>
          <p className="text-stone-500">{dateTime(order.createdAt)} · {order.paymentMode}</p>
        </div>
        <span className={`chip text-sm px-4 py-2 ${statusChip[order.status]}`}>{statusLabel[order.status] || order.status}</span>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Items */}
          <div className="card p-6">
            <h2 className="font-serif text-xl text-maroon mb-4">Items</h2>
            {order.items.map((it) => (
              <div key={it.id} className="flex gap-4 py-2">
                <div className="h-14 w-12 rounded bg-cream-dark overflow-hidden shrink-0">{it.image && <img src={it.image} className="h-full w-full object-cover" />}</div>
                <div className="flex-1"><p className="font-medium">{it.name}</p><p className="text-sm text-stone-500">{it.size ? `Size ${it.size} · ` : ''}Qty {it.quantity} × {inr(it.price)}</p></div>
                <span className="font-semibold">{inr(it.price * it.quantity)}</span>
              </div>
            ))}
            <div className="border-t border-cream-dark mt-3 pt-3 flex justify-between font-bold text-maroon"><span>Total</span><span>{inr(order.total)}</span></div>
          </div>

          {/* Fulfilment actions */}
          <div className="card p-6">
            <h2 className="font-serif text-xl text-maroon mb-4">Fulfilment</h2>
            <div className="flex flex-wrap gap-2 mb-5">
              {order.status === 'PAID' && <button disabled={busy} onClick={() => act('pack')} className="btn-outline"><Icon name="package" className="w-4 h-4" /> Mark Packed</button>}
              {(order.status === 'PAID' || order.status === 'PACKED') && <span className="text-sm text-stone-400 self-center">Next: add tracking & ship below</span>}
              {order.status === 'SHIPPED' && <button disabled={busy} onClick={() => act('deliver')} className="btn-primary"><Icon name="check" className="w-4 h-4" /> Mark Delivered</button>}
              {['PENDING', 'PAID', 'PACKED', 'SHIPPED'].includes(order.status) &&
                <button disabled={busy} onClick={() => { if (confirm('Cancel this order? Stock will be restored.')) act('cancel') }} className="btn-ghost text-rose-600">Cancel Order</button>}
            </div>

            {(order.status === 'PAID' || order.status === 'PACKED') && (
              <div className="rounded-xl bg-cream p-4 space-y-3">
                <p className="font-semibold text-stone-700 text-sm">Ship the order</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div><label className="label">Carrier</label><input className="input" value={carrier} onChange={(e) => setCarrier(e.target.value)} /></div>
                  <div><label className="label">Consignment / Tracking No.</label><input className="input" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} /></div>
                </div>
                <div>
                  <label className="label">LR Copy / Receipt (optional, image or PDF)</label>
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => setLrFile(e.target.files?.[0] || null)} className="text-sm" />
                </div>
                <button disabled={busy} onClick={ship} className="btn-primary"><Icon name="truck" className="w-4 h-4" /> Mark Shipped</button>
              </div>
            )}

            {order.status === 'SHIPPED' && order.trackingNumber && (
              <div className="rounded-xl bg-cream p-4 text-sm">
                <p className="text-stone-500">Shipped via {order.carrier} · <span className="font-mono font-semibold text-maroon">{order.trackingNumber}</span></p>
                {order.lrCopyUrl && <a href={order.lrCopyUrl} target="_blank" rel="noreferrer" className="text-maroon hover:underline inline-flex items-center gap-1.5"><Icon name="package" className="w-4 h-4" /> View LR copy</a>}
              </div>
            )}
          </div>
        </div>

        {/* Customer + address + history */}
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="font-serif text-lg text-maroon mb-3">Customer</h2>
            <p className="text-sm text-stone-700 font-medium">{order.customer?.name || order.shipping.name}</p>
            <p className="text-sm text-stone-500">{order.customer?.phone || order.shipping.phone}</p>
            {order.customer?.email && <p className="text-sm text-stone-500">{order.customer.email}</p>}
            <h3 className="font-serif text-sm text-maroon mt-4 mb-1">Ship to</h3>
            <p className="text-sm text-stone-600 leading-relaxed">
              {order.shipping.line1}{order.shipping.line2 ? `, ${order.shipping.line2}` : ''}<br />
              {order.shipping.city}, {order.shipping.state} — {order.shipping.pincode}
            </p>
          </div>
          <div className="card p-6">
            <h2 className="font-serif text-lg text-maroon mb-3">History</h2>
            <ol className="space-y-3">
              {order.history.map((h, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-1 h-2 w-2 rounded-full bg-gold shrink-0" />
                  <div><p className="font-medium text-stone-700">{statusLabel[h.status] || h.status}</p>{h.note && <p className="text-xs text-stone-500">{h.note}</p>}<p className="text-[11px] text-stone-400">{dateTime(h.at)}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
