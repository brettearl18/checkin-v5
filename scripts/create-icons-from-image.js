/**
 * Script to create app icons from a source image
 * 
 * Usage:
 * 1. Place your source image (PNG/JPG) in the root directory as 'icon-source.png'
 * 2. Run: node scripts/create-icons-from-image.js
 * 
 * This will create:
 * - public/icon-192.png (192x192) - High quality with sharp resampling
 * - public/icon-512.png (512x512) - High quality with sharp resampling
 * - public/apple-touch-icon.png (180x180) - High quality for iOS
 * 
 * Note: This requires sharp package. Install with: npm install sharp --save-dev
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sourceImage = path.join(__dirname, '..', 'icon-source.png');
const publicDir = path.join(__dirname, '..', 'public');

// Create public directory if it doesn't exist
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

async function createIcons() {
  try {
    // Check if source image exists
    if (!fs.existsSync(sourceImage)) {
      console.error('❌ Source image not found!');
      console.error(`   Expected: ${sourceImage}`);
      console.error('\n   Please place your source image as "icon-source.png" in the root directory');
      process.exit(1);
    }

    console.log('🖼️  Creating app icons from source image...\n');

    // Create 192x192 icon with safe zone padding for Android
    // For maskable icons, we need a safe zone (80% of the icon = 153x153)
    // Fill 95% to make logo/text as large as possible = ~182x182
    // Use lanczos3 kernel for sharper downscaling and high quality
    // Apply sharpening to improve clarity, especially for text
    await sharp(sourceImage)
      .sharpen({ sigma: 2.0, m1: 1.5, m2: 3.0, x1: 2.0, y2: 10.0, y3: 20.0 })
      .resize(182, 182, {
        fit: 'contain',
        kernel: 'lanczos3',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .extend({
        top: 5,
        bottom: 5,
        left: 5,
        right: 5,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png({ 
        quality: 100,
        compressionLevel: 9,
        adaptiveFiltering: true
      })
      .toFile(path.join(publicDir, 'icon-192.png'));
    console.log('✅ Created icon-192.png (high quality, with safe zone padding)');

    // Create 512x512 icon with safe zone padding for Android
    // Safe zone = 80% = 409x409, fill 95% = ~486x486 for maximum size
    // Apply stronger sharpening for text clarity
    await sharp(sourceImage)
      .sharpen({ sigma: 2.0, m1: 1.5, m2: 3.0, x1: 2.0, y2: 10.0, y3: 20.0 })
      .resize(486, 486, {
        fit: 'contain',
        kernel: 'lanczos3',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .extend({
        top: 13,
        bottom: 13,
        left: 13,
        right: 13,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png({ 
        quality: 100,
        compressionLevel: 9,
        adaptiveFiltering: true
      })
      .toFile(path.join(publicDir, 'icon-512.png'));
    console.log('✅ Created icon-512.png (high quality, with safe zone padding)');

    // Create 180x180 Apple touch icon (iOS doesn't need safe zone, can use more space)
    // Apply sharpening to improve clarity
    await sharp(sourceImage)
      .sharpen({ sigma: 1.5, m1: 1.0, m2: 2.0, x1: 2.0, y2: 10.0, y3: 20.0 })
      .resize(170, 170, {
        fit: 'contain',
        kernel: 'lanczos3',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .extend({
        top: 5,
        bottom: 5,
        left: 5,
        right: 5,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png({ 
        quality: 100,
        compressionLevel: 9,
        adaptiveFiltering: true
      })
      .toFile(path.join(publicDir, 'apple-touch-icon.png'));
    console.log('✅ Created apple-touch-icon.png (high quality)');

    console.log('\n🎉 All icons created successfully!');
    console.log('   Icons saved to: public/');
    console.log('\n   Next steps:');
    console.log('   1. Review the icons in the public folder');
    console.log('   2. Deploy to see them on mobile devices');
    
  } catch (error) {
    console.error('❌ Error creating icons:', error.message);
    if (error.message.includes('sharp')) {
      console.error('\n   You may need to install sharp:');
      console.error('   npm install sharp --save-dev');
    }
    process.exit(1);
  }
}

createIcons();

