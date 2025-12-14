import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

/**
 * GET /api/client-onboarding/data
 * Fetch onboarding data for a client
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'clientId is required'
      }, { status: 400 });
    }

    const db = getDb();
    const doc = await db.collection('client_onboarding').doc(clientId).get();

    if (!doc.exists) {
      return NextResponse.json({
        success: true,
        data: {
          beforeImages: {},
          measurements: {},
          completed: false
        }
      });
    }

    const data = doc.data();
    return NextResponse.json({
      success: true,
      data: {
        beforeImages: data.beforeImages || {},
        bodyWeight: data.bodyWeight,
        measurements: data.measurements || {},
        completed: data.completed || false,
        completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt
      }
    });

  } catch (error) {
    console.error('Error fetching onboarding data:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch onboarding data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * POST /api/client-onboarding/data
 * Save onboarding data for a client
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, beforeImages, bodyWeight, measurements, completed, completedAt } = body;

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'clientId is required'
      }, { status: 400 });
    }

    const db = getDb();
    
    const onboardingData: any = {
      clientId,
      updatedAt: new Date()
    };

    if (beforeImages !== undefined) {
      onboardingData.beforeImages = beforeImages;
    }

    if (bodyWeight !== undefined) {
      onboardingData.bodyWeight = bodyWeight;
    }

    if (measurements !== undefined) {
      onboardingData.measurements = measurements;
    }

    if (completed !== undefined) {
      onboardingData.completed = completed;
    }

    if (completedAt !== undefined) {
      onboardingData.completedAt = completed ? new Date() : null;
    }

    // Check if document exists
    const doc = await db.collection('client_onboarding').doc(clientId).get();
    
    if (doc.exists) {
      await db.collection('client_onboarding').doc(clientId).update(onboardingData);
    } else {
      onboardingData.createdAt = new Date();
      await db.collection('client_onboarding').doc(clientId).set(onboardingData);
    }

    return NextResponse.json({
      success: true,
      message: 'Onboarding data saved successfully'
    });

  } catch (error) {
    console.error('Error saving onboarding data:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to save onboarding data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}


