import { Link } from 'react-router-dom'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import toast from 'react-hot-toast'
import type { Product } from '../lib/format'
import { inr } from '../lib/format'
import { useCart } from '../context/CartContext'
import Icon from './Icon'

export default function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const { add, lineFor, setQty, remove } = useCart()
  const line = product.hasSizes ? undefined : lineFor(product.id, null)
  const off = product.mrp && product.mrp > product.price
    ? Math.round((1 - product.price / product.mrp) * 100) : 0

  // 3D tilt-toward-cursor on the image.
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)
  const rotateX = useSpring(useTransform(py, [0, 1], [7, -7]), { stiffness: 200, damping: 18 })
  const rotateY = useSpring(useTransform(px, [0, 1], [-7, 7]), { stiffness: 200, damping: 18 })
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width)
    py.set((e.clientY - r.top) / r.height)
  }
  const onLeave = () => { px.set(0.5); py.set(0.5) }

  return (
    <motion.div
      className="group"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay: Math.min(index, 8) * 0.05, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Image (tilts toward cursor) */}
      <motion.div onMouseMove={onMove} onMouseLeave={onLeave}
        style={{ rotateX, rotateY, transformPerspective: 900 }} className="[transform-style:preserve-3d]">
      <Link to={`/product/${product.slug}`} className="block relative aspect-[3/4] overflow-hidden bg-cream-dark">
        {product.image
          ? <img src={product.image} alt={product.name} loading="lazy"
              className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]" />
          : <div className="h-full w-full grid place-items-center text-stone-300 font-editorial italic">No image</div>}

        {off > 0 && (
          <span className="absolute top-3 left-3 bg-maroon text-cream text-[10px] font-bold tracking-widest px-2.5 py-1 uppercase">−{off}%</span>
        )}
        {!product.inStock && (
          <span className="absolute inset-0 bg-cream/70 grid place-items-center font-editorial italic text-xl text-maroon">Sold Out</span>
        )}
        {product.hasSizes && product.inStock && (
          <span className="absolute bottom-0 inset-x-0 bg-maroon-dark/0 group-hover:bg-maroon-dark/85 text-transparent group-hover:text-cream transition-all duration-300 text-center py-3 text-[11px] uppercase tracking-[0.25em]">
            Select Size
          </span>
        )}
      </Link>
      </motion.div>

      {/* Details */}
      <div className="pt-3.5">
        <p className="text-[10px] uppercase tracking-[0.18em] text-gold-dark font-semibold">{product.category}{product.fabric ? ` · ${product.fabric}` : ''}</p>
        <Link to={`/product/${product.slug}`}>
          <h3 className="mt-1.5 font-serif text-base leading-snug uppercase tracking-tight text-stone-800 line-clamp-1 group-hover:text-maroon transition">{product.name}</h3>
        </Link>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-semibold text-maroon">{inr(product.price)}</span>
          {product.mrp && product.mrp > product.price && <span className="text-sm text-stone-400 line-through">{inr(product.mrp)}</span>}
        </div>

        {/* Action */}
        <div className="mt-3">
          {!product.inStock ? (
            <span className="block text-[11px] uppercase tracking-widest text-stone-400">Out of Stock</span>
          ) : product.hasSizes ? (
            <Link to={`/product/${product.slug}`} className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-maroon border-b border-maroon/40 pb-0.5 hover:border-maroon transition">
              Choose Size <Icon name="arrowRight" className="w-3.5 h-3.5" />
            </Link>
          ) : line ? (
            <div className="inline-flex items-center border border-maroon/25">
              <button onClick={() => line.quantity <= 1 ? remove(line.key) : setQty(line.key, line.quantity - 1)}
                className="px-3 py-1.5 text-maroon hover:bg-maroon hover:text-cream transition" aria-label="Decrease"><Icon name="minus" className="w-3.5 h-3.5" /></button>
              <span className="px-3 text-xs font-semibold text-maroon tabular-nums">{line.quantity}</span>
              <button disabled={line.quantity >= product.stock} onClick={() => setQty(line.key, line.quantity + 1)}
                className="px-3 py-1.5 text-maroon hover:bg-maroon hover:text-cream transition disabled:opacity-30" aria-label="Increase"><Icon name="plus" className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <button onClick={() => { add(product); toast.success('Added to cart') }}
              className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-maroon border-b border-maroon/40 pb-0.5 hover:border-maroon transition">
              <Icon name="plus" className="w-3.5 h-3.5" /> Add to Cart
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
