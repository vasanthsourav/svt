import { db } from '../db'

/**
 * Virtual try-on (face-swap onto a model wearing the product).
 *
 * Pluggable provider with a MOCK fallback — same pattern as the Razorpay service.
 * With no provider configured it runs in mock mode (returns the model photo as a
 * stand-in) so the whole flow is testable for free. Drop in a real face-swap API
 * (Replicate / FASHN / etc.) behind `TRYON_PROVIDER` + its key to go live — no rebuild.
 *
 * Privacy: the uploaded face is used only to produce the preview and is NEVER stored.
 * In a real provider it is streamed to the API and discarded; the mock ignores it.
 */

const PROVIDER = (process.env.TRYON_PROVIDER || 'mock').toLowerCase()
export const tryonLive = PROVIDER !== 'mock'

export interface TryOnResult {
  resultUrl: string
  mock: boolean
  note?: string
}

export async function faceSwapTryOn(params: { productId: number; faceDataUrl: string }): Promise<TryOnResult> {
  const product = await db.product.findUnique({ where: { id: params.productId } })
  if (!product) throw new Error('Product not found.')
  let modelImg: string | null = null
  try { modelImg = (JSON.parse(product.images || '[]')[0]) || null } catch { modelImg = null }

  if (!tryonLive) {
    // MOCK: no AI call, nothing stored. Return the model photo so the UI flow works end to end.
    return {
      resultUrl: modelImg || '',
      mock: true,
      note: 'Preview placeholder — add an AI face-swap key to place the real face on this look.'
    }
  }

  if (!modelImg) throw new Error('This product has no model photo to swap onto.')

  if (PROVIDER === 'replicate') {
    const url = await replicateFaceSwap(params.faceDataUrl, modelImg)
    return { resultUrl: url, mock: false }
  }

  throw new Error(`Unknown TRYON_PROVIDER "${PROVIDER}". Use "mock" or "replicate".`)
}

/**
 * Real face-swap via Replicate. The customer's face is sent as a data URL; the
 * product's model photo is the target. Model + input field names are env-configurable
 * because they differ per model (e.g. cdingram/face-swap uses swap_image + input_image).
 *
 * Setup: TRYON_PROVIDER=replicate, REPLICATE_API_TOKEN=<token>. Optionally override
 * REPLICATE_MODEL / REPLICATE_FACE_FIELD / REPLICATE_TARGET_FIELD.
 * Note: the target (model) photo must be a PUBLICLY reachable URL — Replicate can't
 * fetch a localhost /uploads path, so use hosted product images (or deploy first).
 */
async function replicateFaceSwap(faceDataUrl: string, targetUrl: string): Promise<string> {
  const token = process.env.REPLICATE_API_TOKEN
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set.')
  const model = process.env.REPLICATE_MODEL || 'cdingram/face-swap'
  const faceField = process.env.REPLICATE_FACE_FIELD || 'swap_image'
  const targetField = process.env.REPLICATE_TARGET_FIELD || 'input_image'
  const input: Record<string, string> = { [faceField]: faceDataUrl, [targetField]: targetUrl }

  const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait' },
    body: JSON.stringify({ input })
  })
  let pred: any = await res.json()
  if (!res.ok) throw new Error(pred?.detail || pred?.error || 'Face-swap request failed.')

  // If the API didn't finish synchronously, poll the prediction until it settles.
  let tries = 0
  while (pred?.status && pred.status !== 'succeeded' && pred.status !== 'failed' && pred.status !== 'canceled' && tries < 60) {
    await new Promise((r) => setTimeout(r, 1500)); tries++
    const p = await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${token}` } })
    pred = await p.json()
  }
  if (pred?.status === 'failed' || pred?.status === 'canceled') throw new Error('Face-swap could not be generated. Try a clearer photo.')
  const out = pred?.output
  const url = Array.isArray(out) ? out[0] : out
  if (!url || typeof url !== 'string') throw new Error('No image returned from the face-swap.')
  return url
}
