#!/usr/bin/env python3
"""
bgremove.py — generate background-removed cutouts for the "Suit Up" preview.

The storefront's SuitUpPreview component assembles the *cutout* of a product photo
(garment on a clean form) when one exists, and falls back to the raw photo otherwise.
Cutouts are stored at:

    backend/uploads/cut/<sha1(imageUrl)>.png

where imageUrl is the EXACT image string the storefront uses (product.images[i]) —
either a local "/uploads/xxx.jpg" or an external "https://…". The frontend derives
the same sha1 key, so this works for both local uploads and external (Unsplash) images.

This is an OPS/BUILD tool, deliberately kept OUT of the Node runtime and the Docker
image. Run it whenever the catalog's images change.

Usage:
    python3 tools/bgremove.py                       # pull image list from the running API
    python3 tools/bgremove.py --api http://localhost:4100
    python3 tools/bgremove.py --force               # redo even if a cutout exists
    python3 tools/bgremove.py --urls a.jpg b.jpg    # process explicit URLs instead

Setup (one time):
    python3 -m venv tools/.venv
    tools/.venv/bin/pip install rembg pillow onnxruntime
    tools/.venv/bin/python tools/bgremove.py
"""
import argparse
import hashlib
import io
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
UPLOADS = os.path.normpath(os.path.join(HERE, "..", "uploads"))
CUT_DIR = os.path.join(UPLOADS, "cut")


def key_for(url: str) -> str:
    return hashlib.sha1(url.encode("utf-8")).hexdigest()


def load_bytes(url: str, api_base: str) -> bytes:
    """Read an image whether it's a local /uploads path or an external URL."""
    if url.startswith("http://") or url.startswith("https://"):
        req = urllib.request.Request(url, headers={"User-Agent": "svt-bgremove"})
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read()
    if url.startswith("/uploads/"):
        local = os.path.join(UPLOADS, url[len("/uploads/"):])
        with open(local, "rb") as f:
            return f.read()
    # bare filename → assume it's under uploads/
    with open(os.path.join(UPLOADS, url), "rb") as f:
        return f.read()


def image_urls_from_api(api_base: str) -> list:
    with urllib.request.urlopen(f"{api_base}/api/products", timeout=30) as r:
        data = json.loads(r.read())
    urls = []
    for p in data.get("products", []):
        urls.extend(p.get("images", []) or [])
    # de-dup, keep order
    seen, out = set(), []
    for u in urls:
        if u and u not in seen:
            seen.add(u); out.append(u)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Generate rembg cutouts keyed by sha1(imageUrl).")
    ap.add_argument("--api", default="http://localhost:4100", help="backend base URL to read the catalog from")
    ap.add_argument("--urls", nargs="*", help="explicit image URLs to process instead of the API")
    ap.add_argument("--force", action="store_true", help="re-process images that already have a cutout")
    args = ap.parse_args()

    try:
        from rembg import remove
        from PIL import Image
    except ImportError:
        print("ERROR: rembg/Pillow not installed. See the setup notes in this file's docstring.",
              file=sys.stderr)
        return 2

    os.makedirs(CUT_DIR, exist_ok=True)

    urls = args.urls if args.urls else image_urls_from_api(args.api)
    if not urls:
        print("No image URLs found.")
        return 0

    processed = skipped = failed = 0
    for url in urls:
        out_path = os.path.join(CUT_DIR, key_for(url) + ".png")
        if os.path.exists(out_path) and not args.force:
            skipped += 1
            continue
        try:
            raw = load_bytes(url, args.api)
            img = Image.open(io.BytesIO(raw)).convert("RGBA")
            cut = remove(img)
            cut.save(out_path)
            processed += 1
            print(f"  ✓ {url[:70]}  ->  cut/{os.path.basename(out_path)}")
        except Exception as e:  # noqa: BLE001 — a bad image shouldn't abort the batch
            failed += 1
            print(f"  ✗ {url[:70]}  ({e})", file=sys.stderr)

    print(f"\nDone. {processed} processed, {skipped} skipped, {failed} failed. "
          f"Cutouts in: {CUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
