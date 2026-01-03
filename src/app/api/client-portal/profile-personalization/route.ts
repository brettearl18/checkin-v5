import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { getDb } from '@/lib/firebase-admin';
import { logInfo, logSafeError } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    const { user } = authResult;

    const db = await getDb();
    
    // Get client document
    let clientDoc = await db.collection('clients').doc(user.uid).get();
    
    if (!clientDoc.exists) {
      // Try by authUid
      const clientQuery = await db.collection('clients').where('authUid', '==', user.uid).limit(1).get();
      if (!clientQuery.empty) {
        clientDoc = clientQuery.docs[0];
      }
    }

    if (!clientDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Client not found'
      }, { status: 404 });
    }

    const clientData = clientDoc.data();
    const personalization = clientData?.profilePersonalization || {
      quote: null,
      showQuote: false,
      colorTheme: '#daa450', // Default golden brown
      icon: null,
      updatedAt: null
    };

    return NextResponse.json({
      success: true,
      personalization
    });
  } catch (error: any) {
    logSafeError('Error fetching profile personalization', error, { userId: 'unknown' });
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to fetch profile personalization'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    const { user } = authResult;

    const body = await request.json();
    const { quote, showQuote, colorTheme, icon } = body;

    // Validation
    if (quote !== null && quote !== undefined && (typeof quote !== 'string' || quote.length > 100)) {
      return NextResponse.json({
        success: false,
        message: 'Quote must be a string with max 100 characters'
      }, { status: 400 });
    }

    const validColorThemes = [
      '#daa450', // Golden Brown (default)
      '#3b82f6', // Ocean Blue
      '#10b981', // Forest Green
      '#f97316', // Sunset Orange
      '#8b5cf6', // Lavender Purple
      '#ec4899', // Rose Pink
    ];

    if (colorTheme && !validColorThemes.includes(colorTheme)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid color theme'
      }, { status: 400 });
    }

    const validIcons = [
      '💪', '🌱', '⭐', '🎯', '❤️', '🌟', '🦋', '🌈', '🔥', '🌙', null
    ];

    if (icon !== null && icon !== undefined && !validIcons.includes(icon)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid icon'
      }, { status: 400 });
    }

    const db = await getDb();
    
    // Get client document
    let clientRef = db.collection('clients').doc(user.uid);
    let clientDoc = await clientRef.get();
    
    if (!clientDoc.exists) {
      // Try by authUid
      const clientQuery = await db.collection('clients').where('authUid', '==', user.uid).limit(1).get();
      if (!clientQuery.empty) {
        clientRef = db.collection('clients').doc(clientQuery.docs[0].id);
        clientDoc = clientQuery.docs[0];
      }
    }

    if (!clientDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Client not found'
      }, { status: 404 });
    }

    // Update personalization
    const { Timestamp } = await import('firebase-admin/firestore');
    const updateData: any = {
      'profilePersonalization.updatedAt': Timestamp.now()
    };

    if (quote !== undefined) {
      updateData['profilePersonalization.quote'] = quote;
    }
    if (showQuote !== undefined) {
      updateData['profilePersonalization.showQuote'] = showQuote;
    }
    if (colorTheme !== undefined) {
      updateData['profilePersonalization.colorTheme'] = colorTheme;
    }
    if (icon !== undefined) {
      updateData['profilePersonalization.icon'] = icon;
    }

    await clientRef.update(updateData);

    logInfo('Profile personalization updated', { userId: user.uid });

    return NextResponse.json({
      success: true,
      message: 'Profile personalization updated successfully'
    });
  } catch (error: any) {
    logSafeError('Error updating profile personalization', error, { userId: 'unknown' });
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to update profile personalization'
    }, { status: 500 });
  }
}

