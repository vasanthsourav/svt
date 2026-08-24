import { Router } from 'express'
import { db } from '../db'
import { serializeProduct } from '../serialize'

export const productsRouter = Router()

// Public catalogue with optional search / category / featured filters.
productsRouter.get('/', async (req, res) => {
  const { search, category, featured } = req.query as Record<string, string>
  const where: any = { isActive: true }
  if (category && category !== 'ALL') where.category = category
  if (featured === 'true') where.isFeatured = true
  if (search) where.name = { contains: search }

  const products = await db.product.findMany({ where, orderBy: { createdAt: 'desc' }, include: { sizes: true } })
  res.json({ products: products.map(serializeProduct) })
})

// Distinct categories (for the storefront nav / filters).
productsRouter.get('/categories', async (_req, res) => {
  const rows = await db.product.findMany({
    where: { isActive: true }, select: { category: true }, distinct: ['category']
  })
  res.json({ categories: rows.map((r) => r.category).sort() })
})

productsRouter.get('/:slug', async (req, res) => {
  const product = await db.product.findUnique({ where: { slug: req.params.slug }, include: { sizes: true } })
  if (!product || !product.isActive) return res.status(404).json({ error: 'Product not found.' })
  res.json({ product: serializeProduct(product) })
})
