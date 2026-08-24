// Shape DB rows into the JSON the storefront expects (paise→rupees, parse images).

export function serializeProduct(p: any) {
  let images: string[] = []
  try { images = JSON.parse(p.images || '[]') } catch { images = [] }
  const sizes = (p.sizes || [])
    .slice()
    .sort((a: any, b: any) => (a.sortOrder - b.sortOrder) || String(a.label).localeCompare(String(b.label)))
    .map((s: any) => ({ id: s.id, label: s.label, stock: s.stock, inStock: s.stock > 0 }))
  const hasSizes = sizes.length > 0
  const totalStock = hasSizes ? sizes.reduce((sum: number, s: any) => sum + s.stock, 0) : p.stock
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    category: p.category,
    fabric: p.fabric,
    price: p.pricePaise / 100,
    mrp: p.mrpPaise ? p.mrpPaise / 100 : null,
    stock: totalStock,
    inStock: totalStock > 0,
    hasSizes,
    sizes,
    images,
    image: images[0] || null,
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    createdAt: p.createdAt
  }
}

export function serializeOrder(o: any, trackBaseUrl?: string) {
  let history: any[] = []
  try { history = JSON.parse(o.history || '[]') } catch { history = [] }
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    total: o.totalPaise / 100,
    paymentMode: o.paymentMode,
    paidAt: o.paidAt,
    shipping: {
      name: o.shipName, phone: o.shipPhone, line1: o.shipLine1, line2: o.shipLine2,
      city: o.shipCity, state: o.shipState, pincode: o.shipPincode
    },
    carrier: o.carrier,
    trackingNumber: o.trackingNumber,
    trackingUrl: o.trackingNumber && trackBaseUrl ? trackBaseUrl : null,
    lrCopyUrl: o.lrCopyUrl,
    shippedAt: o.shippedAt,
    deliveredAt: o.deliveredAt,
    history,
    createdAt: o.createdAt,
    customer: o.user ? { id: o.user.id, name: o.user.name, email: o.user.email, phone: o.user.phone } : undefined,
    items: (o.items || []).map((it: any) => ({
      id: it.id, productId: it.productId, name: it.name,
      price: it.pricePaise / 100, quantity: it.quantity, image: it.image, size: it.size
    }))
  }
}
