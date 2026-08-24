import { motion, useScroll, useSpring } from 'framer-motion'

// Thin gold bar at the very top that fills as you scroll the page.
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.25 })
  return (
    <motion.div
      style={{ scaleX }}
      className="fixed top-0 left-0 right-0 h-[3px] bg-gold origin-left z-[60] pointer-events-none"
    />
  )
}
