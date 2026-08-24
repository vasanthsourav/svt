import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform, useMotionValue, useMotionTemplate } from 'framer-motion'
import { api } from '../lib/api'
import type { Product } from '../lib/format'
import ProductCard from '../components/ProductCard'
import Icon from '../components/Icon'
import Magnetic from '../components/Magnetic'
import HorizontalShowcase from '../components/HorizontalShowcase'

const CATEGORIES = [
  { key: 'MENS', label: 'Men', blurb: 'Shirts · Dhotis · Ethnic' },
  { key: 'WOMENS', label: 'Women', blurb: 'Kurtis · Lehengas' },
  { key: 'SAREES', label: 'Sarees', blurb: 'Silk · Cotton · Linen' },
  { key: 'KIDS', label: 'Kids', blurb: 'Festive · Everyday' }
]

const EASE = [0.22, 1, 0.36, 1] as const
const fadeUp = { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } } }
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } } }
// Text lines slide up from behind an overflow mask (editorial reveal).
const lineStagger = { hidden: {}, show: { transition: { staggerChildren: 0.12 } } }
const maskLine = { hidden: { y: '115%' }, show: { y: 0, transition: { duration: 0.85, ease: EASE } } }

export default function HomePage() {
  const [featured, setFeatured] = useState<Product[]>([])

  // Scroll-linked parallax for the hero.
  const heroRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const imageY = useTransform(scrollYProgress, [0, 1], [0, 150])
  const imageScale = useTransform(scrollYProgress, [0, 1], [1.06, 1.22])
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 100])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])

  // Cursor-follow spotlight over the hero.
  const spotX = useMotionValue(-500)
  const spotY = useMotionValue(-500)
  const spotlight = useMotionTemplate`radial-gradient(360px circle at ${spotX}px ${spotY}px, rgba(182,137,77,0.20), transparent 62%)`
  const onHeroMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    spotX.set(e.clientX - r.left); spotY.set(e.clientY - r.top)
  }

  useEffect(() => {
    api.get<{ products: Product[] }>('/products?featured=true')
      .then((d) => setFeatured(d.products.slice(0, 8)))
      .catch(() => {})
  }, [])

  return (
    <div>
      {/* Hero — full-bleed editorial statement (Exaggerated Minimalism) */}
      <section ref={heroRef} onMouseMove={onHeroMove} className="relative min-h-[92vh] flex items-end overflow-hidden bg-[#0e1014] text-cream">
        {/* Full-bleed image with parallax, slow zoom + clip-path reveal */}
        <motion.img
          src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1800&q=80&auto=format&fit=crop"
          alt="Menswear"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ y: imageY, scale: imageScale }}
          initial={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }} animate={{ opacity: 1, clipPath: 'inset(0 0 0% 0)' }} transition={{ duration: 1.3, ease: EASE }}
        />
        {/* Overlays for legibility + texture */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e1014] via-[#0e1014]/75 to-[#0e1014]/20" />
        <div className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg,#b6894d 0,#b6894d 1px,transparent 1px,transparent 18px)' }} />
        {/* Cursor spotlight */}
        <motion.div className="absolute inset-0 pointer-events-none hidden md:block mix-blend-soft-light" style={{ background: spotlight }} />

        <motion.div className="container-px relative w-full pb-16 md:pb-24" style={{ y: contentY, opacity: contentOpacity }}>
          <motion.div variants={stagger} initial="hidden" animate="show" className="max-w-4xl">
            <motion.p variants={fadeUp} className="flex items-center gap-3 text-gold text-[11px] md:text-sm tracking-[0.35em] uppercase mb-5">
              <span className="h-px w-10 bg-gold/60" /> Menswear · Kovilpatti · Since Generations
            </motion.p>
            <motion.h1 variants={lineStagger}
              className="font-serif font-bold uppercase leading-[0.82] tracking-[-0.03em] text-[clamp(3.2rem,13vw,11rem)]">
              <span className="block overflow-hidden pb-[0.06em]"><motion.span variants={maskLine} className="block">Dressed to</motion.span></span>
              <span className="block overflow-hidden pb-[0.1em]"><motion.span variants={maskLine} className="block font-editorial italic lowercase font-medium text-gold tracking-normal">impress.</motion.span></span>
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-6 text-cream/75 text-lg md:text-xl max-w-xl font-light">
              Sharp shirts, traditional dhotis and festive ethnic wear — crafted fabric for the modern man.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-9 flex flex-wrap items-center gap-5">
              <Magnetic strength={0.5}>
                <Link to="/shop?category=MENS" className="btn-gold px-8 py-4 text-sm">Shop Men’s Collection</Link>
              </Magnetic>
              <Link to="/shop" className="group inline-flex items-center gap-2 text-cream/90 text-sm font-semibold uppercase tracking-wider hover:text-gold transition">
                View Everything <span className="transition group-hover:translate-x-1">→</span>
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-cream/40"
          animate={{ y: [0, 9, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
        </motion.div>
      </section>

      {/* Marquee ticker */}
      <div className="bg-maroon text-cream/90 py-3.5 overflow-hidden border-y border-gold/20">
        <div className="flex whitespace-nowrap animate-marquee w-max">
          {Array.from({ length: 2 }).map((_, k) => (
            <div key={k} className="flex items-center shrink-0">
              {['Premium Fabric', 'Tailored Fit', 'Free Shipping over ₹1499', 'Secure Razorpay Pay', 'Doorstep Delivery', 'Easy Exchanges'].map((t) => (
                <span key={t} className="flex items-center text-xs uppercase tracking-[0.28em]">
                  <span className="mx-6 text-gold">✦</span>{t}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Categories */}
      <section className="container-px py-20">
        <motion.h2 className="text-4xl md:text-6xl font-serif uppercase tracking-tight text-maroon mb-2"
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease: EASE }}>Shop by Category</motion.h2>
        <p className="text-stone-500 mb-10 text-lg">Find exactly what you’re looking for</p>
        <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-5"
          variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}>
          {CATEGORIES.map((c) => (
            <motion.div key={c.key} variants={fadeUp} whileHover={{ y: -6 }}>
              <Link to={`/shop?category=${c.key}`}
                className="group card overflow-hidden text-center p-8 block transition">
                <div className="mx-auto h-16 w-16 rounded-full bg-cream-dark grid place-items-center font-serif text-2xl text-maroon group-hover:bg-maroon group-hover:text-gold transition">
                  {c.label[0]}
                </div>
                <h3 className="mt-4 font-serif text-xl text-stone-800">{c.label}</h3>
                <p className="text-xs text-stone-500 mt-1">{c.blurb}</p>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Featured — horizontal pinned showcase on desktop */}
      <HorizontalShowcase products={featured} />

      {/* Featured — grid on mobile */}
      <section className="container-px py-16 md:hidden">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-4xl font-serif uppercase tracking-tight text-maroon">Featured</h2>
            <p className="text-stone-500">Handpicked favourites</p>
          </div>
          <Link to="/shop" className="btn-ghost">All →</Link>
        </div>
        {featured.length === 0 ? (
          <p className="text-center text-stone-400 py-10">New collection arriving soon.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-10">
            {featured.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        )}
      </section>

      {/* Trust band */}
      <section className="container-px py-16">
        <div className="border-y border-stone-200 grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-stone-200">
          {[
            { icon: 'refresh' as const, t: 'Easy Exchanges', d: 'Not the right fit? Hassle-free exchanges in store.' },
            { icon: 'shield' as const, t: 'Secure Payments', d: 'Pay safely with cards, UPI & netbanking via Razorpay.' },
            { icon: 'truck' as const, t: 'Tracked Delivery', d: 'Every order ships with a trackable consignment number.' }
          ].map((b) => (
            <div key={b.t} className="p-8 text-center">
              <Icon name={b.icon} className="w-6 h-6 mx-auto text-gold-dark mb-3" />
              <h3 className="font-serif uppercase tracking-wide text-lg text-maroon">{b.t}</h3>
              <p className="text-sm text-stone-500 mt-2 max-w-xs mx-auto">{b.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
