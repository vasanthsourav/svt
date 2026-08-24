import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import type { Product } from '../lib/format'
import { inr } from '../lib/format'
import Icon from './Icon'

// Desktop-only pinned section: scrolling down glides the product row sideways.
export default function HorizontalShowcase({ products }: { products: Product[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const CARD_VW = 27 // card + gap
  const travel = Math.max(0, products.length * CARD_VW + 6 - 94) // vw to move left
  // All hooks must run before any early return (Rules of Hooks).
  const x = useTransform(scrollYProgress, [0, 1], ['0vw', `-${travel}vw`])
  const height = 100 + travel * 0.95 // taller section = more scroll room

  if (products.length < 4) return null

  return (
    <section ref={ref} className="relative hidden md:block bg-[#0e1014] text-cream" style={{ height: `${height}vh` }}>
      <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden">
        <div className="container-px mb-8">
          <p className="text-[11px] uppercase tracking-[0.3em] text-gold mb-2">The Edit</p>
          <h2 className="font-serif text-5xl md:text-7xl uppercase tracking-tight leading-[0.9]">Curated<br />for you</h2>
        </div>

        <motion.div style={{ x }} className="flex gap-[3vw] pl-[6vw] will-change-transform">
          {products.map((p) => (
            <Link key={p.id} to={`/product/${p.slug}`} className="group w-[24vw] shrink-0">
              <div className="aspect-[3/4] overflow-hidden bg-maroon-dark">
                {p.image && <img src={p.image} alt={p.name} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]" />}
              </div>
              <div className="mt-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-gold">{p.category}</p>
                <h3 className="font-serif uppercase tracking-tight text-lg mt-1 line-clamp-1">{p.name}</h3>
                <p className="text-cream/70 mt-0.5">{inr(p.price)}</p>
              </div>
            </Link>
          ))}
        </motion.div>

        <div className="container-px mt-10 text-[11px] text-cream/40 uppercase tracking-[0.25em] flex items-center gap-2">
          Scroll to explore <Icon name="arrowRight" className="w-4 h-4" />
        </div>
      </div>
    </section>
  )
}
