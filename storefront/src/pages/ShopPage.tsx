import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../lib/api'
import type { Product } from '../lib/format'
import ProductCard from '../components/ProductCard'
import Icon from '../components/Icon'

export default function ShopPage() {
  const [params, setParams] = useSearchParams()
  const category = params.get('category') || 'ALL'
  const search = params.get('search') || ''
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState(search)

  useEffect(() => {
    api.get<{ categories: string[] }>('/products/categories').then((d) => setCategories(d.categories)).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (category !== 'ALL') qs.set('category', category)
    if (search) qs.set('search', search)
    api.get<{ products: Product[] }>(`/products?${qs.toString()}`)
      .then((d) => setProducts(d.products))
      .finally(() => setLoading(false))
  }, [category, search])

  const setCategory = (c: string) => {
    const next = new URLSearchParams(params)
    if (c === 'ALL') next.delete('category'); else next.set('category', c)
    setParams(next, { replace: true })
  }
  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const next = new URLSearchParams(params)
    if (searchInput.trim()) next.set('search', searchInput.trim()); else next.delete('search')
    setParams(next, { replace: true })
  }

  return (
    <div className="container-px py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-10">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          <p className="text-[11px] uppercase tracking-[0.3em] text-gold-dark mb-2">Sri Venkateshwara Textils</p>
          <h1 className="font-serif text-5xl md:text-7xl uppercase tracking-tight text-maroon leading-[0.9]">The Collection</h1>
          <p className="text-stone-500 mt-2">{loading ? 'Loading…' : `${products.length} piece${products.length === 1 ? '' : 's'}`}</p>
        </motion.div>
        <form onSubmit={submitSearch} className="relative w-full md:w-80">
          <Icon name="search" className="w-4 h-4 absolute left-0 top-1/2 -translate-y-1/2 text-stone-400" />
          <input className="w-full bg-transparent border-b border-stone-300 pl-6 pr-4 py-2.5 text-sm outline-none focus:border-maroon transition placeholder:text-stone-400"
            placeholder="Search shirts, sarees…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </form>
      </div>

      {/* Category filter — editorial underline tabs */}
      <div className="flex flex-wrap gap-x-7 gap-y-2 mb-10 border-b border-stone-200 pb-1">
        {['ALL', ...categories].map((c) => (
          <button key={c} onClick={() => setCategory(c)}
            className={`relative pb-3 text-xs uppercase tracking-[0.15em] transition ${category === c ? 'text-maroon font-semibold' : 'text-stone-400 hover:text-stone-700'}`}>
            {c === 'ALL' ? 'All' : c.charAt(0) + c.slice(1).toLowerCase()}
            {category === c && <motion.span layoutId="cat-underline" className="absolute -bottom-px left-0 right-0 h-0.5 bg-maroon" />}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse bg-cream-dark" />)}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-24 text-stone-400">
          <p className="font-editorial italic text-3xl text-maroon mb-2">Nothing here yet</p>
          <p>Try a different category or search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
          {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
      )}
    </div>
  )
}
