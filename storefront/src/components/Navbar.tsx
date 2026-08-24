import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import Icon from './Icon'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `text-xs uppercase tracking-[0.15em] transition ${isActive ? 'text-maroon font-semibold' : 'text-stone-500 hover:text-maroon'}`

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  // Close the drawer whenever the route changes.
  const links = (
    <>
      <NavLink to="/" className={navClass}>Home</NavLink>
      <NavLink to="/shop" className={navClass}>Shop</NavLink>
      {user && <NavLink to="/orders" className={navClass}>My Orders</NavLink>}
      {user && !isAdmin && <NavLink to="/affiliate" className="text-xs uppercase tracking-[0.15em] text-gold-dark hover:text-maroon font-semibold">Earn ₹</NavLink>}
      {isAdmin && <NavLink to="/admin" className="text-xs uppercase tracking-[0.15em] text-gold-dark hover:text-maroon font-semibold">Admin</NavLink>}
      <NavLink to="/contact" className={navClass}>Contact</NavLink>
    </>
  )

  return (
    <header className="sticky top-0 z-40 bg-cream/90 backdrop-blur border-b border-gold/20">
      <div className="bg-maroon text-cream/90 text-center text-xs py-1.5 tracking-wide">
        ✦ Free shipping on orders above ₹1499 · Secure payments · Kovilpatti, Tamil Nadu ✦
      </div>

      <nav className="container-px flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid place-items-center h-10 w-10 rounded-full bg-maroon text-gold font-serif text-xl font-bold">S</span>
          <span className="leading-tight">
            <span className="block font-serif text-base md:text-lg font-bold uppercase tracking-tight text-maroon">Sri Venkateshwara Textiles</span>
            <span className="block text-[10px] uppercase tracking-[0.2em] text-gold-dark">Kovilpatti</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">{links}</div>

        <div className="flex items-center gap-2">
          <Link to="/cart" className="relative p-2 text-maroon hover:bg-maroon/5 rounded-full" aria-label="Cart">
            <Icon name="cart" className="w-[22px] h-[22px]" />
            {count > 0 && (
              <motion.span key={count} initial={{ scale: 0.4 }} animate={{ scale: [1.45, 1] }} transition={{ duration: 0.32, ease: 'easeOut' }}
                className="absolute -top-0.5 -right-0.5 grid place-items-center h-5 w-5 rounded-full bg-gold text-maroon-dark text-[11px] font-bold">{count}</motion.span>
            )}
          </Link>

          {user ? (
            <button onClick={() => { logout(); navigate('/') }} className="hidden sm:inline-flex btn-ghost text-xs px-3 py-1.5">Logout</button>
          ) : (
            <Link to="/login" className="hidden sm:inline-flex btn-primary text-xs px-4 py-1.5">Login</Link>
          )}

          {/* Mobile menu button */}
          <button onClick={() => setOpen(true)} className="md:hidden p-2 text-maroon" aria-label="Open menu">
            <Icon name="menu" className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div className="fixed inset-0 bg-[#0e1014]/50 z-50 md:hidden"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside className="fixed top-0 right-0 bottom-0 w-72 bg-cream z-50 md:hidden shadow-2xl flex flex-col"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
              <div className="flex items-center justify-between p-5 border-b border-stone-200">
                <span className="font-serif uppercase tracking-tight text-maroon">Menu</span>
                <button onClick={() => setOpen(false)} className="p-1 text-stone-500" aria-label="Close menu"><Icon name="close" className="w-5 h-5" /></button>
              </div>
              <nav className="flex flex-col gap-1 p-5" onClick={() => setOpen(false)}>
                {[
                  { to: '/', label: 'Home' }, { to: '/shop', label: 'Shop' },
                  ...(user ? [{ to: '/orders', label: 'My Orders' }] : []),
                  ...(user && !isAdmin ? [{ to: '/affiliate', label: 'Earn ₹' }] : []),
                  ...(isAdmin ? [{ to: '/admin', label: 'Admin' }] : []),
                  { to: '/contact', label: 'Contact' }
                ].map((l) => (
                  <NavLink key={l.to} to={l.to} className={({ isActive }) => `py-3 border-b border-stone-100 text-sm uppercase tracking-[0.15em] ${isActive ? 'text-maroon font-semibold' : 'text-stone-600'}`}>{l.label}</NavLink>
                ))}
              </nav>
              <div className="mt-auto p-5">
                {user
                  ? <button onClick={() => { setOpen(false); logout(); navigate('/') }} className="btn-outline w-full">Logout</button>
                  : <Link to="/login" onClick={() => setOpen(false)} className="btn-primary w-full">Login</Link>}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
