# Image Optimization Guide

## Current Large Images

Your build includes several large images that slow down load times:

| File | Size | Recommended |
|------|------|-------------|
| featuresImage.png | 2.45 MB | < 500 KB |
| kolekto-on-campus.png | 1.90 MB | < 500 KB |
| hero-image.jpg | 1.47 MB | < 300 KB |
| tier-naira.png | 1.24 MB | < 500 KB |
| cm.png | 1.06 MB | < 500 KB |
| sim_col_image.png | 544 KB | < 300 KB |
| white-labeling.png | 522 KB | < 300 KB |

**Total**: ~8.5 MB of images!

## Quick Fixes

### Option 1: Use Online Tool (Easiest)
1. Visit https://tinypng.com or https://squoosh.app
2. Upload your images
3. Download compressed versions
4. Replace in `src/assets/`

### Option 2: Use ImageMagick (Bulk)
```bash
# Install ImageMagick
# Then run in src/assets/:
magick mogrify -resize 1920x1920\> -quality 85 *.png
magick mogrify -resize 1920x1920\> -quality 85 *.jpg
```

### Option 3: Use Modern Formats (Best)
Convert to WebP (much smaller):
```bash
# For each PNG
magick featuresImage.png -quality 85 featuresImage.webp
```

Then update imports:
```tsx
// Before
import featuresImage from './assets/featuresImage.png'

// After
import featuresImage from './assets/featuresImage.webp'
```

## Vite Image Optimization Plugin

Add automatic image optimization during build:

```bash
npm install -D vite-plugin-imagemin
```

Update `vite.config.ts`:
```typescript
import viteImagemin from 'vite-plugin-imagemin'

export default defineConfig({
  plugins: [
    react(),
    viteImagemin({
      gifsicle: { optimizationLevel: 7 },
      optipng: { optimizationLevel: 7 },
      mozjpeg: { quality: 80 },
      pngquant: { quality: [0.8, 0.9], speed: 4 },
      svgo: {
        plugins: [
          { name: 'removeViewBox' },
          { name: 'removeEmptyAttrs', active: false }
        ]
      }
    }),
    VitePWA({...})
  ]
})
```

## Expected Results

After optimization:
- featuresImage.png: 2.45 MB → ~400 KB (84% smaller)
- hero-image.jpg: 1.47 MB → ~250 KB (83% smaller)
- Total images: 8.5 MB → ~2.5 MB (71% smaller)

**Benefits**:
- Faster page loads
- Lower bandwidth costs
- Better mobile experience
- Smaller PWA cache

## Lazy Loading Images

For images not immediately visible, add lazy loading:

```tsx
<img 
  src={featuresImage} 
  alt="Features"
  loading="lazy"  // ← Add this
/>
```

## Use CDN for Static Assets

Consider hosting large images on a CDN like:
- Cloudinary (free tier)
- Cloudflare Images
- AWS S3 + CloudFront

This keeps them out of your build entirely.

## Priority Order

1. ✅ Optimize hero-image.jpg (first thing users see)
2. ✅ Optimize featuresImage.png (landing page)
3. ✅ Convert to WebP where possible
4. ✅ Add lazy loading
5. Consider CDN for very large images

