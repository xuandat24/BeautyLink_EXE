# Official BeautyLink icon

Source: owner's `D:\Downloads\logo beautyLink.png` (1586×992), matching the supplied B/face
image. `logo-source.png` is an untouched copy; the original external file is not modified.
Only the large B at source coordinates approximately x=562–1032, y=140–607 is used.
The lettering and decorative background are excluded.

`../scripts/generate-branding.py` uses Pillow and explicit hand-traced Bezier alpha masks.
It does not generate replacement artwork or remove colors by brightness thresholds.
Original RGB gradients/highlights remain; the face/neck and hair gaps become transparent.
Mask edges are supersampled 4×, then assets are downsampled with Lanczos on a padded square.
This is a raster/manual cutout, not an original vector master; tiny edge differences remain
possible and the 16px rendition necessarily loses fine facial detail. No AI redraw is used.

Regenerate (Pillow is a development tool, not a new frontend/runtime dependency):

```powershell
python frontend/scripts/generate-branding.py
```

Public assets: `beautylink-icon.png` 544²; PNG favicons 16²/32²; apple-touch 180²;
Android icons 192²/512²; ICO containing 16²/32²/48². Review sheet `icon-review.png`
shows white/navy backgrounds and native favicon sizes. Source/script/review are outside
the public directory and Vite build entry point, so only final assets are deployed.

Header retains its navy/pink text wordmark and slogan. Narrow navigation rows may wrap
instead of overflowing. Root-relative favicon/manifest paths work with the existing root
Vercel deployment. No payment, authentication, booking, backend or database changes.

Deploy only after approval; browser favicon caches may require closing/reopening the tab
or a hard reload. Local verification does not establish a production deployment.

Verification (2026-10-23): 78 frontend tests PASS; TypeScript and Vite build PASS.
All 8 icon/manifest URLs returned HTTP 200 locally and exist in dist; ICO frames and PNG
dimensions/alpha were verified. Browser iframe widths around 320, 375, 430, 768, 1024 and
1920px (including signed-in 320px) had scrollWidth equal to viewport width and loaded the logo.
Desktop cart/login handlers were clicked successfully. This fixture does not call backend APIs.
The in-app browser does not expose native tab chrome: the tiny tab icon itself was not
visually inspected there; favicon resources and configuration were verified.
