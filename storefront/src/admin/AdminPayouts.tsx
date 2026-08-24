import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { inr, dateOnly } from '../lib/format'

interface Payout {
  id: number; amount: number; method: string; details: string; status: string
  reference: string | null; createdAt: string; paidAt: string | null
  user: { id: number; name: string | null; email: string | null; phone: string | null; code: string | null }
}

const FILTERS = ['REQUESTED', 'PAID', 'REJECTED', 'ALL']
const chip: Record<string, string> = { REQUESTED: 'bg-amber-100 text-amber-800', PAID: 'bg-green-100 text-green-800', REJECTED: 'bg-rose-100 text-rose-700' }

export default function AdminPayouts() {
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [filter, setFilter] = useState('REQUESTED')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)

  const load = () => { setLoading(true); api.get<{ payouts: Payout[] }>(`/admin/payouts?status=${filter}`).then((d) => setPayouts(d.payouts)).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [filter])

  const pay = async (p: Payout) => {
    if (!confirm(`Pay ${inr(p.amount)} to ${p.user.name || p.user.code} via ${p.method} (${p.details})?`)) return
    setBusy(p.id)
    try { const r = await api.post<{ mock: boolean; payout: any }>(`/admin/payouts/${p.id}/pay`); toast.success(r.mock ? 'Marked paid (manual)' : 'Paid via RazorpayX'); load() }
    catch (e: any) { toast.error(e.message) } finally { setBusy(null) }
  }
  const reject = async (p: Payout) => {
    if (!confirm('Reject this payout request?')) return
    setBusy(p.id)
    try { await api.post(`/admin/payouts/${p.id}/reject`); toast.success('Rejected'); load() }
    catch (e: any) { toast.error(e.message) } finally { setBusy(null) }
  }

  return (
    <div>
      <h1 className="font-serif uppercase tracking-tight text-3xl text-maroon mb-1">Affiliate Payouts</h1>
      <p className="text-stone-500 mb-6">Approve and pay affiliate commission withdrawals</p>

      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`chip px-4 py-2 ${filter === f ? 'bg-maroon text-cream' : 'bg-white text-stone-600 hover:bg-cream-dark'}`}>{f === 'ALL' ? 'All' : f}</button>
        ))}
      </div>

      {loading ? <p className="text-stone-400">Loading…</p> : payouts.length === 0 ? (
        <div className="card p-12 text-center text-stone-400">No payouts in this view.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-dark text-stone-600">
              <tr>
                <th className="text-left p-3">Affiliate</th><th className="text-left p-3">Pay to</th>
                <th className="text-right p-3">Amount</th><th className="text-left p-3">Requested</th>
                <th className="text-center p-3">Status</th><th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-dark">
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td className="p-3"><p className="font-medium text-stone-800">{p.user.name || '—'}</p><p className="text-xs text-stone-400">{p.user.phone || p.user.email} · {p.user.code}</p></td>
                  <td className="p-3 text-xs"><span className="chip bg-cream-dark text-stone-600">{p.method}</span> <span className="text-stone-500">{p.details}</span></td>
                  <td className="p-3 text-right font-bold text-maroon">{inr(p.amount)}</td>
                  <td className="p-3 text-stone-500">{dateOnly(p.createdAt)}</td>
                  <td className="p-3 text-center"><span className={`chip ${chip[p.status]}`}>{p.status}</span>{p.reference && <p className="text-[10px] text-stone-400 mt-1">{p.reference}</p>}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {p.status === 'REQUESTED' && (
                      <>
                        <button disabled={busy === p.id} onClick={() => pay(p)} className="btn-primary btn text-xs px-3 py-1.5 mr-2">Pay</button>
                        <button disabled={busy === p.id} onClick={() => reject(p)} className="text-rose-500 hover:underline text-xs">Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
