import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { inr, dateOnly } from '../lib/format'

interface Data {
  percent: number
  totalOrders: number
  pending: number   // undelivered — not payable yet
  payable: number   // delivered — owed to the operator now
  paid: number      // already settled
  thisMonth: number
  orders: { orderNumber: string; status: string; feeStatus: string | null; fee: number; orderTotal: number; createdAt: string }[]
}

const feeChip: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800', PAYABLE: 'bg-emerald-100 text-emerald-800',
  PAID: 'bg-green-100 text-green-800', VOID: 'bg-stone-200 text-stone-500'
}

export default function AdminPlatform() {
  const [d, setD] = useState<Data | null>(null)
  const [pct, setPct] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => api.get<Data>('/admin/platform').then((r) => { setD(r); setPct(String(r.percent)) })
  useEffect(() => { load() }, [])

  const savePct = async () => {
    setBusy(true)
    try { const r = await api.put<{ percent: number }>('/admin/platform-settings', { percent: Number(pct) }); setPct(String(r.percent)); toast.success('Platform rate updated'); load() }
    catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }
  const settle = async () => {
    if (!d || d.payable <= 0) return
    if (!window.confirm(`Mark ${inr(d.payable)} as paid to the operator? This clears the payable balance.`)) return
    setBusy(true)
    try { const r = await api.post<{ settled: number }>('/admin/platform/settle'); toast.success(`Settled ${r.settled} order(s)`); load() }
    catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  if (!d) return <p className="text-stone-400">Loading…</p>

  const cards = [
    { label: 'This month', value: inr(d.thisMonth), sub: 'Earned so far', accent: 'text-stone-800' },
    { label: 'Pending', value: inr(d.pending), sub: 'Unlocks on delivery', accent: 'text-amber-600' },
    { label: 'Payable now', value: inr(d.payable), sub: 'Delivered — owed', accent: 'text-emerald-600' },
    { label: 'Paid', value: inr(d.paid), sub: 'Lifetime settled', accent: 'text-maroon' }
  ]

  return (
    <div>
      <h1 className="font-serif uppercase tracking-tight text-3xl text-maroon mb-1">Platform Fee</h1>
      <p className="text-stone-500 mb-6">The operator’s transparent cut of every sale — held until each order is delivered, then payable.</p>

      <div className="card p-5 mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Platform rate (%)</label>
          <input className="input w-28" type="number" value={pct} onChange={(e) => setPct(e.target.value)} />
        </div>
        <button onClick={savePct} disabled={busy} className="btn-primary">Save rate</button>
        <p className="text-sm text-stone-500">Currently <span className="font-semibold text-maroon">{d.percent}%</span> of every order.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <p className="text-xs uppercase tracking-wide text-stone-400 font-semibold">{c.label}</p>
            <p className={`text-2xl font-bold mt-2 tabular-nums ${c.accent}`}>{c.value}</p>
            <p className="text-xs text-stone-500 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="card p-5 mb-6 flex flex-wrap items-center gap-4">
        <button onClick={settle} disabled={busy || d.payable <= 0} className="btn-primary">Mark {inr(d.payable)} as paid</button>
        <p className="text-sm text-stone-500">Use this after you’ve paid the operator for the period — it moves “Payable” into “Paid” so the ledger stays clean for invoicing.</p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-cream-dark text-stone-600">
            <tr>
              <th className="text-left p-3">Order</th>
              <th className="text-left p-3">Date</th>
              <th className="text-right p-3">Order total</th>
              <th className="text-right p-3">Fee</th>
              <th className="text-center p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-dark">
            {d.orders.length === 0 ? (
              <tr><td colSpan={5} className="p-12 text-center text-stone-400">No fees yet. Every delivered order earns the platform rate.</td></tr>
            ) : d.orders.map((o) => (
              <tr key={o.orderNumber}>
                <td className="p-3 font-mono text-maroon">{o.orderNumber}</td>
                <td className="p-3 text-stone-500">{dateOnly(o.createdAt)}</td>
                <td className="p-3 text-right tabular-nums">{inr(o.orderTotal)}</td>
                <td className="p-3 text-right font-semibold text-maroon tabular-nums">{inr(o.fee)}</td>
                <td className="p-3 text-center"><span className={`chip ${feeChip[o.feeStatus || ''] || 'bg-stone-100'}`}>{o.feeStatus || '—'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
