import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/scheduled-emails/onboarding-reminders
 * 
 * DISABLED - Onboarding reminder emails are currently disabled.
 * This endpoint was disabled because reminders were being sent to clients who already completed onboarding.
 * 
 * If you need to re-enable this feature:
 * 1. Update the logic to correctly identify clients who have completed onboarding
 * 2. Ensure onboardingStatus checks include 'submitted' status
 * 3. Uncomment and restore the code below (saved in git history)
 */
export async function POST(request: NextRequest) {
  try {
    // ONBOARDING REMINDERS DISABLED - Return immediately without sending emails
    console.log('[ONBOARDING REMINDERS] Email sending disabled - returning immediately');
    
    return NextResponse.json({
      success: true,
      message: 'Onboarding reminders are currently disabled',
      results: {
        checked: 0,
        sent: 0,
        skipped: 0,
        errors: []
      },
      disabled: true
    });
  } catch (error) {
    console.error('Error in onboarding reminders endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to process onboarding reminders',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
