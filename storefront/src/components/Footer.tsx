import { Link } from 'react-router-dom'
import { SHOP, MAPS_DIRECTIONS_URL } from '../lib/shop'
import Icon from './Icon'

export default function Footer() {
  return (
    <footer className="mt-20 bg-maroon-dark text-cream/80">
      <div className="container-px py-12 grid gap-8 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <span className="grid place-items-center h-10 w-10 rounded-full bg-gold text-maroon-dark font-serif text-xl font-bold">S</span>
            <span className="font-serif text-lg text-cream">{SHOP.name}</span>
          </div>
          <p className="text-sm leading-relaxed text-cream/60">
            Trusted textile family in Kovilpatti for generations — menswear, sarees, ethnic & everyday wear for the whole family.
          </p>
        </div>
        <div>
          <h4 className="font-serif text-cream mb-3">Shop</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/shop" className="hover:text-gold">All Products</Link></li>
            <li><Link to="/shop?category=MENS" className="hover:text-gold">Men</Link></li>
            <li><Link to="/shop?category=WOMENS" className="hover:text-gold">Women</Link></li>
            <li><Link to="/shop?category=SAREES" className="hover:text-gold">Sarees</Link></li>
            <li><Link to="/shop?category=KIDS" className="hover:text-gold">Kids</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-serif text-cream mb-3">Help & Policies</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/orders" className="hover:text-gold">Track Order</Link></li>
            <li><Link to="/contact" className="hover:text-gold">Contact Us</Link></li>
            <li><Link to="/shipping-policy" className="hover:text-gold">Shipping Policy</Link></li>
            <li><Link to="/refund-policy" className="hover:text-gold">Refund & Returns</Link></li>
            <li><Link to="/terms" className="hover:text-gold">Terms & Conditions</Link></li>
            <li><Link to="/privacy" className="hover:text-gold">Privacy Policy</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-serif text-cream mb-3">Visit Us</h4>
          <p className="text-sm text-cream/60 leading-relaxed">
            {SHOP.addressLines.map((l, i) => <span key={i}>{l}<br /></span>)}
            <span className="text-gold">{SHOP.hours}</span>
          </p>
          <a className="inline-flex items-center gap-2 mt-2 text-sm text-gold hover:text-cream" target="_blank" rel="noreferrer" href={MAPS_DIRECTIONS_URL}>
            <Icon name="mapPin" className="w-4 h-4" /> Get Directions
          </a>
          <div className="text-sm text-cream/60 mt-3 space-y-1.5">
            <a className="flex items-center gap-2 hover:text-gold" href={`tel:${SHOP.phone.replace(/\s/g, '')}`}><Icon name="phone" className="w-4 h-4 text-gold" /> {SHOP.phone}</a>
            <a className="flex items-center gap-2 hover:text-gold" href={`mailto:${SHOP.email}`}><Icon name="mail" className="w-4 h-4 text-gold" /> {SHOP.email}</a>
          </div>
        </div>
      </div>
      <div className="border-t border-cream/10 py-4 text-center text-xs text-cream/50">
        © {new Date().getFullYear()} {SHOP.name}, Kovilpatti · GSTIN {SHOP.gstin} · All rights reserved.
      </div>
    </footer>
  )
}
