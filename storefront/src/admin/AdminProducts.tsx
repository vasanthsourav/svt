import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { api } from '../lib/api'
import type { Product } from '../lib/format'
import { inr } from '../lib/format'

const CATEGORIES = ['SAREES', 'WOMENS', 'MENS', 'KIDS', 'HOME', 'OTHERS']
const SHIRT_SIZES = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL']
// Pant waist sizes 22–46 (even).
const PANT_SIZES = Array.from({ length: 13 }, (_, i) => String(22 + i * 2))

interface SizeRow { label: string; stock: string }
interface FormState {
  id?: number; name: string; category: string; fabric: string; price: string; mrp: string
  stock: string; description: string; images: string[]; isActive: boolean; isFeatured: boolean
  hasSizes: boolean; sizes: SizeRow[]
}
const empty: FormState = { name: '', category: 'MENS', fabric: '', price: '', mrp: '', stock: '0', description: '', images: [], isActive: true, isFeatured: false, hasSizes: false, sizes: [] }

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<FormState | null>(null)

  const load = () => api.get<{ products: Product[] }>('/admin/products').then((d) => setProducts(d.products)).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const adjustStock = async (p: Product, delta: number) => {
    try { const { product } = await api.patch<{ product: Product }>(`/admin/products/${p.id}/stock`, { delta }); setProducts((ps) => ps.map((x) => x.id === product.id ? product : x)) }
    catch (e: any) { toast.error(e.message) }
  }
  const setStock = async (p: Product, set: number) => {
    try { const { product } = await api.patch<{ product: Product }>(`/admin/products/${p.id}/stock`, { set }); setProducts((ps) => ps.map((x) => x.id === product.id ? product : x)) }
    catch (e: any) { toast.error(e.message) }
  }
  const removeProduct = async (p: Product) => {
    if (!confirm(`Hide "${p.name}" from the store?`)) return
    await api.del(`/admin/products/${p.id}`); toast.success('Product hidden'); load()
  }
  const openEdit = (p: Product) => setForm({
    id: p.id, name: p.name, category: p.category, fabric: p.fabric || '', price: String(p.price),
    mrp: p.mrp ? String(p.mrp) : '', stock: String(p.stock), description: p.description || '',
    images: p.images, isActive: p.isActive, isFeatured: p.isFeatured,
    hasSizes: p.hasSizes, sizes: p.sizes.map((s) => ({ label: s.label, stock: String(s.stock) }))
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="font-serif uppercase tracking-tight text-3xl text-maroon">Products & Stock</h1><p className="text-stone-500">{products.length} products</p></div>
        <button onClick={() => setForm({ ...empty })} className="btn-primary">+ Add Product</button>
      </div>

      {loading ? <p className="text-stone-400">Loading…</p> : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-dark text-stone-600">
              <tr>
                <th className="text-left p-3">Product</th>
                <th className="text-left p-3">Category</th>
                <th className="text-right p-3">Price</th>
                <th className="text-center p-3">Stock</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-dark">
              {products.map((p) => (
                <tr key={p.id} className={p.isActive ? '' : 'opacity-50'}>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-10 rounded bg-cream-dark overflow-hidden shrink-0">{p.image && <img src={p.image} className="h-full w-full object-cover" />}</div>
                      <div>
                        <p className="font-medium text-stone-800 line-clamp-1">{p.name}</p>
                        <p className="text-xs text-stone-400">{p.fabric}{p.isFeatured ? ' · ★ Featured' : ''}{!p.isActive ? ' · Hidden' : ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-stone-600">{p.category}</td>
                  <td className="p-3 text-right font-semibold text-maroon">{inr(p.price)}</td>
                  <td className="p-3">
                    {p.hasSizes ? (
                      <div className="text-center">
                        <p className="font-semibold text-stone-700">{p.stock} total</p>
                        <p className="text-[11px] text-stone-400 max-w-[160px] mx-auto leading-tight">
                          {p.sizes.map((s) => `${s.label}:${s.stock}`).join(' · ')}
                        </p>
                        <button onClick={() => openEdit(p)} className="text-[11px] text-maroon hover:underline">edit sizes</button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => adjustStock(p, -1)} className="h-7 w-7 rounded bg-cream-dark hover:bg-stone-200">−</button>
                        <input className="w-14 text-center input py-1" value={p.stock}
                          onChange={(e) => setProducts((ps) => ps.map((x) => x.id === p.id ? { ...x, stock: Number(e.target.value) || 0 } : x))}
                          onBlur={(e) => setStock(p, Number(e.target.value) || 0)} />
                        <button onClick={() => adjustStock(p, 1)} className="h-7 w-7 rounded bg-cream-dark hover:bg-stone-200">+</button>
                      </div>
                    )}
                    {!p.hasSizes && p.stock <= 3 && <p className="text-[10px] text-rose-500 text-center mt-1">Low</p>}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(p)} className="text-maroon hover:underline mr-3">Edit</button>
                    <button onClick={() => removeProduct(p)} className="text-rose-500 hover:underline">Hide</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && <ProductForm form={form} setForm={setForm} onSaved={() => { setForm(null); load() }} onClose={() => setForm(null)} />}
    </div>
  )
}

function ProductForm({ form, setForm, onSaved, onClose }: {
  form: FormState; setForm: (f: FormState) => void; onSaved: () => void; onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const set = (patch: Partial<FormState>) => setForm({ ...form, ...patch })

  const applyPreset = (labels: string[]) => {
    const byLabel = new Map(form.sizes.map((s) => [s.label.toUpperCase(), s.stock]))
    set({ hasSizes: true, sizes: labels.map((l) => ({ label: l, stock: byLabel.get(l.toUpperCase()) ?? '0' })) })
  }
  const setSizeRow = (i: number, patch: Partial<SizeRow>) =>
    set({ sizes: form.sizes.map((s, x) => x === i ? { ...s, ...patch } : s) })

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      const urls: string[] = []
      for (const file of Array.from(files)) {
        const fd = new FormData(); fd.append('file', file)
        const { url } = await api.upload<{ url: string }>('/admin/upload', fd)
        urls.push(url)
      }
      set({ images: [...form.images, ...urls] })
      toast.success('Image uploaded')
    } catch (e: any) { toast.error(e.message) } finally { setUploading(false) }
  }

  const save = async () => {
    if (!form.name.trim()) return toast.error('Enter a product name')
    if (!form.price || Number(form.price) <= 0) return toast.error('Enter a valid price')
    const sizes = form.hasSizes
      ? form.sizes.filter((s) => s.label.trim()).map((s) => ({ label: s.label.trim().toUpperCase(), stock: Number(s.stock) || 0 }))
      : []
    if (form.hasSizes && sizes.length === 0) return toast.error('Add at least one size, or turn off sizes')
    setBusy(true)
    try {
      const body = {
        name: form.name.trim(), category: form.category, fabric: form.fabric.trim() || undefined,
        price: Number(form.price), mrp: form.mrp ? Number(form.mrp) : null,
        stock: form.hasSizes ? 0 : Number(form.stock) || 0,
        description: form.description.trim() || undefined, images: form.images,
        isActive: form.isActive, isFeatured: form.isFeatured,
        sizes // [] clears sizes for one-size products
      }
      if (form.id) await api.put(`/admin/products/${form.id}`, body)
      else await api.post('/admin/products', body)
      toast.success(form.id ? 'Product updated' : 'Product added')
      onSaved()
    } catch (e: any) { toast.error(e.message) } finally { setBusy(false) }
  }

  const totalSizeStock = form.sizes.reduce((s, x) => s + (Number(x.stock) || 0), 0)

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="card w-full max-w-2xl max-h-[92vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-serif text-2xl text-maroon mb-5">{form.id ? 'Edit Product' : 'Add Product'}</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2"><label className="label">Product Name</label><input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div><label className="label">Category</label>
            <select className="input" value={form.category} onChange={(e) => set({ category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><label className="label">Fabric / Material</label><input className="input" placeholder="Cotton, Silk…" value={form.fabric} onChange={(e) => set({ fabric: e.target.value })} /></div>
          <div><label className="label">Selling Price (₹)</label><input className="input" type="number" value={form.price} onChange={(e) => set({ price: e.target.value })} /></div>
          <div><label className="label">MRP (₹, optional)</label><input className="input" type="number" value={form.mrp} onChange={(e) => set({ mrp: e.target.value })} /></div>
        </div>

        {/* Sizes / stock */}
        <div className="mt-5 rounded-lg border border-stone-200 p-4 bg-cream/40">
          <label className="flex items-center gap-2 font-semibold text-stone-700 text-sm">
            <input type="checkbox" className="accent-maroon h-4 w-4" checked={form.hasSizes} onChange={(e) => set({ hasSizes: e.target.checked })} />
            This product comes in sizes (shirts, pants…)
          </label>

          {!form.hasSizes ? (
            <div className="mt-3 max-w-[200px]">
              <label className="label">Stock Quantity</label>
              <input className="input" type="number" value={form.stock} onChange={(e) => set({ stock: e.target.value })} />
            </div>
          ) : (
            <div className="mt-3">
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="text-xs text-stone-500 self-center">Quick add:</span>
                <button type="button" onClick={() => applyPreset(SHIRT_SIZES)} className="chip bg-maroon text-cream">Shirt S–XXXL</button>
                <button type="button" onClick={() => applyPreset(PANT_SIZES)} className="chip bg-maroon text-cream">Pant waist 22–46</button>
                <button type="button" onClick={() => set({ sizes: [...form.sizes, { label: '', stock: '0' }] })} className="chip bg-white border border-stone-300 text-stone-600">+ Add size</button>
                {form.sizes.length > 0 && <button type="button" onClick={() => set({ sizes: [] })} className="chip bg-white border border-stone-300 text-rose-500">Clear</button>}
              </div>

              {form.sizes.length === 0 ? (
                <p className="text-sm text-stone-400">Pick a preset above, or add sizes one by one. Set the stock for each size.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {form.sizes.map((s, i) => (
                    <div key={i} className="flex items-center gap-1 bg-white rounded-md border border-stone-200 px-2 py-1.5">
                      <input className="w-12 text-center font-semibold text-sm outline-none" value={s.label}
                        onChange={(e) => setSizeRow(i, { label: e.target.value })} placeholder="Size" />
                      <span className="text-stone-300">×</span>
                      <input className="w-12 text-center text-sm outline-none" type="number" value={s.stock}
                        onChange={(e) => setSizeRow(i, { stock: e.target.value })} placeholder="Qty" />
                      <button type="button" onClick={() => set({ sizes: form.sizes.filter((_, x) => x !== i) })}
                        className="ml-auto text-rose-400 hover:text-rose-600 text-sm">×</button>
                    </div>
                  ))}
                </div>
              )}
              {form.sizes.length > 0 && <p className="text-xs text-stone-500 mt-2">Total stock across sizes: <span className="font-semibold text-maroon">{totalSizeStock}</span></p>}
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mt-4">
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-maroon" checked={form.isFeatured} onChange={(e) => set({ isFeatured: e.target.checked })} /> Featured</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-maroon" checked={form.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> Visible</label>
          </div>
          <div className="sm:col-span-2"><label className="label">Description</label><textarea className="input min-h-[80px]" value={form.description} onChange={(e) => set({ description: e.target.value })} /></div>

          <div className="sm:col-span-2">
            <label className="label">Photos</label>
            <div className="flex flex-wrap gap-3">
              {form.images.map((img, i) => (
                <div key={i} className="relative h-20 w-16 rounded-md overflow-hidden bg-cream-dark group">
                  <img src={img} className="h-full w-full object-cover" />
                  <button onClick={() => set({ images: form.images.filter((_, x) => x !== i) })}
                    className="absolute top-0 right-0 bg-rose-600 text-white text-xs h-5 w-5 grid place-items-center opacity-0 group-hover:opacity-100">×</button>
                </div>
              ))}
              <label className="h-20 w-16 rounded-md border-2 border-dashed border-stone-300 grid place-items-center cursor-pointer text-stone-400 hover:border-maroon hover:text-maroon text-xs text-center">
                {uploading ? '…' : '+ Add'}
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button disabled={busy} onClick={save} className="btn-primary px-8">{busy ? 'Saving…' : 'Save Product'}</button>
        </div>
      </div>
    </div>
  )
}
