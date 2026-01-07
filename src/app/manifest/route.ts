import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * API route to serve manifest.json
 * Route: /manifest (but should be accessed as /manifest.json via rewrite or directly)
 * This ensures manifest.json is always accessible even if public folder files aren't
 */
export async function GET() {
  try {
    const manifestPath = join(process.cwd(), 'public', 'manifest.json');
    const manifestContent = readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);

    return NextResponse.json(manifest, {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error reading manifest.json:', error);
    // Return a basic manifest as fallback
    return NextResponse.json({
      name: 'Vana Check-In',
      short_name: 'Vana Check-In',
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#ea580c',
    }, {
      headers: {
        'Content-Type': 'application/manifest+json',
      },
    });
  }
}

