import { useEffect, useRef, useState } from 'react'

/**
 * SuitUpPreview — a premium "materialization" reveal for a product photo.
 *
 * On Suit Up, the garment forms out of converging golden light: particles fly in,
 * a luminous edge rises up the dress, an arc-reactor blooms at the chest, a metallic
 * sheen sweeps across, then it settles to the real photo. Rendered on <canvas> and
 * tuned to the charcoal/bronze storefront palette. Replaces the old sliced-band effect.
 *
 * Uses the transparent cutout at /uploads/cut/<sha1(imageUrl)>.png when one exists
 * (garment forms on a clean form), else the raw photo. Respects reduced-motion.
 */

async function sha1hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-1', bytes)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const REVEAL = 1400, SPAWN = 1150, SWEEP_AT = 1450, SHIMMER_AT = 2050, FADE_AT = 2650, TOTAL = 3050
const ARC_AT = 0.6

type Particle = { x: number; y: number; tx: number; ty: number; born: number; r: number }

export default function SuitUpPreview({ src, alt }: { src: string; alt?: string }) {
  const [playing, setPlaying] = useState(false)
  const [runId, setRunId] = useState(0)
  const [showShare, setShowShare] = useState(false)
  const [assetSrc, setAssetSrc] = useState(src)

  const overlayRef = useRef<HTMLDivElement>(null)
  const revealRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  // Prefer the clean cutout for the reveal; fall back to the raw photo.
  useEffect(() => {
    let cancelled = false
    setAssetSrc(src)
    sha1hex(src).then((key) => {
      if (cancelled) return
      const cut = `/uploads/cut/${key}.png`
      const probe = new Image()
      probe.onload = () => { if (!cancelled) setAssetSrc(cut) }
      probe.src = cut
    })
    return () => { cancelled = true }
  }, [src])

  const onCutout = assetSrc !== src

  const play = () => { setShowShare(false); setPlaying(true); setRunId((n) => n + 1) }

  // Drive the whole animation imperatively once the overlay + canvas are mounted.
  useEffect(() => {
    if (!playing) return
    const canvas = canvasRef.current, reveal = revealRef.current, overlay = overlayRef.current
    if (!canvas || !reveal || !overlay) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const rect = canvas.getBoundingClientRect()
    const DPR = Math.min(2, window.devicePixelRatio || 1)
    const W = rect.width, H = rect.height
    canvas.width = W * DPR; canvas.height = H * DPR
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)

    const setMask = (p: number) => {
      const front = Math.max(0, Math.min(112, p * 112))
      const g = `linear-gradient(to top, #000 ${Math.max(0, front - 4)}%, rgba(0,0,0,.85) ${front}%, transparent ${Math.min(100, front + 3)}%)`
      reveal.style.webkitMaskImage = g
      reveal.style.maskImage = g
    }
    const easeOut = (x: number) => 1 - Math.pow(1 - x, 3)
    const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)

    const finish = () => {
      setMask(1); reveal.style.filter = 'brightness(1)'; reveal.style.opacity = '1'
      overlay.style.opacity = '0'
      window.setTimeout(() => { setPlaying(false); setShowShare(true) }, 60)
    }

    if (reduce) { finish(); return }

    // Particles converge from a scattered ring onto the garment area.
    const parts: Particle[] = Array.from({ length: 84 }, () => {
      const a = Math.random() * Math.PI * 2, rad = Math.max(W, H) * (0.55 + Math.random() * 0.5)
      return {
        x: W * 0.5 + Math.cos(a) * rad, y: H * 0.5 + Math.sin(a) * rad,
        tx: W * (0.2 + Math.random() * 0.6), ty: H * (0.15 + Math.random() * 0.8),
        born: Math.random() * 0.5, r: 1 + Math.random() * 2.2,
      }
    })
    const chestX = W * 0.5, chestY = H * 0.3
    let arcAt = 0
    setMask(0); reveal.style.opacity = '0'; overlay.style.opacity = '1'
    const t0 = performance.now()

    const frame = (now: number) => {
      const t = now - t0
      ctx.clearRect(0, 0, W, H)

      const p = easeOut(Math.min(1, t / REVEAL))
      setMask(p)
      reveal.style.filter = `brightness(${0.72 + 0.28 * p}) saturate(${0.85 + 0.15 * p})`
      reveal.style.opacity = String(0.5 + 0.5 * Math.min(1, t / 450))

      // rising luminous edge
      if (p < 1) {
        const y = H * (1 - p)
        const g = ctx.createLinearGradient(0, y - 26, 0, y + 8)
        g.addColorStop(0, 'rgba(246,228,184,0)'); g.addColorStop(0.7, 'rgba(246,228,184,.5)'); g.addColorStop(1, 'rgba(215,168,98,0)')
        ctx.fillStyle = g; ctx.fillRect(0, y - 26, W, 34)
        ctx.fillStyle = 'rgba(255,246,225,.85)'; ctx.fillRect(0, y - 1.2, W, 2.4)
      }

      // particles
      ctx.globalCompositeOperation = 'lighter'
      for (const pt of parts) {
        const local = Math.max(0, Math.min(1, (t / SPAWN - pt.born) / (1 - pt.born)))
        if (local <= 0) continue
        const e = easeInOut(local)
        const x = pt.x + (pt.tx - pt.x) * e, y = pt.y + (pt.ty - pt.y) * e
        const a = (local < 0.85 ? local : (1 - (local - 0.85) / 0.15)) * 0.85
        const rr = pt.r * (1.4 - 0.7 * e)
        const gr = ctx.createRadialGradient(x, y, 0, x, y, rr * 4)
        gr.addColorStop(0, `rgba(255,240,205,${a})`); gr.addColorStop(1, 'rgba(215,168,98,0)')
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, rr * 4, 0, 7); ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'

      // arc-reactor bloom
      if (p >= ARC_AT && !arcAt) arcAt = now
      if (arcAt) {
        const at = (now - arcAt) / 620
        if (at < 1) {
          const R = (0.2 + at) * Math.min(W, H) * 0.5, a = (1 - at) * 0.8
          const g = ctx.createRadialGradient(chestX, chestY, 0, chestX, chestY, R)
          g.addColorStop(0, `rgba(255,246,225,${a})`); g.addColorStop(0.4, `rgba(246,228,184,${a * 0.6})`); g.addColorStop(1, 'rgba(215,168,98,0)')
          ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(chestX, chestY, R, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over'
        }
      }

      // metallic sheen sweep, then a softer fabric shimmer
      const sheen = (start: number, dur: number, intensity: number) => {
        if (t < start) return
        const st = (t - start) / dur
        if (st >= 1) return
        const x = (-0.3 + st * 1.6) * W, w = W * 0.28
        const g = ctx.createLinearGradient(x - w, 0, x + w, 0)
        g.addColorStop(0, 'rgba(255,255,255,0)')
        g.addColorStop(0.5, `rgba(255,252,244,${intensity * (1 - Math.abs(st - 0.5) * 2)})`)
        g.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.globalCompositeOperation = 'lighter'; ctx.save()
        ctx.translate(x, 0); ctx.rotate(0.18); ctx.translate(-x, 0)
        ctx.fillStyle = g; ctx.fillRect(x - w, -H * 0.2, w * 2, H * 1.4); ctx.restore()
        ctx.globalCompositeOperation = 'source-over'
      }
      sheen(SWEEP_AT, 650, 0.5)
      sheen(SHIMMER_AT, 750, 0.22)

      // gentle fade of the whole overlay before revealing the real photo
      if (t >= FADE_AT) overlay.style.opacity = String(Math.max(0, 1 - (t - FADE_AT) / (TOTAL - FADE_AT)))

      if (t >= TOTAL) { finish(); return }
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, runId])

  const shareLink = typeof window !== 'undefined' ? window.location.href : ''
  const waHref = `https://wa.me/?text=${encodeURIComponent(`Loved this at Sri Venkateshwara Textiles — ${shareLink}`)}`
  const copyLink = () => { if (navigator.clipboard) navigator.clipboard.writeText(shareLink) }

  return (
    <div className="relative h-full w-full">
      {/* Base image — always present so the frame never goes blank */}
      <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" />

      {playing && (
        <div ref={overlayRef} className="absolute inset-0 overflow-hidden transition-opacity duration-300" style={{ opacity: 1 }}>
          {/* Charcoal stage the garment forms over */}
          <div className="absolute inset-0 bg-maroon-dark" />
          {/* The garment that gets revealed (cutout preferred) */}
          <div
            ref={revealRef}
            className={`absolute inset-0 bg-center ${onCutout ? 'bg-contain bg-no-repeat' : 'bg-cover'}`}
            style={{ backgroundImage: `url("${assetSrc}")`, opacity: 0 }}
          />
          {/* FX canvas */}
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
          {/* HUD corner ticks */}
          {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
            <span key={c} className={`pointer-events-none absolute h-5 w-5 border-[1.5px] border-gold-light/60 ${
              c === 'tl' ? 'top-3 left-3 border-r-0 border-b-0'
              : c === 'tr' ? 'top-3 right-3 border-l-0 border-b-0'
              : c === 'bl' ? 'bottom-3 left-3 border-r-0 border-t-0'
              : 'bottom-3 right-3 border-l-0 border-t-0'}`} />
          ))}
        </div>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={play}
        disabled={playing}
        className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-maroon/85 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-cream backdrop-blur-sm transition hover:bg-gold hover:text-maroon-dark disabled:opacity-60"
        aria-label="Play suit-up preview"
      >
        <span className="text-gold-light">✦</span>
        {playing ? 'Materializing…' : 'Suit Up'}
      </button>

      {/* Share row — appears after the reveal */}
      {showShare && !playing && (
        <div className="absolute bottom-3 left-3 z-10 flex gap-1.5">
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-maroon/85 px-3 py-2 text-[11px] font-semibold text-cream backdrop-blur-sm transition hover:bg-gold hover:text-maroon-dark"
          >
            Share
          </a>
          <button
            type="button"
            onClick={copyLink}
            className="rounded-full bg-maroon/85 px-3 py-2 text-[11px] font-semibold text-cream backdrop-blur-sm transition hover:bg-gold hover:text-maroon-dark"
          >
            Copy link
          </button>
        </div>
      )}
    </div>
  )
}
