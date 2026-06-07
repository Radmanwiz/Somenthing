# Font Studio optimization notes

## What changed

- Removed `vite-plugin-singlefile` from the Vite build.
- Removed the huge `assetsInlineLimit: 10_000_000` setting that forced assets/fonts into `index.html`.
- Restored normal Vite asset output so JS, CSS, SVGs, and WOFF2 fonts can be cached independently.
- Added production chunk splitting with named vendor chunks for React, Base UI, OpenType parsing, icons, and small utility libraries.
- Moved `opentype.js` behind a dynamic import so the 236 KB parser chunk is not loaded on initial page load; it loads only when importing/parsing local fonts.
- Lazy-loaded the import and glyph dialogs so Base UI dialog/select code is deferred until the dialogs are opened.
- Added a search index memo for curated families, so the app does not rebuild searchable text on every filter pass.
- Added memoized tag counts instead of filtering all families for every tag row.
- Debounced localStorage persistence by 250 ms to reduce write pressure while typing.

## Build results

Original uploaded production build:

- `dist/index.html`: ~878 KB, with JS/CSS/fonts embedded.
- Gzip: ~303 KB.

Optimized Vite build:

- `dist/index.html`: ~0.8 KB.
- Initial app JS chunk: ~43 KB raw / ~11 KB gzip.
- CSS: ~96 KB raw / ~16 KB gzip.
- React vendor: ~336 KB raw / ~109 KB gzip.
- OpenType parser is now deferred: ~237 KB raw / ~66 KB gzip.
- WOFF2 fonts are emitted as real font files instead of base64 text inside HTML.

## How to run

```bash
npm install
npm run build
npm run preview
```

## Deployment

Upload the whole `dist/` folder. Do not upload only `dist/index.html`, because assets now live in `dist/assets/`.

If your server supports precompressed files, serve `.gz` versions with the correct `Content-Encoding: gzip` header.
