import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

/**
 * POST /api/responses/[id]/reactions
 * Add or update an emoji reaction to a question in a response
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id: responseId } = await params;
    const body = await request.json();
    const { questionId, coachId, emoji } = body;

    if (!responseId || !questionId || !coachId || !emoji) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: responseId, questionId, coachId, and emoji are required'
      }, { status: 400 });
    }

    // Validate emoji is one of the allowed reactions
    const allowedEmojis = ['👍', '🙏🏻', '❤️', '💔', '🫶', '😢', '🏆'];
    if (!allowedEmojis.includes(emoji)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid emoji. Allowed emojis: 👍 🙏🏻 ❤️ 💔 🫶 😢 🏆'
      }, { status: 400 });
    }

    // Get the response document
    const responseDoc = await db.collection('formResponses').doc(responseId).get();
    if (!responseDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Response not found'
      }, { status: 404 });
    }

    const responseData = responseDoc.data();
    if (!responseData) {
      return NextResponse.json({
        success: false,
        message: 'Response data not found'
      }, { status: 404 });
    }

    // Initialize reactions object if it doesn't exist
    const reactions = responseData.reactions || {};
    
    // Initialize question reactions if it doesn't exist
    if (!reactions[questionId]) {
      reactions[questionId] = {};
    }

    // Add or update reaction for this coach
    reactions[questionId][coachId] = {
      emoji,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    // Update the response document
    await db.collection('formResponses').doc(responseId).update({
      reactions,
      updatedAt: Timestamp.now()
    });

    return NextResponse.json({
      success: true,
      message: 'Reaction added successfully',
      data: {
        responseId,
        questionId,
        coachId,
        emoji,
        reactions: reactions[questionId]
      }
    });

  } catch (error) {
    console.error('Error adding reaction:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to add reaction',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/responses/[id]/reactions
 * Remove an emoji reaction from a question
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id: responseId } = await params;
    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get('questionId');
    const coachId = searchParams.get('coachId');

    if (!responseId || !questionId || !coachId) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: responseId, questionId, and coachId are required'
      }, { status: 400 });
    }

    // Get the response document
    const responseDoc = await db.collection('formResponses').doc(responseId).get();
    if (!responseDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Response not found'
      }, { status: 404 });
    }

    const responseData = responseDoc.data();
    if (!responseData) {
      return NextResponse.json({
        success: false,
        message: 'Response data not found'
      }, { status: 404 });
    }

    // Get reactions
    const reactions = responseData.reactions || {};
    
    // Remove reaction if it exists
    if (reactions[questionId] && reactions[questionId][coachId]) {
      delete reactions[questionId][coachId];
      
      // Clean up empty question reactions
      if (Object.keys(reactions[questionId]).length === 0) {
        delete reactions[questionId];
      }

      // Update the response document
      await db.collection('formResponses').doc(responseId).update({
        reactions,
        updatedAt: Timestamp.now()
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Reaction removed successfully'
    });

  } catch (error) {
    console.error('Error removing reaction:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to remove reaction',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * GET /api/responses/[id]/reactions
 * Get all reactions for a response
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id: responseId } = await params;

    // Get the response document
    const responseDoc = await db.collection('formResponses').doc(responseId).get();
    if (!responseDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Response not found'
      }, { status: 404 });
    }

    const responseData = responseDoc.data();
    const reactions = responseData?.reactions || {};

    // Get coach names for reactions
    const reactionsWithCoachNames: any = {};
    
    for (const [questionId, questionReactions] of Object.entries(reactions)) {
      if (typeof questionReactions === 'object' && questionReactions !== null) {
        reactionsWithCoachNames[questionId] = {};
        
        for (const [coachId, reactionData] of Object.entries(questionReactions as any)) {
          try {
            // Fetch coach info
            const coachDoc = await db.collection('coaches').doc(coachId).get();
            const coachData = coachDoc.data();
            const coachName = coachData 
              ? `${coachData.firstName || ''} ${coachData.lastName || ''}`.trim() || coachData.displayName || 'Coach'
              : 'Coach';

            reactionsWithCoachNames[questionId][coachId] = {
              ...(reactionData as any),
              coachName,
              createdAt: (reactionData as any).createdAt?.toDate?.()?.toISOString() || (reactionData as any).createdAt,
              updatedAt: (reactionData as any).updatedAt?.toDate?.()?.toISOString() || (reactionData as any).updatedAt
            };
          } catch (error) {
            // If coach lookup fails, still include the reaction
            reactionsWithCoachNames[questionId][coachId] = {
              ...(reactionData as any),
              coachName: 'Coach',
              createdAt: (reactionData as any).createdAt?.toDate?.()?.toISOString() || (reactionData as any).createdAt,
              updatedAt: (reactionData as any).updatedAt?.toDate?.()?.toISOString() || (reactionData as any).updatedAt
            };
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: reactionsWithCoachNames
    });

  } catch (error) {
    console.error('Error fetching reactions:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch reactions',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
