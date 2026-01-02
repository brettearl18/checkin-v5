import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/progress-images/proxy
 * Proxy images from Google Cloud Storage to avoid CORS issues
 * Query params:
 * - url: The image URL to fetch
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json({
        success: false,
        message: 'Image URL is required'
      }, { status: 400 });
    }

    // Fetch the image from the URL
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      return NextResponse.json({
        success: false,
        message: `Failed to fetch image: ${response.statusText}`
      }, { status: response.status });
    }

    // Get the image as a blob
    const blob = await response.blob();
    
    // Get the content type from the original response or blob
    const contentType = response.headers.get('content-type') || blob.type || 'image/jpeg';

    // Return the image with proper CORS headers
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('Error proxying image:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to proxy image',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}


