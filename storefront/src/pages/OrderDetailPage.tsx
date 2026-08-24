import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../lib/api'
import type { Order } from '../lib/format'
import { inr, dateTime, statusLabel, statusChip, STATUS_FLOW } from '../lib/format'
import Icon from '../components/Icon'
import OrderSuccess from '../components/OrderSuccess'

export default function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [celebrate, setCelebrate] = useState(!!(location.state as { justPlaced?: boolean } | null)?.justPlaced)

  useEffect(() => {
    api.get<{ order: Order }>(`/orders/${id}`).then((d) => setOrder(d.order)).catch(() => setOrder(null)).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="min-h-[50vh] grid place-items-center"><div className="h-10 w-10 rounded-full border-4 border-maroon/20 border-t-maroon animate-spin" /></div>
  if (!order) return <div className="container-px py-20 text-center text-stone-500">Order not found.</div>

  const cancelled = order.status === 'CANCELLED'
  const currentStep = STATUS_FLOW.indexOf(order.status as any)

  // Build the India Post tracking link (consignment appended).
  const trackHref = order.trackingNumber && order.trackingUrl
    ? `${order.trackingUrl}${order.trackingUrl.includes('?') ? '&' : '?'}cn=${encodeURIComponent(order.trackingNumber)}`
    : null

  return (
    <div className="container-px py-10 max-w-4xl">
      {celebrate && <OrderSuccess onDone={() => setCelebrate(false)} />}
      <button onClick={() => navigate(-1)} className="btn-ghost mb-6 text-sm">← Back to orders</button>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl uppercase tracking-tight text-maroon">Order {order.orderNumber}</h1>
          <p className="text-stone-500">Placed on {dateTime(order.createdAt)}</p>
        </div>
        <span className={`chip text-sm px-4 py-2 ${statusChip[order.status]}`}>{statusLabel[order.status] || order.status}</span>
      </div>

      {/* Tracking timeline */}
      {!cancelled && (
        <div className="card p-6 mb-6">
          <h2 className="font-serif text-xl text-maroon mb-6">Track Your Order</h2>
          <div className="flex justify-between relative">
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-stone-200" />
            <motion.div className="absolute top-4 left-0 h-0.5 bg-maroon"
              initial={{ width: '0%' }}
              animate={{ width: `${Math.max(0, currentStep) / (STATUS_FLOW.length - 1) * 100}%` }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.25 }} />
            {STATUS_FLOW.map((s, i) => {
              const done = i <= currentStep
              const isCurrent = i === currentStep
              return (
                <div key={s} className="relative z-10 flex flex-col items-center w-1/5">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.15 + i * 0.16, type: 'spring', stiffness: 380, damping: 18 }}
                    className={`relative h-8 w-8 rounded-full grid place-items-center text-xs font-bold border-2 ${done ? 'bg-maroon text-cream border-maroon' : 'bg-white text-stone-400 border-stone-200'}`}>
                    {done ? '✓' : i + 1}
                    {isCurrent && (
                      <motion.span className="absolute inset-0 rounded-full border-2 border-maroon"
                        animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }} />
                    )}
                  </motion.div>
                  <motion.span
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 + i * 0.16, duration: 0.35 }}
                    className={`mt-2 text-[11px] text-center ${done ? 'text-maroon font-semibold' : 'text-stone-400'}`}>{statusLabel[s]}</motion.span>
                </div>
              )
            })}
          </div>

          {order.trackingNumber && (
            <div className="mt-6 rounded-xl bg-cream p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-stone-500">{order.carrier || 'Courier'} · Consignment No.</p>
                <p className="font-mono font-semibold text-maroon">{order.trackingNumber}</p>
              </div>
              {trackHref && <a href={trackHref} target="_blank" rel="noreferrer" className="btn-gold text-sm">Track on India Post →</a>}
            </div>
          )}
          {order.lrCopyUrl && (
            <a href={order.lrCopyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-3 text-sm text-maroon hover:underline">
              <Icon name="package" className="w-4 h-4" /> View shipment receipt (LR copy)
            </a>
          )}
        </div>
      )}

      {cancelled && (
        <div className="card p-6 mb-6 bg-rose-50 border border-rose-200">
          <p className="text-rose-700 font-semibold">This order was cancelled.</p>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Items */}
        <div className="md:col-span-2 card p-6">
          <h2 className="font-serif text-xl text-maroon mb-4">Items</h2>
          <div className="space-y-4">
            {order.items.map((it) => (
              <div key={it.id} className="flex gap-4">
                <div className="h-16 w-14 rounded-lg bg-cream-dark overflow-hidden shrink-0">{it.image && <img src={it.image} className="h-full w-full object-cover" />}</div>
                <div className="flex-1"><p className="font-medium text-stone-800">{it.name}</p><p className="text-sm text-stone-500">{it.size ? `Size ${it.size} · ` : ''}Qty {it.quantity} × {inr(it.price)}</p></div>
                <span className="font-semibold text-stone-700">{inr(it.price * it.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-cream-dark mt-4 pt-4 flex justify-between font-bold text-maroon text-lg">
            <span>Total{order.paymentMode === 'COD' ? ' (Cash on Delivery)' : ''}</span><span>{inr(order.total)}</span>
          </div>
        </div>

        {/* Shipping + history */}
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="font-serif text-lg text-maroon mb-3">Delivery Address</h2>
            <p className="text-sm text-stone-600 leading-relaxed">
              <span className="font-semibold text-stone-800">{order.shipping.name}</span><br />
              {order.shipping.line1}{order.shipping.line2 ? `, ${order.shipping.line2}` : ''}<br />
              {order.shipping.city}, {order.shipping.state} — {order.shipping.pincode}
            </p>
            <p className="text-sm text-stone-600 mt-1 flex items-center gap-2"><Icon name="phone" className="w-4 h-4 text-gold-dark" /> {order.shipping.phone}</p>
          </div>
          <div className="card p-6">
            <h2 className="font-serif text-lg text-maroon mb-3">History</h2>
            <ol className="space-y-3">
              {order.history.map((h, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-1 h-2 w-2 rounded-full bg-gold shrink-0" />
                  <div>
                    <p className="font-medium text-stone-700">{statusLabel[h.status] || h.status}</p>
                    {h.note && <p className="text-xs text-stone-500">{h.note}</p>}
                    <p className="text-[11px] text-stone-400">{dateTime(h.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
