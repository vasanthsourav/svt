import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// Curated, verified Unsplash photos (moderated source — clean, professional, no
// random/unsafe content). The admin replaces these with the shop's real product
// photos from the admin panel. Grouped by category so the look stays on-theme.
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

function imagesFor(category: string, id: number): string[] {
  const pool = POOLS[category] || POOLS.OTHERS
  const a = pool[id % pool.length]
  const b = pool[(id + 1) % pool.length]
  return [U(a), U(b === a ? pool[(id + 2) % pool.length] : b)]
}

async function main() {
  const products = await db.product.findMany()
  for (const p of products) {
    await db.product.update({ where: { id: p.id }, data: { images: JSON.stringify(imagesFor(p.category, p.id)) } })
  }
  console.log(`✓ Updated images for ${products.length} products (curated Unsplash)`)
}

main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1) })
