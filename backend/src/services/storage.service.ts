import { v2 as cloudinary } from 'cloudinary'
import fs from 'fs'
import path from 'path'

/**
 * Image storage with a Cloudinary CDN provider and a LOCAL fallback — same shape as
 * the Razorpay/try-on services. When CLOUDINARY_URL is set, images are uploaded to
 * Cloudinary and a permanent HTTPS CDN URL is returned; otherwise they're written to
 * ./uploads and served locally (fine for dev, but that disk is ephemeral on Render —
 * set CLOUDINARY_URL in production so images survive restarts).
 *
 * The Cloudinary SDK auto-reads CLOUDINARY_URL (cloudinary://key:secret@cloud_name).
 */
export const storageIsCloud = !!process.env.CLOUDINARY_URL

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

const extToMime: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf'
}

/**
 * Persist an uploaded file and return a URL to store in the DB.
 * @param folder Cloudinary folder (also namespaces local files); e.g. 'products' | 'shipping'.
 */
export async function saveUpload(buffer: Buffer, originalName: string, folder = 'products'): Promise<string> {
  const ext = (path.extname(originalName) || '.png').toLowerCase()
  const mime = extToMime[ext] || 'application/octet-stream'

  if (storageIsCloud) {
    const dataUri = `data:${mime};base64,${buffer.toString('base64')}`
    const res = await cloudinary.uploader.upload(dataUri, {
      folder: `svt-shop/${folder}`,
      resource_type: mime === 'application/pdf' ? 'auto' : 'image'
    })
    return res.secure_url
  }

  // Local fallback (dev). Not durable on ephemeral hosts.
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  const name = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buffer)
  return `/uploads/${name}`
}
