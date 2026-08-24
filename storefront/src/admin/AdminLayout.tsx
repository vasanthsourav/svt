import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import Icon, { IconName } from '../components/Icon'

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/admin', label: 'Dashboard', icon: 'grid', end: true },
  { to: '/admin/products', label: 'Products & Stock', icon: 'package' },
  { to: '/admin/orders', label: 'Orders', icon: 'list' },
  { to: '/admin/affiliates', label: 'Affiliates', icon: 'users' },
  { to: '/admin/payouts', label: 'Payouts', icon: 'wallet' },
  { to: '/admin/platform', label: 'Platform Fee', icon: 'wallet' }
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="min-h-screen flex bg-cream">
      {/* Sidebar */}
      <aside className="w-60 bg-maroon-dark text-cream/70 flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="p-5 border-b border-cream/10">
          <Link to="/admin" className="flex items-center gap-2.5">
            <span className="grid place-items-center h-9 w-9 rounded-md bg-gold text-maroon-dark font-serif font-bold">S</span>
            <span className="font-serif uppercase tracking-wide text-cream text-sm">SVT Admin</span>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `flex items-center gap-3 px-3.5 py-2.5 rounded-md text-sm font-medium transition ${isActive ? 'bg-gold text-maroon-dark' : 'hover:bg-cream/10 hover:text-cream'}`}>
              <Icon name={n.icon} className="w-[18px] h-[18px]" /> {n.label}
            </NavLink>
          ))}
          <Link to="/" className="flex items-center gap-3 px-3.5 py-2.5 rounded-md text-sm hover:bg-cream/10 hover:text-cream mt-4 transition">
            <Icon name="external" className="w-[18px] h-[18px]" /> View Storefront
          </Link>
        </nav>
        <div className="p-3 border-t border-cream/10">
          <p className="px-2 text-xs text-cream/40 mb-2 truncate">{user?.email}</p>
          <button onClick={() => { logout(); navigate('/admin/login') }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm bg-cream/10 hover:bg-cream/20 transition">
            <Icon name="logout" className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-6 md:p-8 max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
