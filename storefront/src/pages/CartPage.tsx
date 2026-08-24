import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useCart } from '../context/CartContext'
import { inr } from '../lib/format'
import AnimatedNumber from '../components/AnimatedNumber'
import Icon from '../components/Icon'

export default function CartPage() {
  const { lines, setQty, remove, subtotal, count } = useCart()
  const navigate = useNavigate()
  const shipping = subtotal >= 1499 || subtotal === 0 ? 0 : 79
  const total = subtotal + shipping

  if (lines.length === 0) {
    return (
      <div className="container-px py-24 text-center">
        <Icon name="cart" className="w-12 h-12 mx-auto text-stone-300 mb-5" strokeWidth={1.2} />
        <p className="font-editorial italic text-4xl text-maroon mb-3">Your cart is empty</p>
        <p className="text-stone-500 mb-8">Explore our collection and add your favourites.</p>
        <Link to="/shop" className="btn-primary px-8 py-3">Start Shopping</Link>
      </div>
    )
  }

  return (
    <div className="container-px py-10">
      <h1 className="font-serif text-4xl md:text-5xl uppercase tracking-tight text-maroon mb-8">Your Cart <span className="font-editorial italic lowercase normal-case tracking-normal text-2xl text-stone-400">— {count} item{count === 1 ? '' : 's'}</span></h1>
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <AnimatePresence initial={false}>
          {lines.map((l, i) => (
            <motion.div key={l.key} className="card p-4 flex gap-4"
              layout
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
              exit={{ opacity: 0, x: 40, transition: { duration: 0.25 } }}>
              <Link to={`/product/${l.slug}`} className="h-28 w-24 rounded-md overflow-hidden bg-cream-dark shrink-0">
                {l.image ? <img src={l.image} className="h-full w-full object-cover" /> : <div className="h-full grid place-items-center text-stone-300 text-xs">No image</div>}
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/product/${l.slug}`}><h3 className="font-serif text-lg text-stone-800 line-clamp-2 hover:text-maroon">{l.name}</h3></Link>
                {l.size && <span className="chip bg-cream-dark text-maroon mt-1">Size: {l.size}</span>}
                <p className="text-maroon font-bold mt-1">{inr(l.price)}</p>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center border border-stone-300 rounded-md overflow-hidden text-sm">
                    <button onClick={() => l.quantity <= 1 ? remove(l.key) : setQty(l.key, l.quantity - 1)} className="px-3 py-1.5 text-maroon hover:bg-cream-dark">−</button>
                    <span className="px-3 font-semibold">{l.quantity}</span>
                    <button onClick={() => setQty(l.key, l.quantity + 1)} disabled={l.quantity >= l.stock} className="px-3 py-1.5 text-maroon hover:bg-cream-dark disabled:opacity-40">+</button>
                  </div>
                  <button onClick={() => remove(l.key)} className="text-sm text-rose-600 hover:underline">Remove</button>
                </div>
              </div>
              <div className="text-right font-bold text-stone-700 shrink-0">{inr(l.price * l.quantity)}</div>
            </motion.div>
          ))}
          </AnimatePresence>
        </div>

        {/* Summary */}
        <div className="card p-6 h-fit sticky top-24">
          <h2 className="font-serif text-xl text-maroon mb-4">Order Summary</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-stone-500">Subtotal</span><span className="font-medium">{inr(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-stone-500">Shipping</span><span className="font-medium">{shipping === 0 ? <span className="text-emerald-600">FREE</span> : inr(shipping)}</span></div>
            {shipping > 0 && <p className="text-xs text-gold-dark">Add {inr(1499 - subtotal)} more for free shipping</p>}
            <div className="border-t border-cream-dark pt-3 flex justify-between text-base font-bold text-maroon"><span>Total</span><span><AnimatedNumber value={total} /></span></div>
          </div>
          <button onClick={() => navigate('/checkout')} className="btn-primary w-full mt-5 py-3">Proceed to Checkout</button>
          <Link to="/shop" className="btn-ghost w-full mt-2">Continue shopping</Link>
        </div>
      </div>
    </div>
  )
}
