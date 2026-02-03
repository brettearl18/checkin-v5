import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireCoach } from '@/lib/api-auth';
import { logSafeError } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireCoach(request);
    if (authResult instanceof NextResponse) return authResult;

    const { id: coachId } = await params;

    if (coachId !== authResult.user.uid) {
      return NextResponse.json(
        { success: false, error: 'You can only add meal plans to your own profile' },
        { status: 403 }
      );
    }
    const { name, url } = await request.json();

    if (!name || !url) {
      return NextResponse.json(
        { success: false, error: 'Name and URL are required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    const db = getDb();
    
    // Get current coach data
    const coachRef = db.collection('coaches').doc(coachId);
    const coachDoc = await coachRef.get();
    
    if (!coachDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Coach not found' },
        { status: 404 }
      );
    }

    const coachData = coachDoc.data();
    const existingMealPlans = coachData?.customMealPlans || [];
    
    // Check if meal plan with this name already exists
    if (existingMealPlans.some((plan: any) => plan.name === name.trim())) {
      return NextResponse.json(
        { success: false, error: 'A meal plan with this name already exists' },
        { status: 400 }
      );
    }

    // Add new meal plan to the list
    const newMealPlan = {
      name: name.trim(),
      url: url.trim(),
      createdAt: new Date()
    };

    const updatedMealPlans = [...existingMealPlans, newMealPlan];

    // Update coach document
    await coachRef.update({
      customMealPlans: updatedMealPlans,
      updatedAt: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'Custom meal plan saved successfully',
      data: newMealPlan
    });

  } catch (error: unknown) {
    logSafeError('Error saving custom meal plan', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to save custom meal plan'
      },
      { status: 500 }
    );
  }
}
