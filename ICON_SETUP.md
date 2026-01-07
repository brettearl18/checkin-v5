# Mobile App Icon Setup

To set a custom icon when users add your web app to their home screen, you need to add icon files to the `public` folder.

## Required Icon Files

Add these files to the `public` folder:

1. **`icon-192.png`** - 192x192 pixels (for Android/Chrome)
2. **`icon-512.png`** - 512x512 pixels (for Android/Chrome)
3. **`apple-touch-icon.png`** - 180x180 pixels (for iOS/Safari)

## Icon Design Guidelines

- **Square format** - Icons should be square (equal width and height)
- **No transparency for iOS** - Apple touch icons should have a solid background
- **Maskable icons** - For Android, icons should be "maskable" (safe zone in center)
- **Simple design** - Icons should be recognizable at small sizes

## Icon Creation Tools

You can create icons using:
- Design tools (Figma, Photoshop, Canva)
- Online generators (https://realfavicongenerator.net/, https://favicon.io/)
- Convert from existing logo/icon

## What's Already Configured

✅ `manifest.json` - Configured for Android/Chrome
✅ `layout.tsx` - Metadata configured for icons
✅ Apple Web App settings - Configured for iOS

## Testing

After adding the icon files:

1. **On iOS (iPhone/iPad):**
   - Open Safari
   - Visit your site
   - Tap the Share button
   - Select "Add to Home Screen"
   - The icon should appear with your custom icon

2. **On Android:**
   - Open Chrome
   - Visit your site
   - Tap the menu (3 dots)
   - Select "Add to Home screen" or "Install app"
   - The icon should appear with your custom icon

## Current Status

⏳ **Waiting for icon files** - Once you add the icon files above to the `public` folder, the custom icon will automatically appear when users add your app to their home screen.

