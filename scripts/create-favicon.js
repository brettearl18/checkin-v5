/**
 * Script to create favicon.ico from icon source
 * Usage: node scripts/create-favicon.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sourceImage = path.join(__dirname, '..', 'icon-source.png');
const publicDir = path.join(__dirname, '..', 'public');
const faviconPath = path.join(publicDir, 'favicon.ico');

async function createFavicon() {
  try {
    if (!fs.existsSync(sourceImage)) {
      console.error('❌ Source image not found!');
      console.error(`   Expected: ${sourceImage}`);
      process.exit(1);
    }

    console.log('🖼️  Creating favicon.ico...\n');

    // Create favicon.ico (32x32 is standard, but we'll create multiple sizes)
    // Note: sharp can't directly create .ico files, so we'll create a 32x32 PNG
    // and browsers will accept PNG as favicon
    await sharp(sourceImage)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .toFile(path.join(publicDir, 'favicon-32x32.png'));
    
    console.log('✅ Created favicon-32x32.png');

    // Also create a 16x16 version
    await sharp(sourceImage)
      .resize(16, 16, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .toFile(path.join(publicDir, 'favicon-16x16.png'));
    
    console.log('✅ Created favicon-16x16.png');

    // Copy 32x32 as favicon.ico (browsers will accept PNG with .ico extension)
    fs.copyFileSync(path.join(publicDir, 'favicon-32x32.png'), faviconPath);
    console.log('✅ Created favicon.ico');

    console.log('\n🎉 Favicon created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating favicon:', error.message);
    process.exit(1);
  }
}

createFavicon();

