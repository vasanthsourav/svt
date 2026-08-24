import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { inr } from '../lib/format'
import { openRazorpay } from '../lib/razorpay'
import { getRef, setRef, clearRef } from '../lib/ref'
import AnimatedNumber from '../components/AnimatedNumber'
import Icon from '../components/Icon'

export default function CheckoutPage() {
  const { lines, subtotal, clear } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'RAZORPAY' | 'COD'>('RAZORPAY')
  const [refCode, setRefCode] = useState(getRef())
  const [ship, setShip] = useState({
    name: user?.name || '', phone: user?.phone || '', line1: '', line2: '',
    city: '', state: 'Tamil Nadu', pincode: ''
  })

  const shipping = subtotal >= 1499 ? 0 : 79
  const total = subtotal + shipping

  if (lines.length === 0) {
    navigate('/cart', { replace: true })
    return null
  }

  const set = (k: keyof typeof ship, v: string) => setShip((s) => ({ ...s, [k]: v }))

  const placeOrder = async () => {
    for (const [k, label] of [['name', 'name'], ['phone', 'phone'], ['line1', 'address'], ['city', 'city'], ['state', 'state'], ['pincode', 'pincode']] as const) {
      if (!String((ship as any)[k]).trim()) return toast.error(`Please enter your ${label}.`)
    }
    setBusy(true)
    try {
      if (refCode.trim()) setRef(refCode.trim())
      const payload = {
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, sizeId: l.sizeId || undefined })),
        shipping: ship,
        paymentMode: mode,
        referralCode: refCode.trim() || undefined
      }
      const { order, payment } = await api.post<{ order: any; payment: any }>('/orders', payload)

      if (payment.mode === 'COD') {
        clear(); clearRef(); toast.success('Order placed! Pay on delivery.'); navigate(`/orders/${order.id}`, { state: { justPlaced: true } }); return
      }

      // Razorpay path. In mock mode (no keys) we confirm straight away.
      if (payment.mock || !payment.configured || !payment.keyId) {
        await api.post(`/orders/${order.id}/confirm`, { razorpayPaymentId: 'mock_pay', razorpaySignature: 'mock_sig' })
        clear(); clearRef(); toast.success('Payment successful (test mode)!'); navigate(`/orders/${order.id}`, { state: { justPlaced: true } }); return
      }

      const result = await openRazorpay({
        keyId: payment.keyId, amount: payment.amount, currency: payment.currency,
        orderId: payment.razorpayOrderId, name: 'Sri Venkateshwara Textils',
        description: `Order ${order.orderNumber}`,
        prefill: { name: ship.name, contact: ship.phone, email: user?.email || undefined }
      })
      await api.post(`/orders/${order.id}/confirm`, result)
      clear(); toast.success('Payment successful!'); navigate(`/orders/${order.id}`, { state: { justPlaced: true } })
    } catch (e: any) {
      toast.error(e.message || 'Could not complete the order.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container-px py-10">
      <h1 className="font-serif text-4xl md:text-5xl uppercase tracking-tight text-maroon mb-8">Checkout</h1>
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Address + payment */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="font-serif text-xl text-maroon mb-4">Shipping Address</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className="label">Full Name</label><input className="input" value={ship.name} onChange={(e) => set('name', e.target.value)} /></div>
              <div><label className="label">Phone</label><input className="input" value={ship.phone} onChange={(e) => set('phone', e.target.value)} /></div>
              <div className="sm:col-span-2"><label className="label">Address Line 1</label><input className="input" placeholder="House no., street" value={ship.line1} onChange={(e) => set('line1', e.target.value)} /></div>
              <div className="sm:col-span-2"><label className="label">Address Line 2 (optional)</label><input className="input" placeholder="Area, landmark" value={ship.line2} onChange={(e) => set('line2', e.target.value)} /></div>
              <div><label className="label">City</label><input className="input" value={ship.city} onChange={(e) => set('city', e.target.value)} /></div>
              <div><label className="label">State</label><input className="input" value={ship.state} onChange={(e) => set('state', e.target.value)} /></div>
              <div><label className="label">Pincode</label><input className="input" value={ship.pincode} onChange={(e) => set('pincode', e.target.value)} /></div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="font-serif text-xl text-maroon mb-4">Payment Method</h2>
            <div className="space-y-3">
              <label className={`flex items-center gap-3 p-4 border cursor-pointer transition ${mode === 'RAZORPAY' ? 'border-maroon bg-maroon/5' : 'border-stone-200 hover:border-stone-300'}`}>
                <input type="radio" checked={mode === 'RAZORPAY'} onChange={() => setMode('RAZORPAY')} className="accent-maroon" />
                <Icon name="shield" className={`w-5 h-5 ${mode === 'RAZORPAY' ? 'text-maroon' : 'text-stone-400'}`} />
                <div><p className="font-semibold text-stone-800">Pay Online</p><p className="text-xs text-stone-500">Cards, UPI, Netbanking, Wallets — secured by Razorpay</p></div>
              </label>
              <label className={`flex items-center gap-3 p-4 border cursor-pointer transition ${mode === 'COD' ? 'border-maroon bg-maroon/5' : 'border-stone-200 hover:border-stone-300'}`}>
                <input type="radio" checked={mode === 'COD'} onChange={() => setMode('COD')} className="accent-maroon" />
                <Icon name="wallet" className={`w-5 h-5 ${mode === 'COD' ? 'text-maroon' : 'text-stone-400'}`} />
                <div><p className="font-semibold text-stone-800">Cash on Delivery</p><p className="text-xs text-stone-500">Pay in cash when your order arrives</p></div>
              </label>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="font-serif text-xl text-maroon mb-1">Referral Code</h2>
            <p className="text-xs text-stone-500 mb-3">Shopping through a friend’s link? Their code is applied here.</p>
            <input className="input uppercase" placeholder="Enter referral code (optional)" value={refCode}
              onChange={(e) => setRefCode(e.target.value.toUpperCase())} />
          </div>
        </div>

        {/* Summary */}
        <div className="card p-6 h-fit sticky top-24">
          <h2 className="font-serif text-xl text-maroon mb-4">Your Order</h2>
          <div className="space-y-3 max-h-60 overflow-auto mb-4">
            {lines.map((l) => (
              <div key={l.key} className="flex gap-3 text-sm">
                <div className="h-12 w-10 rounded bg-cream-dark overflow-hidden shrink-0">{l.image && <img src={l.image} className="h-full w-full object-cover" />}</div>
                <div className="flex-1 min-w-0"><p className="truncate">{l.name}</p><p className="text-stone-400">{l.size ? `Size ${l.size} · ` : ''}Qty {l.quantity}</p></div>
                <span className="font-medium">{inr(l.price * l.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-cream-dark pt-3 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-stone-500">Subtotal</span><span>{inr(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-stone-500">Shipping</span><span>{shipping === 0 ? <span className="text-emerald-600">FREE</span> : inr(shipping)}</span></div>
            <div className="flex justify-between text-base font-bold text-maroon border-t border-cream-dark pt-2"><span>Total</span><span><AnimatedNumber value={total} /></span></div>
          </div>
          <button disabled={busy} onClick={placeOrder} className="btn-primary w-full mt-5 py-3 text-base">
            {busy ? 'Processing…' : mode === 'COD' ? 'Place Order' : `Pay ${inr(total)}`}
          </button>
          <p className="text-[11px] text-center text-stone-400 mt-3">By placing this order you agree to our exchange policy.</p>
        </div>
      </div>
    </div>
  )
}
