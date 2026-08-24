import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import type { Product, ProductSize } from '../lib/format'
import { inr } from '../lib/format'
import { useCart } from '../context/CartContext'
import Icon from '../components/Icon'
import SuitUpPreview from '../components/SuitUpPreview'
import TryOnModal from '../components/TryOnModal'

export default function ProductPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { add } = useCart()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [qty, setQty] = useState(1)
  const [activeImg, setActiveImg] = useState(0)
  const [size, setSize] = useState<ProductSize | null>(null)
  const [tryOn, setTryOn] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get<{ product: Product }>(`/products/${slug}`)
      .then((d) => {
        setProduct(d.product); setActiveImg(0); setQty(1)
        // preselect the first in-stock size for sized products
        setSize(d.product.hasSizes ? (d.product.sizes.find((s) => s.inStock) || null) : null)
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <div className="min-h-[50vh] grid place-items-center"><div className="h-10 w-10 rounded-full border-4 border-maroon/20 border-t-maroon animate-spin" /></div>
  if (!product) return <div className="container-px py-20 text-center text-stone-500">Product not found. <Link to="/shop" className="text-maroon underline">Back to shop</Link></div>

  const off = product.mrp && product.mrp > product.price ? Math.round((1 - product.price / product.mrp) * 100) : 0
  const availStock = product.hasSizes ? (size?.stock ?? 0) : product.stock
  const canBuy = product.inStock && (!product.hasSizes || !!(size && size.inStock))
  const doAdd = (): boolean => {
    if (product.hasSizes && !size) { toast.error('Please select a size'); return false }
    add(product, qty, size)
    return true
  }

  return (
    <div className="container-px py-10">
      {tryOn && <TryOnModal productId={product.id} productName={product.name} onClose={() => setTryOn(false)} />}
      <button onClick={() => navigate(-1)} className="btn-ghost mb-6 text-sm">← Back</button>
      <div className="grid md:grid-cols-2 gap-10">
        {/* Gallery */}
        <div>
          <div className="card overflow-hidden aspect-[4/5] bg-cream-dark relative">
            <AnimatePresence mode="wait">
              {product.images[activeImg]
                ? <motion.div key={activeImg}
                    className="absolute inset-0"
                    initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
                    <SuitUpPreview src={product.images[activeImg]} alt={product.name} />
                  </motion.div>
                : <div className="h-full grid place-items-center text-stone-300 font-serif">No image</div>}
            </AnimatePresence>
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-3 mt-3">
              {product.images.map((img, i) => (
                <button key={i} onClick={() => setActiveImg(i)}
                  className={`h-20 w-16 rounded-lg overflow-hidden border-2 ${i === activeImg ? 'border-maroon' : 'border-transparent'}`}>
                  <img src={img} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setTryOn(true)}
            className="btn-primary w-full mt-4 py-3 flex items-center justify-center gap-2"
          >
            <span className="text-gold-light">✨</span> Try it on your face
          </button>
        </div>

        {/* Details */}
        <div className="md:pt-6">
          <p className="text-[11px] uppercase tracking-[0.3em] text-gold-dark font-semibold">{product.category}{product.fabric ? ` · ${product.fabric}` : ''}</p>
          <h1 className="font-serif text-4xl md:text-5xl uppercase tracking-tight text-stone-900 leading-[0.95] mt-3">{product.name}</h1>
          <div className="mt-5 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-maroon">{inr(product.price)}</span>
            {product.mrp && product.mrp > product.price && <span className="text-lg text-stone-400 line-through">{inr(product.mrp)}</span>}
            {off > 0 && <span className="text-xs font-bold uppercase tracking-widest bg-maroon text-cream px-2.5 py-1">−{off}%</span>}
          </div>

          <p className="mt-3 text-sm">
            {!product.inStock
              ? <span className="text-rose-600 font-medium">● Out of stock</span>
              : product.hasSizes
              ? (size
                  ? <span className="text-emerald-700 font-medium">● Size {size.label} in stock {size.stock <= 5 ? `· only ${size.stock} left` : ''}</span>
                  : <span className="text-amber-600 font-medium">● Please select a size</span>)
              : <span className="text-emerald-700 font-medium">● In stock {product.stock <= 5 ? `· only ${product.stock} left` : ''}</span>}
          </p>

          <div className="h-px bg-stone-200 my-6" />
          {product.description && <p className="text-stone-600 leading-relaxed">{product.description}</p>}

          {/* Size selector */}
          {product.hasSizes && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Select Size</label>
                <span className="text-xs text-stone-400">{product.category === 'MENS' && product.sizes.some(s => /^\d+$/.test(s.label)) ? 'Waist size' : ''}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((s, i) => {
                  const active = size?.id === s.id
                  return (
                    <motion.button key={s.id} disabled={!s.inStock}
                      initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.05 + i * 0.04, type: 'spring', stiffness: 400, damping: 20 }}
                      whileTap={s.inStock ? { scale: 0.9 } : undefined}
                      onClick={() => { setSize(s); setQty(1) }}
                      className={`min-w-[3rem] px-3 py-2 rounded-md border text-sm font-semibold transition
                        ${active ? 'bg-maroon text-cream border-maroon'
                          : s.inStock ? 'bg-white text-stone-700 border-stone-300 hover:border-maroon'
                          : 'bg-stone-100 text-stone-300 border-stone-200 line-through cursor-not-allowed'}`}>
                      {s.label}
                    </motion.button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-7 flex items-center gap-4">
            <div className="flex items-center border border-stone-300 rounded-md overflow-hidden">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-4 py-2 text-maroon hover:bg-cream-dark">−</button>
              <span className="px-4 font-semibold">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(availStock, q + 1))} className="px-4 py-2 text-maroon hover:bg-cream-dark disabled:opacity-40" disabled={qty >= availStock}>+</button>
            </div>
            <button disabled={!canBuy} onClick={() => { if (doAdd()) toast.success('Added to cart') }} className="btn-outline flex-1 py-3">Add to Cart</button>
          </div>
          <button disabled={!canBuy}
            onClick={() => { if (doAdd()) navigate('/cart') }}
            className="btn-primary w-full mt-3 py-3 text-base">Buy Now</button>

          <div className="mt-8 grid grid-cols-3 gap-3 text-center text-xs text-stone-500">
            {[
              { icon: 'shield' as const, t: 'Secure Pay', s: 'Razorpay' },
              { icon: 'truck' as const, t: 'Tracked', s: 'Delivery' },
              { icon: 'refresh' as const, t: 'Easy', s: 'Exchanges' }
            ].map((b) => (
              <div key={b.t} className="border border-stone-200 p-4">
                <Icon name={b.icon} className="w-5 h-5 mx-auto text-gold-dark mb-1.5" />
                <p className="font-semibold text-maroon uppercase tracking-wide text-[11px]">{b.t}</p>
                <p className="text-stone-400">{b.s}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
