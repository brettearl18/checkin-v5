import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { logSafeError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Validate URL is from Firebase/Google Cloud Storage (prevents SSRF/open proxy)
 */
function isUrlAllowed(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const host = url.hostname.toLowerCase();
    return (
      host === 'firebasestorage.googleapis.com' ||
      host === 'storage.googleapis.com' ||
      host.endsWith('.googleusercontent.com')
    );
  } catch {
    return false;
  }
}

/**
 * GET /api/progress-images/proxy
 * Proxy images from Firebase/Google Cloud Storage to avoid CORS issues.
 * Requires authentication. Only allows Firebase Storage URLs.
 * Query params:
 * - url: The image URL to fetch (must be Firebase Storage)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json({
        success: false,
        message: 'Image URL is required'
      }, { status: 400 });
    }

    if (!isUrlAllowed(imageUrl)) {
      return NextResponse.json({
        success: false,
        message: 'Only Firebase Storage URLs are allowed'
      }, { status: 400 });
    }

    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      return NextResponse.json({
        success: false,
        message: `Failed to fetch image: ${response.statusText}`
      }, { status: response.status });
    }

    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || blob.type || 'image/jpeg';

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    logSafeError('Error proxying image', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to proxy image',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
