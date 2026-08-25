import { SHOP, MAPS_DIRECTIONS_URL, MAPS_EMBED_URL } from '../lib/shop'
import Icon from '../components/Icon'

export default function ContactPage() {
  const S = SHOP
  return (
    <div className="container-px py-12 max-w-3xl">
      <p className="text-[11px] uppercase tracking-[0.3em] text-gold-dark mb-2">Get in touch</p>
      <h1 className="font-serif text-4xl md:text-6xl uppercase tracking-tight text-maroon mb-2">Contact Us</h1>
      <p className="text-stone-500 mb-8 text-lg">We'd love to help — reach us any of these ways.</p>

      <div className="grid sm:grid-cols-2 gap-5">
        <div className="card p-6">
          <h2 className="font-serif text-xl text-maroon mb-3">Visit the Store</h2>
          <p className="text-stone-600 leading-relaxed">
            <span className="font-semibold text-stone-800">{S.name}</span><br />
            {S.addressLines.map((l, i) => <span key={i}>{l}<br /></span>)}
          </p>
          <p className="mt-3 text-sm text-gold-dark">{S.hours}</p>
          <p className="mt-2 text-xs text-stone-400">GSTIN: {S.gstin}</p>
          <a className="btn-outline mt-4 inline-flex items-center gap-2 text-sm" target="_blank" rel="noreferrer" href={MAPS_DIRECTIONS_URL}>
            <Icon name="mapPin" className="w-4 h-4" /> Get Directions
          </a>
        </div>

        <div className="card p-6">
          <h2 className="font-serif text-xl text-maroon mb-3">Get in Touch</h2>
          <ul className="space-y-3 text-stone-600">
            <li className="flex items-center gap-2.5"><Icon name="phone" className="w-4 h-4 text-gold-dark" /> <a className="text-maroon font-semibold" href={`tel:${S.phone.replace(/\s/g, '')}`}>{S.phone}</a></li>
            <li className="flex items-center gap-2.5"><Icon name="whatsapp" className="w-4 h-4 text-gold-dark" /> <a className="text-maroon font-semibold" target="_blank" rel="noreferrer" href={`https://wa.me/${S.whatsapp.replace(/\D/g, '')}`}>{S.whatsapp}</a></li>
            <li className="flex items-center gap-2.5"><Icon name="mail" className="w-4 h-4 text-gold-dark" /> <a className="text-maroon font-semibold" href={`mailto:${S.email}`}>{S.email}</a></li>
          </ul>
          <a className="btn-primary mt-5 inline-flex" target="_blank" rel="noreferrer"
            href={`https://wa.me/${S.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Hi, I have a question about my order')}`}>
            Chat on WhatsApp
          </a>
        </div>
      </div>

      <div className="card mt-5 overflow-hidden">
        <div className="flex items-center justify-between gap-4 p-6 pb-4">
          <h2 className="font-serif text-xl text-maroon">Find Us on the Map</h2>
          <a className="inline-flex items-center gap-1.5 text-sm font-semibold text-maroon hover:text-gold-dark" target="_blank" rel="noreferrer" href={MAPS_DIRECTIONS_URL}>
            Directions <Icon name="external" className="w-3.5 h-3.5" />
          </a>
        </div>
        <iframe
          title={`Map to ${S.name}`}
          src={MAPS_EMBED_URL}
          className="w-full h-[320px] border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>

      <div className="card p-6 mt-5">
        <h2 className="font-serif text-xl text-maroon mb-2">Order help</h2>
        <p className="text-stone-600">For order status, exchanges or returns, please have your <b>order number</b> ready (e.g. SVTO-XXXXXX). See our <a className="text-maroon underline" href="/refund-policy">Refund &amp; Return Policy</a> and <a className="text-maroon underline" href="/shipping-policy">Shipping Policy</a>.</p>
      </div>
    </div>
  )
}
