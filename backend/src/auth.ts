import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'
import { db } from './db'

const SECRET = process.env.JWT_SECRET || 'dev-insecure-secret'
const EXPIRES = process.env.JWT_EXPIRES || '30d'

export interface AuthUser {
  id: number
  role: string
  name?: string | null
  email?: string | null
  phone?: string | null
}

export function signToken(user: { id: number; role: string }): string {
  return jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: EXPIRES } as jwt.SignOptions)
}

// Adds req.user when a valid Bearer token is present (does not block).
export async function attachUser(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), SECRET) as { id: number; role: string }
      const user = await db.user.findUnique({ where: { id: payload.id } })
      if (user) {
        ;(req as any).user = {
          id: user.id, role: user.role, name: user.name, email: user.email, phone: user.phone
        } as AuthUser
      }
    } catch {
      /* invalid/expired token — treated as anonymous */
    }
  }
  next()
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).user) return res.status(401).json({ error: 'Please log in to continue.' })
  next()
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as AuthUser | undefined
  if (!user) return res.status(401).json({ error: 'Please log in.' })
  if (user.role !== 'ADMIN') return res.status(403).json({ error: 'Admin access only.' })
  next()
}
