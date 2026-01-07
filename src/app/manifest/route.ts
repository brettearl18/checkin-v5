import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * API route to serve manifest.json
 * Route: /manifest (but should be accessed as /manifest.json via rewrite or directly)
 * This ensures manifest.json is always accessible even if public folder files aren't
 */
export async function GET() {
  try {
    // Try multiple possible paths for the manifest file
    const possiblePaths = [
      join(process.cwd(), 'public', 'manifest.json'),
      join(process.cwd(), 'manifest.json'),
      join(process.cwd(), '.next', 'standalone', 'public', 'manifest.json'),
      join(process.cwd(), '.next', 'standalone', 'manifest.json'),
    ];

    let manifestPath: string | null = null;
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        manifestPath = path;
        break;
      }
    }

    if (manifestPath) {
      const manifestContent = readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      return NextResponse.json(manifest, {
        headers: {
          'Content-Type': 'application/manifest+json',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // If file not found, return fallback
    console.warn('manifest.json file not found at any expected path, using fallback');
    return NextResponse.json({
      name: 'Vana Check-In',
      short_name: 'Vana Check-In',
      description: 'Health & Wellness Coaching Platform',
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#ea580c',
      orientation: 'portrait-primary',
      icons: [
        {
          src: '/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: '/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('Error reading manifest.json:', error?.message || error);
    // Return a basic manifest as fallback even on error
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
        'Cache-Control': 'public, max-age=3600',
      },
      status: 200, // Always return 200, even on error
    });
  }
}

