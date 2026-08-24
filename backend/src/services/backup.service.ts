import fs from 'fs'
import path from 'path'

// Periodic, safe copies of the SQLite DB so an order/product is never lost to a
// crash or disk issue. Keeps the most recent N snapshots in backend/backups/.
const DB_FILE = path.join(process.cwd(), 'prisma', 'svt-shop.db')
const BACKUP_DIR = path.join(process.cwd(), 'backups')
const EVERY_MS = Number(process.env.BACKUP_INTERVAL_MIN || '60') * 60 * 1000
const KEEP = Number(process.env.BACKUP_KEEP || '48')

function stamp(): string {
  // yyyymmdd-hhmm (uses server local time)
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

function runBackup(): void {
  try {
    if (!fs.existsSync(DB_FILE)) return
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    // Copy the main DB plus WAL/SHM sidecars if present, so the snapshot is complete.
    const dest = path.join(BACKUP_DIR, `svt-shop-${stamp()}.db`)
    fs.copyFileSync(DB_FILE, dest)
    for (const ext of ['-wal', '-shm']) {
      if (fs.existsSync(DB_FILE + ext)) fs.copyFileSync(DB_FILE + ext, dest + ext)
    }
    // Prune old snapshots, keep the newest KEEP .db files.
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.db'))
      .sort()
      .reverse()
    for (const f of files.slice(KEEP)) {
      try {
        fs.unlinkSync(path.join(BACKUP_DIR, f))
        for (const ext of ['-wal', '-shm']) {
          const s = path.join(BACKUP_DIR, f + ext)
          if (fs.existsSync(s)) fs.unlinkSync(s)
        }
      } catch { /* ignore */ }
    }
  } catch (e) {
    console.error('DB backup failed (non-fatal):', (e as Error).message)
  }
}

export function startDbBackups(): void {
  runBackup() // one on startup
  setInterval(runBackup, EVERY_MS)
  console.log(`   Backups:  every ${EVERY_MS / 60000} min → ${BACKUP_DIR} (keep ${KEEP})`)
}
