import { Router } from 'express'
import { faceSwapTryOn } from '../services/tryon.service'

export const tryonRouter = Router()

// Generate a virtual try-on preview. Public — no login needed to try a look on.
// The uploaded face is processed for this request only and never stored.
tryonRouter.post('/', async (req, res) => {
  const { productId, image, consent } = req.body || {}
  if (!consent) return res.status(400).json({ error: 'Please tick the consent box before uploading your photo.' })
  if (typeof image !== 'string' || !image.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Upload a clear, front-facing photo of your face.' })
  }
  // ~2.6MB base64 cap (client already downscales); guards the JSON body limit.
  if (image.length > 2_600_000) return res.status(413).json({ error: 'Photo is too large — try a smaller image.' })
  if (!Number.isInteger(productId)) return res.status(400).json({ error: 'Missing product.' })

  try {
    const result = await faceSwapTryOn({ productId, faceDataUrl: image })
    res.json(result)
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Try-on failed. Please try again.' })
  }
})
