# Body Measurements Custom Image Guide

## Overview
This guide explains how to replace the default SVG human silhouette with your own custom image and configure measurement point indicators.

## How It Works

### Current System
- The component currently uses an inline SVG silhouette
- Measurement points are defined using percentage-based coordinates (0-100 for x and y)
- The viewBox is `0 0 100 100`, where:
  - `x: 0` = left edge
  - `x: 50` = center
  - `x: 100` = right edge
  - `y: 0` = top edge
  - `y: 50` = middle
  - `y: 100` = bottom edge

### Custom Image Option
You can replace the SVG with your own image (PNG, SVG, JPG) and adjust the measurement point coordinates to match your image.

## Step-by-Step: Uploading and Configuring Your Custom Image

### Step 1: Prepare Your Image
1. Create or obtain your custom human silhouette image
2. Recommended format: **PNG with transparent background** or **SVG**
3. Recommended dimensions: **Square aspect ratio** (e.g., 800x800px, 1000x1000px)
4. The image should show a front-facing human figure (head to toe)

### Step 2: Upload Your Image
1. Place your image in: `public/images/body-measurement-silhouette.png`
   - Or: `public/images/body-measurement-silhouette.svg`
   - Or: `public/images/body-measurement-silhouette.jpg`

2. **Alternative: Use Firebase Storage**
   - Upload to Firebase Storage
   - Get the public URL
   - Update the component to use the URL

### Step 3: Update the Component
The component has been updated to support custom images. You can:
- Use a local file path
- Use a Firebase Storage URL
- Use any publicly accessible image URL

### Step 4: Map Measurement Points

#### Finding Coordinates for Your Image
1. Open your image in an image editor (Photoshop, Figma, GIMP, etc.)
2. Note the dimensions (width x height)
3. For each body part, find the center point:
   - **Chest**: Center of the chest area
   - **Waist**: Center of the waist/navel area
   - **Hips**: Center of the hip area
   - **Arms**: Center of upper arm (bicep area)
   - **Thighs**: Center of upper thigh
   - **Calves**: Center of lower leg (calf area)

#### Converting to Percentage Coordinates
Use this formula:
```
x_percentage = (x_pixel / image_width) * 100
y_percentage = (y_pixel / image_height) * 100
```

**Example:**
- Image size: 800x800px
- Chest center at: (400px, 224px)
- Calculation:
  - x: (400 / 800) * 100 = 50%
  - y: (224 / 800) * 100 = 28%
- Result: `{ x: 50, y: 28 }`

### Step 5: Update Measurement Points Configuration

Edit `src/components/BodyMeasurementsVisualization.tsx` and update the `measurementPoints` object:

```typescript
const measurementPoints = {
  shoulders: { x: 50, y: 15, label: 'Shoulders', value: measurements.shoulders },
  neck: { x: 50, y: 18, label: 'Neck', value: measurements.neck },
  chest: { x: 50, y: 28, label: 'Chest', value: measurements.chest },
  leftBicep: { x: 25, y: 35, label: 'Left Bicep', value: measurements.leftBicep },
  rightBicep: { x: 75, y: 35, label: 'Right Bicep', value: measurements.rightBicep },
  // ... update all coordinates to match your image
};
```

## Measurement Point Reference

### Standard Measurement Points (with typical coordinates)
- **Shoulders**: Top of shoulders (x: 50, y: 15-18)
- **Neck**: Neck base (x: 50, y: 18-20)
- **Chest**: Chest center (x: 50, y: 25-30)
- **Left/Right Bicep**: Upper arm (x: 20-30 / x: 70-80, y: 30-40)
- **Left/Right Forearm**: Lower arm (x: 15-25 / x: 75-85, y: 40-50)
- **Waist**: Waist/navel (x: 50, y: 40-50)
- **Hips**: Hip center (x: 50, y: 50-60)
- **Left/Right Thigh**: Upper leg (x: 40-45 / x: 55-60, y: 65-75)
- **Left/Right Calf**: Lower leg (x: 38-42 / x: 58-62, y: 85-92)

## Visual Testing

### Quick Test Method
1. Use a tool like Figma or a web-based coordinate finder
2. Overlay a 100x100 grid on your image
3. Click on each body part and note the grid coordinates
4. Convert to percentages (if grid is 10x10, multiply by 10)

### Browser Developer Tools
1. Open the measurements page in your browser
2. Right-click on the silhouette area → Inspect
3. Use the browser's measurement tools to find pixel positions
4. Convert to percentages based on the rendered size

## Advanced: Dynamic Image Upload (Future Enhancement)

For a fully dynamic system, you could:
1. Create an admin interface for uploading images
2. Store image URLs in database/Firebase Storage
3. Store measurement point coordinates in database
4. Allow coaches to customize per client or globally

## Troubleshooting

### Image Not Showing
- Check file path is correct
- Ensure image is in `public/` folder (for Next.js)
- Verify image format is supported (PNG, SVG, JPG)
- Check browser console for errors

### Measurement Points Not Aligned
- Recalculate coordinates using the formula above
- Ensure you're measuring from the center of each body part
- Test with one measurement point first before mapping all

### Image Too Large/Small
- Adjust the `max-w-md` class or width styles
- Consider image dimensions (larger images = better precision)
- Use CSS to control sizing: `className="w-full max-h-[600px] object-contain"`

## Example Configuration

```typescript
// Custom image path
const customImagePath = '/images/body-measurement-silhouette.png';

// Measurement points for your custom image
const measurementPoints = {
  chest: { x: 50, y: 28, label: 'Chest', value: measurements.chest },
  waist: { x: 50, y: 45, label: 'Waist', value: measurements.waist },
  hips: { x: 50, y: 55, label: 'Hips', value: measurements.hips },
  leftArm: { x: 25, y: 35, label: 'Left Arm', value: measurements.leftArm },
  rightArm: { x: 75, y: 35, label: 'Right Arm', value: measurements.rightArm },
  leftThigh: { x: 42, y: 70, label: 'Left Thigh', value: measurements.leftThigh },
  rightThigh: { x: 58, y: 70, label: 'Right Thigh', value: measurements.rightThigh },
};
```

## Need Help?

If you need assistance:
1. Share your image and we can help map the coordinates
2. Use the browser developer tools to find exact pixel positions
3. Test with one measurement point first, then expand

