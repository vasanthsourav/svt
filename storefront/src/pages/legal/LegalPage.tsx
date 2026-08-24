import { useLocation, Link } from 'react-router-dom'
import { SHOP } from '../../lib/shop'

interface Section { h: string; p: string[] }
interface Doc { title: string; intro: string; sections: Section[] }

const S = SHOP
const addr = S.addressLines.join(', ')

const DOCS: Record<string, Doc> = {
  terms: {
    title: 'Terms & Conditions',
    intro: `These terms govern your use of the ${S.name} online store. By placing an order you agree to them.`,
    sections: [
      { h: '1. About us', p: [`${S.name}, ${addr}. GSTIN: ${S.gstin}. Contact: ${S.phone} · ${S.email}.`] },
      { h: '2. Orders', p: ['All orders are subject to product availability and acceptance. We may cancel an order and refund you if an item is out of stock or a pricing error occurred. Prices are in Indian Rupees (₹) and inclusive of applicable GST.'] },
      { h: '3. Pricing & payment', p: ['Payments are processed securely through Razorpay. We do not store your card or UPI details. Cash on Delivery may be available on select orders.'] },
      { h: '4. Product information', p: ['We take care to describe colours, fabric and sizes accurately, but slight variations in colour may occur due to screen settings. Sizes follow standard measurements shown on each product.'] },
      { h: '5. Shipping & delivery', p: ['Delivery timelines and charges are described in our Shipping Policy. Risk in the goods passes to you on delivery.'] },
      { h: '6. Returns & exchanges', p: ['Please see our Refund & Return Policy for eligibility and the process.'] },
      { h: '7. Limitation of liability', p: [`To the extent permitted by law, ${S.name}'s liability for any order is limited to the value of that order.`] },
      { h: '8. Governing law', p: ['These terms are governed by the laws of India, and disputes are subject to the courts of Thoothukudi District, Tamil Nadu.'] }
    ]
  },
  privacy: {
    title: 'Privacy Policy',
    intro: `${S.name} respects your privacy. This policy explains what we collect and how we use it.`,
    sections: [
      { h: 'Information we collect', p: ['Your name, phone number, email and shipping address (to fulfil orders), and order history. Payment is handled by Razorpay — we never see or store your full card/UPI credentials.'] },
      { h: 'How we use it', p: ['To process and deliver your orders, provide order updates and support, prevent fraud, and (only if you opt in) send offers. We do not sell your personal data to anyone.'] },
      { h: 'Sharing', p: ['We share only what is necessary with our payment gateway (Razorpay) and delivery partner (e.g. India Post) to complete your order, and as required by law.'] },
      { h: 'Data security', p: ['Your data is stored securely and access is restricted to shop staff who need it to serve you.'] },
      { h: 'Your choices', p: [`You can ask us to update or delete your account data any time by contacting ${S.email} or ${S.phone}.`] },
      { h: 'Cookies', p: ['We use minimal browser storage to keep you logged in and remember your cart. No third-party advertising trackers are used.'] }
    ]
  },
  'refund-policy': {
    title: 'Refund, Return & Exchange Policy',
    intro: `We want you to love your purchase. Here's how returns and exchanges work at ${S.name}.`,
    sections: [
      { h: 'Exchange window', p: ['Unused items in original condition with tags intact can be exchanged within 7 days of delivery. Please keep the invoice.'] },
      { h: 'How to request', p: [`Contact us on ${S.phone} / WhatsApp ${S.whatsapp} or email ${S.email} with your order number and the reason. We'll guide you through the return.`] },
      { h: 'Refunds', p: ['Where a refund is due (e.g. an item is unavailable or defective), it is credited back to your original payment method via Razorpay within 5–7 business days of approval.'] },
      { h: 'Non-returnable items', p: ['For hygiene reasons, innerwear and altered/customised items cannot be returned unless defective.'] },
      { h: 'Damaged or wrong item', p: ['If you receive a damaged or wrong item, tell us within 48 hours of delivery with a photo and we will arrange a replacement or full refund at no cost to you.'] }
    ]
  },
  'shipping-policy': {
    title: 'Shipping Policy',
    intro: `How and when your ${S.name} order reaches you.`,
    sections: [
      { h: 'Dispatch time', p: ['Orders are usually packed and dispatched within 1–3 business days after payment confirmation.'] },
      { h: 'Delivery time', p: ['Delivery typically takes 3–8 business days depending on your location, via India Post or a courier partner. You will receive a consignment/tracking number to follow your order.'] },
      { h: 'Shipping charges', p: ['Shipping is free on orders above ₹1499. A nominal delivery charge applies to smaller orders and is shown at checkout.'] },
      { h: 'Tracking', p: ['Once shipped, track your order from the "My Orders" page using the consignment number, or on the India Post tracking site.'] },
      { h: 'Areas served', p: ['We currently deliver across India. For bulk or international orders, please contact us directly.'] }
    ]
  }
}

export default function LegalPage() {
  const { pathname } = useLocation()
  const doc = pathname.replace(/^\//, '') || 'terms'
  const data = DOCS[doc] || DOCS.terms

  return (
    <div className="container-px py-12 max-w-3xl">
      <h1 className="font-serif text-4xl md:text-5xl uppercase tracking-tight text-maroon mb-2">{data.title}</h1>
      <p className="text-stone-500 mb-1">{data.intro}</p>
      <p className="text-xs text-stone-400 mb-8">Last updated: {S.policyUpdated}</p>

      <div className="space-y-6">
        {data.sections.map((s) => (
          <section key={s.h}>
            <h2 className="font-serif text-xl text-maroon mb-1">{s.h}</h2>
            {s.p.map((para, i) => <p key={i} className="text-stone-600 leading-relaxed">{para}</p>)}
          </section>
        ))}
      </div>

      <div className="mt-10 card p-5 text-sm text-stone-600">
        Questions? Contact us at <a className="text-maroon font-semibold" href={`mailto:${S.email}`}>{S.email}</a> or {S.phone}.
        <div className="mt-2"><Link to="/contact" className="text-maroon hover:underline">Contact page →</Link></div>
      </div>
    </div>
  )
}
