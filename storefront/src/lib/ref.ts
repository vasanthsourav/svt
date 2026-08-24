// Remembers a referral code from a shared link (?ref=CODE) until checkout.
const KEY = 'svt_ref'
export const getRef = () => localStorage.getItem(KEY) || ''
export const setRef = (code: string) => { if (code) localStorage.setItem(KEY, code.toUpperCase()) }
export const clearRef = () => localStorage.removeItem(KEY)

// Count a click on an affiliate link, at most once per code per day (so refreshes/
// re-opens don't inflate the number). Fire-and-forget; never blocks the page.
function pingClick(code: string) {
  try {
    const day = new Date().toISOString().slice(0, 10)
    const seenKey = `svt_ref_click_${code}_${day}`
    if (localStorage.getItem(seenKey)) return
    localStorage.setItem(seenKey, '1')
    fetch('/api/affiliate/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    }).catch(() => {})
  } catch { /* ignore */ }
}

// Call once on app load to capture ?ref= from the URL.
export function captureRefFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref) {
      setRef(ref)
      pingClick(ref.toUpperCase())
      // tidy the URL so the code isn't shown/re-shared accidentally
      params.delete('ref')
      const qs = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash)
    }
  } catch { /* ignore */ }
}
