import { PrismaClient } from '@prisma/client'

export const db = new PrismaClient()

// Money helpers — we store paise (integers) and present rupees.
export const toPaise = (rupees: number) => Math.round(rupees * 100)
export const toRupees = (paise: number) => paise / 100
