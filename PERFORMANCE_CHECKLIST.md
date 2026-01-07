# Performance Optimization Checklist

## ✅ Completed (Quick Wins)

1. ✅ **Image Domains Configured**
   - Added Firebase Storage domains to `next.config.ts`
   - Enables Next.js image optimization for Firebase Storage images

2. ✅ **API Route Caching Added**
   - Added caching headers to `/api/dashboard/check-ins-to-review`
   - Added caching headers to `/api/analytics/overview`
   - Added caching headers to `/api/dashboard/recent-activity`
   - Cache duration: 30-60 seconds with stale-while-revalidate

## 🔄 Next Steps (High Priority)

### 1. Convert Images to Next.js Image Component
**Priority:** 🔴 Critical  
**Impact:** 40-60% reduction in image load time  
**Files to Update:**
- `src/app/clients/[id]/page.tsx` (32 instances)
- `src/app/dashboard/page.tsx`
- `src/app/client-portal/progress-images/page.tsx`

**Example:**
```tsx
// Replace this:
<img src={imageUrl} alt="..." className="..." />

// With this:
import Image from 'next/image';
<Image 
  src={imageUrl} 
  alt="..." 
  width={400}
  height={400}
  loading="lazy"
  className="..."
/>
```

### 2. Add Lazy Loading for Heavy Components
**Priority:** 🟡 High  
**Impact:** 30-40% reduction in initial bundle size  
**Components to Lazy Load:**
- Progress Images Preview
- Charts/Visualizations
- Body Measurements Visualization

**Example:**
```tsx
import { lazy, Suspense } from 'react';

const ProgressImagesPreview = lazy(() => import('./ProgressImagesPreview'));

<Suspense fallback={<div>Loading...</div>}>
  <ProgressImagesPreview />
</Suspense>
```

### 3. Split Large Client Profile Page
**Priority:** 🟡 High  
**Impact:** Better code splitting, faster initial load  
**File:** `src/app/clients/[id]/page.tsx` (6,732 lines)

**Recommendation:** Split into:
- `ClientOverviewTab.tsx`
- `ClientGoalsTab.tsx`
- `ClientAIAnalyticsTab.tsx`
- `ClientProgressImages.tsx`
- `ClientMeasurementHistory.tsx`

### 4. Install Bundle Analyzer
**Priority:** 🟢 Medium  
**Impact:** Identify actual bundle size issues

```bash
npm install --save-dev @next/bundle-analyzer
```

Then update `next.config.ts`:
```ts
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(nextConfig);
```

Run: `ANALYZE=true npm run build`

## 📊 Performance Metrics

### Current Performance (Estimated)
- **First Contentful Paint (FCP):** ~2-3s
- **Time to Interactive (TTI):** ~4-6s
- **Largest Contentful Paint (LCP):** ~3-5s

### Target Performance (After All Optimizations)
- **First Contentful Paint (FCP):** <1.5s
- **Time to Interactive (TTI):** <3s
- **Largest Contentful Paint (LCP):** <2.5s

## 🧪 Testing Performance

1. **Chrome DevTools Lighthouse**
   - Run Lighthouse audit
   - Check Performance score (aim for 90+)
   - Review Core Web Vitals

2. **Network Tab**
   - Check bundle sizes
   - Identify slow requests
   - Verify caching is working

3. **Performance Tab**
   - Record page load
   - Identify bottlenecks
   - Check for long tasks

## 🚀 Deploy Optimizations

After implementing optimizations:
1. Test locally with `npm run build && npm start`
2. Check bundle sizes
3. Test on staging environment
4. Monitor Core Web Vitals in production
5. Deploy to production

