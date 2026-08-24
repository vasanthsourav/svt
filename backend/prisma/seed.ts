import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

// Curated, verified Unsplash photos (moderated source — clean & professional).
// The admin replaces these with the shop's real product photos from the panel.
const U = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=700&h=900&fit=crop&crop=entropy&q=80&auto=format`

const POOLS: Record<string, string[]> = {
  SAREES: ['1610030469983-98e550d6193c', '1595777457583-95e059d581b8', '1594633312681-425c7b97ccd1', '1525507119028-ed4c629a60a3'],
  WOMENS: ['1490481651871-ab68de25d43d', '1539109136881-3be0616acf4b', '1525507119028-ed4c629a60a3', '1594633312681-425c7b97ccd1'],
  MENS: ['1441986300917-64674bd600d8', '1490114538077-0a7f8cb49891', '1521572163474-6864f9cf17ab', '1593030761757-71fae45fa0e7', '1434389677669-e08b4cac3105', '1596755094514-f87e34085b2c'],
  KIDS: ['1556905055-8f358a7a47b2', '1620799140408-edc6dcb6d633'],
  HOME: ['1581655353564-df123a1eb820', '1445205170230-053b83016050'],
  OTHERS: ['1441986300917-64674bd600d8', '1483985988355-763728e1935b', '1441984904996-e0b6ba687e04', '1445205170230-053b83016050']
}

function imagesFor(category: string, idx: number): string[] {
  const pool = POOLS[category] || POOLS.OTHERS
  const a = pool[idx % pool.length]
  const b = pool[(idx + 1) % pool.length]
  return [U(a), U(b === a ? pool[(idx + 2) % pool.length] : b)]
}

// A small starter catalogue so the storefront looks alive on first run.
// Images use picsum placeholders; the admin replaces them with real photos.
const SAMPLE: Array<{
  name: string; category: string; fabric: string; price: number; mrp: number;
  stock: number; featured?: boolean; desc: string
}> = [
  { name: 'Kanchipuram Silk Saree — Maroon Gold', category: 'SAREES', fabric: 'Pure Silk', price: 4999, mrp: 6499, stock: 12, featured: true, desc: 'Handwoven Kanchipuram pure silk saree with a rich gold zari border and contrast pallu. A timeless festive drape.' },
  { name: 'Soft Cotton Saree — Teal', category: 'SAREES', fabric: 'Cotton', price: 1299, mrp: 1799, stock: 30, featured: true, desc: 'Lightweight handloom cotton saree, breathable and perfect for daily and office wear.' },
  { name: "Men's Cotton Formal Shirt — White", category: 'MENS', fabric: 'Cotton', price: 799, mrp: 1099, stock: 50, featured: true, desc: 'Crisp full-sleeve formal shirt in premium combed cotton. Wrinkle-resistant finish.' },
  { name: "Men's Casual Check Shirt — Blue", category: 'MENS', fabric: 'Cotton Blend', price: 899, mrp: 1299, stock: 40, desc: 'Smart casual check shirt with a modern slim fit. Soft, durable and easy-care.' },
  { name: 'Anarkali Kurti Set — Rose Pink', category: 'WOMENS', fabric: 'Rayon', price: 1499, mrp: 2199, stock: 25, featured: true, desc: 'Flowy floor-length Anarkali kurti with dupatta. Elegant embroidery on the yoke.' },
  { name: 'Cotton Leggings — Pack of 3', category: 'WOMENS', fabric: 'Cotton Lycra', price: 599, mrp: 899, stock: 60, desc: 'Stretchable ankle-length leggings in assorted colours. Skin-friendly cotton lycra.' },
  { name: 'Kids Festive Lehenga — Yellow', category: 'KIDS', fabric: 'Net', price: 1199, mrp: 1699, stock: 18, desc: 'Adorable festive lehenga choli for little ones with sequin work and net flare.' },
  { name: 'Kids Cotton T-Shirt Combo', category: 'KIDS', fabric: 'Cotton', price: 499, mrp: 799, stock: 45, desc: 'Pack of 2 soft cotton printed t-shirts, gentle on kids’ skin.' },
  { name: 'Silk Dhoti with Angavastram', category: 'MENS', fabric: 'Art Silk', price: 1099, mrp: 1499, stock: 22, desc: 'Traditional silk dhoti set with matching angavastram and gold border. Wedding-ready.' },
  { name: 'Bridal Lehenga — Deep Red', category: 'WOMENS', fabric: 'Velvet', price: 8999, mrp: 12999, stock: 6, featured: true, desc: 'Statement bridal lehenga in deep red velvet with heavy zardosi and stone embellishments.' },
  { name: 'Linen Saree — Pastel Green', category: 'SAREES', fabric: 'Linen', price: 1899, mrp: 2499, stock: 20, desc: 'Premium linen saree with a subtle sheen and tassel pallu. Elegant and breathable.' },
  { name: 'Bath & Hand Towel Set', category: 'HOME', fabric: 'Terry Cotton', price: 699, mrp: 999, stock: 35, desc: '500 GSM ultra-soft, highly absorbent towel set. Colour-fast and quick-drying.' }
]

async function main() {
  // Admin
  const email = process.env.ADMIN_EMAIL || 'admin@svttextils.com'
  const password = process.env.ADMIN_PASSWORD || 'admin123'
  const name = process.env.ADMIN_NAME || 'SVT Admin'
  const passwordHash = await bcrypt.hash(password, 10)
  await db.user.upsert({
    where: { email },
    // Don't reset the password on re-seed (deploys restart the app) — keep whatever the
    // admin set. Only the first run (create) applies the ADMIN_PASSWORD from env.
    update: { role: 'ADMIN', name },
    create: { email, role: 'ADMIN', passwordHash, name }
  })
  console.log(`✓ Admin ready: ${email} / ${password}`)

  // Products (only if catalogue is empty, so re-seeding doesn't duplicate)
  const count = await db.product.count()
  if (count === 0) {
    let idx = 0
    for (const p of SAMPLE) {
      idx += 1
      const images = imagesFor(p.category, idx)
      await db.product.create({
        data: {
          name: p.name,
          slug: slugify(p.name),
          description: p.desc,
          category: p.category,
          fabric: p.fabric,
          pricePaise: p.price * 100,
          mrpPaise: p.mrp * 100,
          stock: p.stock,
          isFeatured: !!p.featured,
          images: JSON.stringify(images)
        }
      })
    }
    console.log(`✓ Seeded ${SAMPLE.length} sample products`)

    // Give tops shirt-style sizes, and add trousers with waist sizes — so a
    // fresh install demonstrates per-size stock out of the box.
    const SHIRT: [string, number][] = [['S', 8], ['M', 14], ['L', 16], ['XL', 10], ['XXL', 6]]
    const WAIST = [28, 30, 32, 34, 36, 38, 40]
    const setSizes = async (productId: number, sizes: [string, number][]) => {
      let order = 0
      for (const [label, stock] of sizes) await db.productSize.create({ data: { productId, label, stock, sortOrder: order++ } })
    }
    for (const p of await db.product.findMany()) {
      const n = p.name.toLowerCase()
      if (n.includes('shirt') || n.includes('kurti') || n.includes('anarkali')) await setSizes(p.id, SHIRT)
    }
    const pants = [
      { name: "Men's Slim-Fit Formal Trousers — Charcoal", price: 1199, mrp: 1599, fabric: 'Poly-Viscose', img: '1473966968600-fa801b869a1a' },
      { name: "Men's Cotton Chinos — Beige", price: 1099, mrp: 1499, fabric: 'Cotton', img: '1542272604-787c3835535d' }
    ]
    for (const pt of pants) {
      const created = await db.product.create({
        data: {
          name: pt.name, slug: slugify(pt.name), category: 'MENS', fabric: pt.fabric,
          description: 'Premium tailored fit with a comfortable waistband. Pick your waist size below.',
          pricePaise: pt.price * 100, mrpPaise: pt.mrp * 100, stock: 0, isFeatured: true,
          images: JSON.stringify([`https://images.unsplash.com/photo-${pt.img}?w=700&h=900&fit=crop&crop=entropy&q=80&auto=format`])
        }
      })
      await setSizes(created.id, WAIST.map((w) => [String(w), 6] as [string, number]))
    }
    console.log('✓ Applied sizes to shirts + added trousers (waist 28–40)')
  } else {
    console.log(`• ${count} products already present — skipped sample catalogue`)
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1) })
