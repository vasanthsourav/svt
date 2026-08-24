import { useEffect } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'
import { inr } from '../lib/format'

// Smoothly counts up/down to `value` (used for cart/checkout totals).
export default function AnimatedNumber({ value, currency = true }: { value: number; currency?: boolean }) {
  const spring = useSpring(value, { stiffness: 140, damping: 22, mass: 0.6 })
  useEffect(() => { spring.set(value) }, [value, spring])
  const text = useTransform(spring, (v) => (currency ? inr(Math.round(v)) : String(Math.round(v))))
  return <motion.span>{text}</motion.span>
}
