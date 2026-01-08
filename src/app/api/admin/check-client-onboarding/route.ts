import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/check-client-onboarding?email=xxx or ?name=firstName lastName
 * 
 * Checks a client's onboarding status to determine why they might be receiving emails
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const name = searchParams.get('name');
    
    if (!email && !name) {
      return NextResponse.json({
        success: false,
        message: 'Please provide either email or name parameter'
      }, { status: 400 });
    }
    
    const db = getDb();
    let clientDoc: any = null;
    let clientId: string = '';
    let clientData: any = null;
    
    // Search by email
    if (email) {
      const clientsSnapshot = await db.collection('clients')
        .where('email', '==', email.toLowerCase().trim())
        .limit(1)
        .get();
      
      if (!clientsSnapshot.empty) {
        clientDoc = clientsSnapshot.docs[0];
        clientId = clientDoc.id;
        clientData = clientDoc.data();
      }
    }
    
    // Search by name if not found by email
    if (!clientData && name) {
      const nameParts = name.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');
        
        const clientsSnapshot = await db.collection('clients')
          .where('firstName', '==', firstName)
          .where('lastName', '==', lastName)
          .limit(1)
          .get();
        
        if (!clientsSnapshot.empty) {
          clientDoc = clientsSnapshot.docs[0];
          clientId = clientDoc.id;
          clientData = clientDoc.data();
        }
      }
    }
    
    if (!clientData) {
      return NextResponse.json({
        success: false,
        message: 'Client not found',
        searched: { email, name }
      }, { status: 404 });
    }
    
    // Check onboarding status
    const onboardingStatus = clientData.onboardingStatus || 'NOT SET';
    const canStartCheckIns = clientData.canStartCheckIns || false;
    const emailNotifications = clientData.emailNotifications ?? true;
    
    // This is the same logic used by the email reminder system
    // Onboarding is considered completed if:
    // 1. onboardingStatus is 'completed' or 'submitted' (both indicate completion)
    // 2. OR canStartCheckIns is true (indicates they can start check-ins)
    const isCompleted = 
      onboardingStatus === 'completed' || 
      onboardingStatus === 'submitted' ||
      canStartCheckIns === true;
    
    // Check onboarding responses
    let onboardingResponsesCount = 0;
    try {
      const onboardingResponsesSnapshot = await db.collection('onboardingResponses')
        .where('clientId', '==', clientId)
        .get();
      onboardingResponsesCount = onboardingResponsesSnapshot.size;
    } catch (error) {
      console.log('Error checking onboarding responses:', error);
    }
    
    // Check baseline measurements
    let baselineMeasurementsCount = 0;
    let beforePhotosCount = 0;
    try {
      const measurementsSnapshot = await db.collection('client_measurements')
        .where('clientId', '==', clientId)
        .where('isBaseline', '==', true)
        .get();
      baselineMeasurementsCount = measurementsSnapshot.size;
      
      const imagesSnapshot = await db.collection('progressImages')
        .where('clientId', '==', clientId)
        .where('imageType', '==', 'before')
        .get();
      beforePhotosCount = imagesSnapshot.size;
    } catch (error) {
      console.log('Error checking baseline data:', error);
    }
    
    // Determine why they might be receiving emails
    const reasonsForReceivingEmails: string[] = [];
    if (!isCompleted) {
      if (onboardingStatus !== 'completed') {
        reasonsForReceivingEmails.push(`onboardingStatus is "${onboardingStatus}" (should be "completed")`);
      }
      if (canStartCheckIns !== true) {
        reasonsForReceivingEmails.push(`canStartCheckIns is ${canStartCheckIns} (should be true)`);
      }
    }
    
    return NextResponse.json({
      success: true,
      client: {
        id: clientId,
        name: `${clientData.firstName} ${clientData.lastName}`,
        email: clientData.email,
        createdAt: clientData.createdAt?.toDate?.()?.toISOString() || clientData.createdAt || null,
        lastOnboardingReminderSent: clientData.lastOnboardingReminderSent?.toDate?.()?.toISOString() || clientData.lastOnboardingReminderSent || null,
      },
      onboardingStatus: {
        onboardingStatus,
        canStartCheckIns,
        emailNotifications,
        isCompleted,
        wouldReceiveEmails: !isCompleted,
      },
      data: {
        onboardingResponsesCount,
        baselineMeasurementsCount,
        beforePhotosCount,
      },
      issue: {
        receivingEmails: !isCompleted,
        reasons: reasonsForReceivingEmails,
        recommendation: isCompleted 
          ? 'Client should NOT receive emails. If they are, check email scheduling job configuration or cache issues.'
          : `To fix: Update client document to set onboardingStatus: "completed" and canStartCheckIns: true`
      }
    });
    
  } catch (error) {
    console.error('Error checking client onboarding:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to check client onboarding',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

