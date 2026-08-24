import { useRef, useState } from 'react'
import { api } from '../lib/api'

/**
 * Virtual try-on modal — the customer uploads a face photo and sees the selected
 * dress "suited up" on a model with their face. The photo is downscaled in the
 * browser, sent for a single preview, and never stored. Currently backed by the
 * mock provider (returns a placeholder); a real AI face-swap key makes it live.
 */

interface Props {
  productId: number
  productName: string
  onClose: () => void
}

interface TryOnResult { resultUrl: string; mock: boolean; note?: string }

// Downscale a chosen image to a max edge and return a JPEG data URL (keeps the upload small).
function resizeToDataUrl(file: File, max = 768): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      const ctx = c.getContext('2d')
      URL.revokeObjectURL(url)
      if (!ctx) return reject(new Error('Could not process the image.'))
      ctx.drawImage(img, 0, 0, w, h)
      resolve(c.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image.')) }
    img.src = url
  })
}

export default function TryOnModal({ productId, productName, onClose }: Props) {
  const [dataUrl, setDataUrl] = useState<string>('')     // downscaled face, ready to send
  const [preview, setPreview] = useState<string>('')     // shown thumbnail
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TryOnResult | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const pickFile = async (file?: File) => {
    setError('')
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Please choose an image file.')
    try {
      const url = await resizeToDataUrl(file)
      setDataUrl(url); setPreview(url)
    } catch (e: any) { setError(e.message) }
  }

  const submit = async () => {
    if (!dataUrl) return setError('Choose a clear, front-facing face photo first.')
    if (!consent) return setError('Please tick the consent box to continue.')
    setLoading(true); setError('')
    try {
      const r = await api.post<TryOnResult>('/tryon', { productId, image: dataUrl, consent: true })
      setResult(r)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const reset = () => { setResult(null); setDataUrl(''); setPreview(''); setConsent(false); setError('') }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-maroon-dark/70 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-lg p-6 relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close" className="absolute top-3 right-3 text-stone-400 hover:text-maroon text-xl leading-none">×</button>
        <h2 className="font-serif text-2xl text-maroon mb-1">Try it on</h2>
        <p className="text-sm text-stone-500 mb-4">See how <span className="font-semibold text-stone-700">{productName}</span> looks with your face.</p>

        {!result ? (
          <>
            {/* Upload */}
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-stone-300 rounded-xl p-6 text-center cursor-pointer hover:border-maroon transition"
            >
              {preview ? (
                <img src={preview} alt="Your photo" className="mx-auto h-40 w-40 object-cover rounded-lg" />
              ) : (
                <div className="text-stone-500">
                  <p className="text-3xl mb-1">📷</p>
                  <p className="text-sm font-medium">Tap to upload a face photo</p>
                  <p className="text-xs text-stone-400 mt-1">A clear, front-facing selfie works best</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])} />

            {/* Consent */}
            <label className="flex items-start gap-2 mt-4 text-xs text-stone-500 cursor-pointer">
              <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>I agree to use my photo to generate this preview. It’s used only for this preview and <b>isn’t stored</b>.</span>
            </label>

            {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}

            <button onClick={submit} disabled={loading || !dataUrl || !consent} className="btn-primary w-full mt-4 py-3">
              {loading ? 'Creating your look…' : 'Try it on'}
            </button>
          </>
        ) : (
          <>
            {/* Result */}
            <div className="relative rounded-xl overflow-hidden bg-cream-dark aspect-[4/5]">
              {result.resultUrl
                ? <img src={result.resultUrl} alt="Your try-on" className="h-full w-full object-cover" />
                : <div className="h-full grid place-items-center text-stone-400">No preview image</div>}
              {result.mock && (
                <>
                  <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider bg-maroon/85 text-cream px-2 py-1 rounded">
                    Mock preview
                  </span>
                  {/* The uploaded face, so it's clear the photo was received and where AI will place it. */}
                  {preview && (
                    <div className="absolute bottom-3 right-3 text-center">
                      <img src={preview} alt="Your face" className="h-20 w-20 object-cover rounded-lg ring-2 ring-cream shadow-lg" />
                      <p className="text-[10px] text-cream mt-1 bg-maroon/70 rounded px-1 py-0.5">AI places this →</p>
                    </div>
                  )}
                </>
              )}
            </div>
            <p className="text-xs text-stone-400 mt-3">
              {result.mock
                ? 'This is a placeholder — the real AI face-swap isn’t switched on yet. Add a face-swap key to place your face on the look.'
                : result.note}
            </p>
            <div className="flex gap-2 mt-4">
              <button onClick={reset} className="btn-outline flex-1">Try another photo</button>
              <button onClick={onClose} className="btn-primary flex-1">Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
