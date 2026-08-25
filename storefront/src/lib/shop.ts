// ── Shop business details ────────────────────────────────────────────────────
// Single source of truth used across the footer, contact page and policy pages.
// 👉 OWNER: update phone/email/hours below with your real details before going live
//    (Razorpay activation checks that these match your business).
export const SHOP = {
  name: 'Sri Venkateshwara Textiles',
  tagline: 'Premium Menswear & Family Textiles',
  addressLines: [
    'Nadar Middle School Road',
    'Kovilpatti - 628501',
    'Thoothukudi District, Tamil Nadu, India'
  ],
  gstin: '33ASJPV0060A1Z7',
  phone: '+91 90430 37450',
  whatsapp: '+91 90430 37450',
  email: 'srivenkateshwaratextils@gmail.com',
  hours: 'Mon – Sun · 9:00 AM to 9:00 PM',
  // Last updated date shown on policy pages
  policyUpdated: 'July 2026'
}

// Google Maps links. The query is derived from the shop name + the address above
// rather than stored separately, so the pin can never drift away from the address
// printed on the site — change addressLines and the map follows.
// `?api=1` is Google's documented Maps-URLs format and the `output=embed` form is
// what the "share → embed" dialog produces; neither needs an API key or billing.
const q = encodeURIComponent(`${SHOP.name}, ${SHOP.addressLines.join(', ')}`)
export const MAPS_VIEW_URL = `https://www.google.com/maps/search/?api=1&query=${q}`
export const MAPS_DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${q}`
export const MAPS_EMBED_URL = `https://www.google.com/maps?q=${q}&output=embed`
