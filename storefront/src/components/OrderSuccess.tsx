import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const COLORS = ['#b6894d', '#6b1d2b', '#d0a567', '#f4f5f7']
const PIECES = Array.from({ length: 30 }, (_, i) => ({
  angle: (i / 30) * Math.PI * 2 + (i % 3) * 0.3,
  dist: 140 + (i % 5) * 46,
  color: COLORS[i % COLORS.length],
  delay: (i % 7) * 0.03,
  rot: (i % 2 ? 1 : -1) * (200 + (i % 4) * 100),
  size: 6 + (i % 3) * 3
}))

// One-shot celebration shown when an order is freshly placed.
export default function OrderSuccess({ onDone }: { onDone?: () => void }) {
  const [show, setShow] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => { setShow(false); onDone?.() }, 2700)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <AnimatePresence>
      {show && (
        <motion.div className="fixed inset-0 z-[80] grid place-items-center bg-[#0e1014]/95 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShow(false); onDone?.() }}>
          {PIECES.map((p, i) => (
            <motion.span key={i} className="absolute rounded-[1px]" style={{ background: p.color, width: p.size, height: p.size }}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
              animate={{ x: Math.cos(p.angle) * p.dist, y: Math.sin(p.angle) * p.dist + 60, opacity: 0, rotate: p.rot }}
              transition={{ duration: 1.5, delay: 0.3 + p.delay, ease: 'easeOut' }} />
          ))}
          <div className="relative text-center text-cream px-6">
            <motion.svg width="92" height="92" viewBox="0 0 52 52" className="mx-auto"
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 15, delay: 0.1 }}>
              <motion.circle cx="26" cy="26" r="24" fill="none" stroke="#b6894d" strokeWidth="2"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.2 }} />
              <motion.path d="M15 27l7 7 15-15" fill="none" stroke="#b6894d" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.55 }} />
            </motion.svg>
            <motion.p className="font-serif text-3xl md:text-4xl uppercase tracking-tight mt-6"
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.4 }}>Order Confirmed</motion.p>
            <motion.p className="text-cream/60 mt-2 font-light"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.95 }}>Thank you for shopping with us</motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
