# Quick Start: Adding Your Custom Body Measurement Image

## Step 1: Add Your Image
1. Place your image file in the `public/images/` folder
   - Recommended name: `body-measurement-silhouette.png`
   - Or any name you prefer (PNG, SVG, or JPG)

## Step 2: Enable Custom Image
Open `src/app/client-portal/measurements/page.tsx` and find the `BodyMeasurementsVisualization` component (around line 1076).

Change:
```typescript
// useCustomImage={true}
// customImageUrl="/images/your-custom-silhouette.png"
```

To:
```typescript
useCustomImage={true}
customImageUrl="/images/body-measurement-silhouette.png"  // Your image name
```

## Step 3: Map Measurement Points (Important!)

### Option A: Use Default Coordinates (Quick Test)
First, try the default coordinates to see how they align with your image. You may only need minor adjustments.

### Option B: Calculate New Coordinates
1. Open your image in any image editor
2. Note the image dimensions (e.g., 800x800px)
3. For each body part, find the center point coordinates in pixels
4. Convert to percentage:
   ```
   x_percentage = (x_pixel / image_width) * 100
   y_percentage = (y_pixel / image_height) * 100
   ```

5. Update coordinates in `src/components/BodyMeasurementsVisualization.tsx`:
   ```typescript
   const measurementPoints = {
     chest: { x: 50, y: 28, label: 'Chest', value: measurements.chest },
     waist: { x: 50, y: 45, label: 'Waist', value: measurements.waist },
     // ... update all coordinates
   };
   ```

### Quick Reference: Typical Coordinates
- **Chest**: Center torso, upper third (x: 50, y: 25-30)
- **Waist**: Center torso, middle (x: 50, y: 40-50)
- **Hips**: Center torso, lower third (x: 50, y: 50-60)
- **Left/Right Arm**: Upper arm area (x: 20-30 / 70-80, y: 30-40)
- **Left/Right Thigh**: Upper leg (x: 40-45 / 55-60, y: 65-75)

## Step 4: Test
1. Refresh the measurements page
2. Check if measurement indicators align with your image
3. Adjust coordinates as needed

## Troubleshooting

**Image not showing?**
- Check file is in `public/images/` folder
- Verify file name matches `customImageUrl` prop
- Check browser console for errors

**Indicators not aligned?**
- Recalculate coordinates using the formula above
- Test one measurement point at a time
- Use browser dev tools to inspect element positions

**Need help?**
- See `BODY_MEASUREMENTS_CUSTOM_IMAGE_GUIDE.md` for detailed instructions
- Use browser dev tools to find pixel positions
- Test with chest measurement first (usually easiest to align)

## Example: Using Firebase Storage URL
If your image is stored in Firebase Storage:
```typescript
useCustomImage={true}
customImageUrl="https://firebasestorage.googleapis.com/v0/b/your-project.appspot.com/o/silhouette.png?alt=media"
```

## Example: Using External URL
```typescript
useCustomImage={true}
customImageUrl="https://your-domain.com/images/custom-silhouette.png"
```

