import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * GET /api/push/vapid-public-key
 * Returns the VAPID public key for push notification subscriptions
 * No authentication required - public key is safe to expose
 */
export async function GET(request: NextRequest) {
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY;

    if (!publicKey) {
      return NextResponse.json({
        success: false,
        message: 'VAPID public key not configured'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      publicKey
    });

  } catch (error) {
    console.error('Error getting VAPID public key:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to get VAPID public key',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

