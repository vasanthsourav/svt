import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { inr, dateOnly } from '../lib/format'

interface Dash {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | null
  code: string | null
  commissionPercent?: number
  clicks?: number
  payoutMethod?: string | null
  payoutDetails?: string | null
  summary?: {
    referredOrders: number; pending: number; payable: number; paid: number
    orders: { orderNumber: string; status: string; commissionStatus: string; commission: number; orderTotal: number; createdAt: string }[]
  }
  payouts?: { id: number; amount: number; method: string; status: string; reference: string | null; createdAt: string; paidAt: string | null }[]
}

const commStatusChip: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800', PAYABLE: 'bg-emerald-100 text-emerald-800',
  PAID: 'bg-green-100 text-green-800', VOID: 'bg-stone-200 text-stone-500'
}

export default function AffiliatePage() {
  const [d, setD] = useState<Dash | null>(null)
  const [loading, setLoading] = useState(true)
  const [method, setMethod] = useState<'UPI' | 'BANK'>('UPI')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => api.get<Dash>('/affiliate').then((r) => {
    setD(r); setMethod((r.payoutMethod as any) || 'UPI'); setDetails(r.payoutDetails || '')
  }).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const applyNow = async () => {
    setBusy(true)
    try { await api.post('/affiliate/apply'); toast.success('Application submitted — pending approval'); load() }
    catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  if (loading) return <div className="min-h-[50vh] grid place-items-center"><div className="h-10 w-10 rounded-full border-4 border-maroon/20 border-t-maroon animate-spin" /></div>
  if (!d) return <div className="container-px py-20 text-center text-stone-500">Could not load your affiliate dashboard.</div>

  const copy = (text: string, what: string) => { navigator.clipboard.writeText(text); toast.success(`${what} copied`) }

  // Not an affiliate yet, or was rejected → show the join call-to-action.
  if (d.status === null || d.status === 'REJECTED') {
    return (
      <div className="container-px py-16 max-w-2xl">
        <h1 className="text-3xl text-maroon mb-2">Earn with SVT</h1>
        <p className="text-stone-500 mb-6">
          Become an affiliate: share your personal link, and earn a commission on every order it brings in —
          paid to your UPI/bank after delivery. Stock and delivery are handled for you.
        </p>
        {d.status === 'REJECTED' && (
          <div className="card p-4 mb-6 border-rose-200 bg-rose-50 text-rose-700 text-sm">
            Your previous application wasn't approved. You can apply again below.
          </div>
        )}
        <button onClick={applyNow} disabled={busy} className="btn-primary px-6 py-3">Become an affiliate</button>
      </div>
    )
  }

  const link = `${window.location.origin}/?ref=${d.code}`

  // Approved but the summary is unexpectedly missing — guard so we never crash.
  const summary = d.summary ?? { referredOrders: 0, pending: 0, payable: 0, paid: 0, orders: [] }
  const payouts = d.payouts ?? []

  const saveMethod = async () => {
    if (!details.trim()) return toast.error(method === 'UPI' ? 'Enter your UPI ID' : 'Enter bank details')
    setBusy(true)
    try { await api.patch('/affiliate/payout-method', { method, details }); toast.success('Payout details saved'); load() }
    catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }
  const requestPayout = async () => {
    setBusy(true)
    try { const r = await api.post('/affiliate/payout'); toast.success(`Payout requested: ${inr(r.payout.amount)}`); load() }
    catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  const cards = [
    { label: 'Clicks', value: String(d.clicks ?? 0), sub: 'Link opens', accent: 'text-stone-700' },
    { label: 'Pending', value: inr(summary.pending), sub: 'Unlocks on delivery', accent: 'text-amber-600' },
    { label: 'Available', value: inr(summary.payable), sub: 'Ready to withdraw', accent: 'text-emerald-600' },
    { label: 'Paid out', value: inr(summary.paid), sub: 'Lifetime', accent: 'text-maroon' },
    { label: 'Referred orders', value: String(summary.referredOrders), sub: 'Total', accent: 'text-stone-700' }
  ]

  return (
    <div className="container-px py-10">
      <h1 className="text-3xl text-maroon mb-1">Earn with SVT</h1>
      <p className="text-stone-500 mb-6">Share your link. When someone buys, you earn <span className="font-semibold text-maroon">{d.commissionPercent}%</span> commission — paid to your bank/UPI after delivery.</p>

      {d.status === 'PENDING' && (
        <div className="card p-4 mb-6 border-amber-200 bg-amber-50 text-amber-800 text-sm">
          <span className="font-semibold">Application under review.</span> You can start sharing your link now —
          your commission begins counting once an admin approves you.
        </div>
      )}

      {/* Share */}
      <div className="card p-6 mb-6">
        <h2 className="font-serif text-xl text-maroon mb-4">Your Referral Link</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label">Share this link</label>
            <div className="flex gap-2">
              <input className="input font-mono text-sm" readOnly value={link} />
              <button onClick={() => copy(link, 'Link')} className="btn-primary px-4 whitespace-nowrap">Copy</button>
            </div>
          </div>
          <div>
            <label className="label">Or share your code</label>
            <div className="flex gap-2">
              <input className="input font-mono text-lg tracking-widest font-bold text-maroon" readOnly value={d.code || ''} />
              <button onClick={() => copy(d.code || '', 'Code')} className="btn-outline px-4 whitespace-nowrap">Copy</button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <a className="btn-gold text-sm" target="_blank" rel="noreferrer"
            href={`https://wa.me/?text=${encodeURIComponent(`Shop premium menswear at Sri Venkateshwara Textiles — use my link: ${link}`)}`}>Share on WhatsApp</a>
        </div>
      </div>

      {/* Earnings */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <p className="text-xs uppercase tracking-wide text-stone-400 font-semibold">{c.label}</p>
            <p className={`text-2xl font-bold mt-2 ${c.accent}`}>{c.value}</p>
            <p className="text-xs text-stone-500 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Payout details + request */}
        <div className="card p-6">
          <h2 className="font-serif text-xl text-maroon mb-4">Get Paid</h2>
          <div className="flex gap-2 mb-3">
            {(['UPI', 'BANK'] as const).map((m) => (
              <button key={m} onClick={() => setMethod(m)} className={`chip px-4 py-2 ${method === m ? 'bg-maroon text-cream' : 'bg-cream-dark text-stone-600'}`}>{m}</button>
            ))}
          </div>
          <label className="label">{method === 'UPI' ? 'UPI ID' : 'Bank account & IFSC'}</label>
          <input className="input" placeholder={method === 'UPI' ? 'name@bank' : 'A/C 1234… · IFSC ABCD0001'} value={details} onChange={(e) => setDetails(e.target.value)} />
          <div className="flex gap-2 mt-3">
            <button onClick={saveMethod} disabled={busy} className="btn-outline">Save details</button>
            <button onClick={requestPayout} disabled={busy || summary.payable <= 0} className="btn-primary">Withdraw {inr(summary.payable)}</button>
          </div>
          <p className="text-xs text-stone-400 mt-2">Commission becomes withdrawable once your referred orders are delivered.</p>
        </div>

        {/* Payout history */}
        <div className="card p-6">
          <h2 className="font-serif text-xl text-maroon mb-4">Payout History</h2>
          {payouts.length === 0 ? <p className="text-sm text-stone-400">No payouts yet.</p> : (
            <div className="space-y-2 text-sm">
              {payouts.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b border-cream-dark pb-2">
                  <div><p className="font-semibold">{inr(p.amount)} <span className="text-stone-400 font-normal">via {p.method}</span></p><p className="text-xs text-stone-400">{dateOnly(p.createdAt)}</p></div>
                  <span className={`chip ${p.status === 'PAID' ? 'bg-green-100 text-green-800' : p.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>{p.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Referred orders */}
      <div className="card p-6 mt-6">
        <h2 className="font-serif text-xl text-maroon mb-4">Your Referred Orders</h2>
        {summary.orders.length === 0 ? (
          <p className="text-sm text-stone-400">No referred orders yet. Share your link to start earning!</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-stone-500"><tr className="border-b border-cream-dark">
              <th className="text-left py-2">Order</th><th className="text-left py-2">Date</th>
              <th className="text-right py-2">Order Total</th><th className="text-right py-2">Your Commission</th><th className="text-center py-2">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-cream-dark">
              {summary.orders.map((o) => (
                <tr key={o.orderNumber}>
                  <td className="py-2 font-mono text-maroon">{o.orderNumber}</td>
                  <td className="py-2 text-stone-500">{dateOnly(o.createdAt)}</td>
                  <td className="py-2 text-right">{inr(o.orderTotal)}</td>
                  <td className="py-2 text-right font-semibold text-maroon">{inr(o.commission)}</td>
                  <td className="py-2 text-center"><span className={`chip ${commStatusChip[o.commissionStatus] || 'bg-stone-100'}`}>{o.commissionStatus}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
