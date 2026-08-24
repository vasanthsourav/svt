import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { inr } from '../lib/format'

interface Affiliate {
  id: number; name: string | null; email: string | null; phone: string | null; code: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | null
  commissionPercent: number | null   // null = uses the global default
  effectivePercent: number
  clicks: number
  referredOrders: number; pending: number; payable: number; paid: number
  payoutMethod: string | null; payoutDetails: string | null
}

const statusChip: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800', APPROVED: 'bg-emerald-100 text-emerald-800', REJECTED: 'bg-rose-100 text-rose-700'
}

export default function AdminAffiliates() {
  const [list, setList] = useState<Affiliate[]>([])
  const [pct, setPct] = useState('')
  const [savedPct, setSavedPct] = useState(0)
  const [loading, setLoading] = useState(true)
  const [rateDraft, setRateDraft] = useState<Record<number, string>>({})

  const load = () => Promise.all([
    api.get<{ affiliates: Affiliate[]; defaultPercent: number }>('/admin/affiliates'),
    api.get<{ commissionPercent: number }>('/admin/affiliate-settings')
  ]).then(([a, s]) => {
    setList(a.affiliates); setPct(String(s.commissionPercent)); setSavedPct(s.commissionPercent)
    setRateDraft(Object.fromEntries(a.affiliates.map((x) => [x.id, x.commissionPercent == null ? '' : String(x.commissionPercent)])))
  }).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const savePct = async () => {
    try { const r = await api.put<{ commissionPercent: number }>('/admin/affiliate-settings', { commissionPercent: Number(pct) }); setSavedPct(r.commissionPercent); toast.success('Default rate updated'); load() }
    catch (e: any) { toast.error(e.message) }
  }

  const patchAffiliate = async (id: number, body: { status?: string; commissionPercent?: number | null }, msg: string) => {
    try { await api.patch(`/admin/affiliates/${id}`, body); toast.success(msg); load() }
    catch (e: any) { toast.error(e.message) }
  }

  const saveRate = (a: Affiliate) => {
    const raw = (rateDraft[a.id] ?? '').trim()
    patchAffiliate(a.id, { commissionPercent: raw === '' ? null : Number(raw) }, 'Commission updated')
  }

  const copyLink = (code: string | null) => {
    if (!code) return
    navigator.clipboard.writeText(`${window.location.origin}/?ref=${code}`)
    toast.success('Link copied')
  }

  const pendingCount = list.filter((a) => a.status === 'PENDING').length

  return (
    <div>
      <h1 className="font-serif uppercase tracking-tight text-3xl text-maroon mb-1">Affiliates</h1>
      <p className="text-stone-500 mb-6">Approve influencers, set each one's commission, and track their link performance.</p>

      <div className="card p-5 mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Default commission rate (%)</label>
          <input className="input w-28" type="number" value={pct} onChange={(e) => setPct(e.target.value)} />
        </div>
        <button onClick={savePct} className="btn-primary">Save default</button>
        <p className="text-sm text-stone-500">Default is <span className="font-semibold text-maroon">{savedPct}%</span> — used for any affiliate without a personal rate.</p>
      </div>

      {pendingCount > 0 && (
        <div className="card p-3 mb-4 border-amber-200 bg-amber-50 text-amber-800 text-sm">
          {pendingCount} affiliate{pendingCount > 1 ? 's' : ''} waiting for approval.
        </div>
      )}

      {loading ? <p className="text-stone-400">Loading…</p> : list.length === 0 ? (
        <div className="card p-12 text-center text-stone-400">No affiliates yet. People who join from the “Earn with SVT” page appear here.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-cream-dark text-stone-600">
              <tr>
                <th className="text-left p-3">Affiliate</th>
                <th className="text-left p-3">Code / Link</th>
                <th className="text-left p-3">Status</th>
                <th className="text-center p-3">Clicks</th>
                <th className="text-center p-3">Orders</th>
                <th className="text-right p-3">Pending</th>
                <th className="text-right p-3">Payable</th>
                <th className="text-right p-3">Paid</th>
                <th className="text-left p-3">Commission %</th>
                <th className="text-left p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-dark">
              {list.map((a) => (
                <tr key={a.id}>
                  <td className="p-3">
                    <p className="font-medium text-stone-800">{a.name || '—'}</p>
                    <p className="text-xs text-stone-400">{a.phone || a.email}</p>
                    <p className="text-[11px] text-stone-400">{a.payoutMethod ? `${a.payoutMethod}: ${a.payoutDetails}` : 'payout not set'}</p>
                  </td>
                  <td className="p-3">
                    <button onClick={() => copyLink(a.code)} className="font-mono text-maroon hover:underline" title="Copy referral link">{a.code || '—'}</button>
                  </td>
                  <td className="p-3"><span className={`chip ${statusChip[a.status || ''] || 'bg-stone-100 text-stone-500'}`}>{a.status || '—'}</span></td>
                  <td className="p-3 text-center">{a.clicks}</td>
                  <td className="p-3 text-center">{a.referredOrders}</td>
                  <td className="p-3 text-right text-amber-600">{inr(a.pending)}</td>
                  <td className="p-3 text-right text-emerald-600 font-semibold">{inr(a.payable)}</td>
                  <td className="p-3 text-right text-stone-500">{inr(a.paid)}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <input
                        className="input w-20 py-1.5"
                        type="number"
                        placeholder={`${savedPct}`}
                        value={rateDraft[a.id] ?? ''}
                        onChange={(e) => setRateDraft((d) => ({ ...d, [a.id]: e.target.value }))}
                      />
                      <button onClick={() => saveRate(a)} className="btn-outline px-2 py-1.5 text-xs">Set</button>
                    </div>
                    <p className="text-[11px] text-stone-400 mt-1">now {a.effectivePercent}%{a.commissionPercent == null ? ' (default)' : ''}</p>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {a.status !== 'APPROVED' && (
                        <button onClick={() => patchAffiliate(a.id, { status: 'APPROVED' }, 'Affiliate approved')} className="btn-primary px-3 py-1.5 text-xs">Approve</button>
                      )}
                      {a.status !== 'REJECTED' && (
                        <button onClick={() => patchAffiliate(a.id, { status: 'REJECTED' }, 'Affiliate rejected')} className="btn-outline px-3 py-1.5 text-xs">Reject</button>
                      )}
                    </div>
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
