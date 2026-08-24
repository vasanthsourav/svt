import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const U = (id: string) => `https://images.unsplash.com/photo-${id}?w=700&h=900&fit=crop&crop=entropy&q=80&auto=format`
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const SHIRT: [string, number][] = [['S', 8], ['M', 14], ['L', 16], ['XL', 10], ['XXL', 6]]
const WAIST: number[] = [28, 30, 32, 34, 36, 38, 40]

async function setSizes(productId: number, sizes: [string, number][]) {
  await db.productSize.deleteMany({ where: { productId } })
  let order = 0
  for (const [label, stock] of sizes) {
    await db.productSize.create({ data: { productId, label, stock, sortOrder: order++ } })
  }
}

async function main() {
  // Give existing tops/shirts/kurtis shirt-style sizes.
  const products = await db.product.findMany()
  for (const p of products) {
    const n = p.name.toLowerCase()
    if (n.includes('shirt') || n.includes('t-shirt') || n.includes('kurti') || n.includes('anarkali')) {
      await setSizes(p.id, SHIRT)
      console.log(`✓ sizes S–XXL → ${p.name}`)
    }
  }

  // Add trousers/chinos with waist sizes.
  const pants = [
    { name: "Men's Slim-Fit Formal Trousers — Charcoal", price: 1199, mrp: 1599, fabric: 'Poly-Viscose', img: '1473966968600-fa801b869a1a' },
    { name: "Men's Cotton Chinos — Beige", price: 1099, mrp: 1499, fabric: 'Cotton', img: '1542272604-787c3835535d' }
  ]
  for (const pt of pants) {
    const existing = await db.product.findFirst({ where: { name: pt.name } })
    const id = existing
      ? existing.id
      : (await db.product.create({
          data: {
            name: pt.name, slug: slug(pt.name), category: 'MENS', fabric: pt.fabric,
            description: 'Premium tailored fit with a comfortable waistband. Pick your waist size below.',
            pricePaise: pt.price * 100, mrpPaise: pt.mrp * 100, stock: 0, isFeatured: true,
            images: JSON.stringify([U(pt.img)])
          }
        })).id
    await setSizes(id, WAIST.map((w) => [String(w), 6] as [string, number]))
    console.log(`✓ waist sizes ${WAIST[0]}–${WAIST[WAIST.length - 1]} → ${pt.name}`)
  }
  console.log('Done.')
}

main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1) })
