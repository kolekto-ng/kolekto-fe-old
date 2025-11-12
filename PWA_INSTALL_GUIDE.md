# PWA Install Guide - Kolekto

## Overview
Your Kolekto app now has a Progressive Web App (PWA) install prompt that appears automatically when users visit the landing page. This allows users to "download" and install the app on their devices.

## What Was Implemented

### 1. PWA Install Hook (`src/hooks/usePWAInstall.ts`)
- Detects when the app is installable
- Captures the browser's install prompt event
- Provides methods to trigger installation
- Checks if app is already installed

### 2. PWA Install Prompt Component (`src/components/PWAInstallPrompt.tsx`)
Three display variants:
- **Banner** (default) - Floating banner at bottom of page
- **Button** - Simple install button
- **Card** - Prominent card with features list

### 3. Integration
- Added to HomePage (landing page)
- Service worker registered in main.tsx
- PWA manifest configured in vite.config.ts
- Meta tags added to index.html

## How It Works

### User Flow:
1. User visits your landing page (`/`)
2. Browser checks if app is installable
3. If installable, a green banner appears at the bottom
4. User clicks "Install" button
5. Browser shows native install prompt
6. After installation, the banner is hidden
7. App can be launched from home screen/app drawer

### Auto-Dismiss:
- Users can dismiss the banner (stores in localStorage)
- Won't show if already installed
- Won't show if user previously dismissed it

## Testing the Install Prompt

### Local Development Testing

#### Option 1: Using Chrome DevTools
1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Open Chrome and navigate to `http://localhost:5173`

3. Open DevTools (F12) → Application tab → Manifest section

4. Check "Update on reload" and click "Update"

5. Look for the install banner at the bottom of the page

#### Option 2: Chrome Flags (Force Install)
1. Open Chrome: `chrome://flags/#bypass-app-banner-engagement-checks`
2. Enable the flag
3. Restart Chrome
4. Visit your site - install prompt should appear immediately

#### Option 3: Mobile Simulation
1. Open Chrome DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select a mobile device (e.g., iPhone 12 Pro)
4. Reload the page
5. The install banner should appear

### Production/Deployed Testing

#### Requirements for PWA Install Prompt:
✅ Must be served over HTTPS (or localhost for testing)
✅ Must have a valid manifest file
✅ Must have a registered service worker
✅ User must visit the site at least twice (with 5 minutes between visits) - Chrome requirement
✅ User must engage with the site (click, scroll, etc.)

#### Steps:
1. Deploy your app to production (Netlify/Vercel)
2. Visit the deployed URL on mobile or desktop
3. Interact with the page (scroll, click)
4. Install banner should appear after engagement

### Testing on Different Devices

#### Android (Chrome/Edge):
- ✅ Full support for install prompt
- Shows native "Add to Home Screen" dialog
- Creates app icon on home screen
- Runs in standalone mode

#### iOS (Safari):
- ⚠️ No automatic install prompt (Apple limitation)
- Users must manually: Safari menu → "Add to Home Screen"
- You can add a custom instruction modal for iOS users

#### Desktop (Chrome/Edge):
- ✅ Shows install button in address bar
- ✅ Custom install banner works
- Creates desktop app/shortcut

### Desktop Chrome Install Button
Chrome automatically adds an install button (⊕ icon) in the address bar when your PWA is installable.

## Customization Options

### Change Install Banner Style
Edit `src/pages/HomePage.tsx`:

```tsx
// Banner at bottom (current)
<PWAInstallPrompt variant="banner" />

// Simple button
<PWAInstallPrompt variant="button" />

// Feature card
<PWAInstallPrompt variant="card" />
```

### Add iOS-Specific Instructions
Create a component to detect iOS and show manual instructions:

```tsx
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

{isIOS && (
  <div className="bg-blue-50 p-4 rounded">
    <p>To install on iOS: Tap <ShareIcon /> then "Add to Home Screen"</p>
  </div>
)}
```

### Customize Banner Colors/Text
Edit `src/components/PWAInstallPrompt.tsx` to match your brand.

## PWA Configuration

### Current Setup (vite.config.ts):
- **App Name**: "Kolekto - Smart Group Payment"
- **Theme Color**: #16a34a (green)
- **Start URL**: /pwa/
- **Display Mode**: standalone (full-screen app experience)
- **Icons**: Using your existing logo
- **Offline Support**: Enabled with Workbox caching

### Manifest Location
After build, the manifest is generated at: `/dist/manifest.webmanifest`

## Common Issues & Solutions

### Install Prompt Not Showing?

**Check these:**
1. ✅ Service worker registered? Check DevTools → Application → Service Workers
2. ✅ Manifest valid? Check DevTools → Application → Manifest
3. ✅ HTTPS or localhost? Won't work on HTTP
4. ✅ User engagement? Scroll or click on the page
5. ✅ Not already installed? Check if app is in home screen
6. ✅ Not previously dismissed? Clear localStorage

### Clear Install Dismissal:
```javascript
// In browser console
localStorage.removeItem('pwa-install-dismissed')
// Reload page
```

### Test Install in Incognito:
- No localStorage = always shows prompt
- Fresh PWA detection state

## Analytics & Tracking

You can track install events by adding analytics to the hook:

```typescript
// In usePWAInstall.ts, add to handleAppInstalled:
const handleAppInstalled = () => {
  setIsInstalled(true)
  
  // Track with your analytics
  gtag('event', 'pwa_installed', {
    event_category: 'PWA',
    event_label: 'App Installed'
  })
}
```

## Build & Deploy

### Development:
```bash
npm run dev
# PWA enabled in dev mode (devOptions.enabled: true)
```

### Production Build:
```bash
npm run build
# Generates service worker and manifest
```

### Preview Production Build:
```bash
npm run preview
# Test PWA features locally before deploying
```

## Next Steps

### Enhance PWA Experience:
1. ✅ Add offline page fallback
2. ✅ Implement push notifications
3. ✅ Add update notification UI
4. ✅ Create app shortcuts (for Android)
5. ✅ Add file handling capabilities

### Monitor PWA Usage:
- Track install rate
- Monitor service worker errors
- Check offline usage analytics

## Resources

- [PWA Install Criteria](https://web.dev/install-criteria/)
- [Web App Manifest](https://web.dev/add-manifest/)
- [Service Workers](https://web.dev/service-workers-cache-storage/)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)

## Support

For issues or questions about the PWA implementation, check:
1. Browser console for errors
2. DevTools → Application tab for PWA status
3. Network tab for service worker activity
4. Lighthouse audit for PWA score

