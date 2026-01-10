import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireAdmin } from '@/lib/api-auth';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/fix-recurring-week
 * Backfills missing recurringWeek in formResponses documents from their assignments
 * 
 * Body: {
 *   responseId?: string,  // Specific response to fix (optional)
 *   fixAll?: boolean      // Fix all responses missing recurringWeek (optional)
 *   clientEmail?: string  // Client email to find responses (optional)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { responseId, fixAll, clientEmail } = body;
    
    const db = getDb();
    const results = [];
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    // If specific responseId provided, fix just that one
    if (responseId) {
      console.log(`[Fix RecurringWeek] Fixing specific response: ${responseId}`);
      
      try {
        const responseDoc = await db.collection('formResponses').doc(responseId).get();
        
        if (!responseDoc.exists) {
          return NextResponse.json({
            success: false,
            message: `Response ${responseId} not found`
          }, { status: 404 });
        }
        
        const responseData = responseDoc.data();
        totalProcessed++;
        
        // Check if already set
        if (responseData.recurringWeek !== undefined && responseData.recurringWeek !== null) {
          return NextResponse.json({
            success: true,
            message: 'recurringWeek already set',
            result: {
              responseId,
              recurringWeek: responseData.recurringWeek,
              updated: false,
              skipped: true
            }
          });
        }
        
        // Get assignmentId
        const assignmentId = responseData.assignmentId;
        if (!assignmentId) {
          return NextResponse.json({
            success: false,
            message: 'assignmentId not set in response'
          }, { status: 400 });
        }
        
        // Fetch assignment
        let assignmentDoc = await db.collection('check_in_assignments').doc(assignmentId).get();
        
        if (!assignmentDoc.exists) {
          // Try by 'id' field
          const query = await db.collection('check_in_assignments')
            .where('id', '==', assignmentId)
            .limit(1)
            .get();
          
          if (!query.empty) {
            assignmentDoc = query.docs[0];
          }
        }
        
        if (!assignmentDoc.exists) {
          return NextResponse.json({
            success: false,
            message: `Assignment ${assignmentId} not found`
          }, { status: 404 });
        }
        
        const assignmentData = assignmentDoc.data();
        let recurringWeek = assignmentData.recurringWeek;
        
        // If assignment also missing, try to derive from ID pattern
        if (recurringWeek === undefined || recurringWeek === null) {
          const weekMatch = assignmentData.id?.match(/_week_(\d+)$/);
          if (weekMatch) {
            recurringWeek = parseInt(weekMatch[1], 10);
          } else {
            recurringWeek = 1; // Default to Week 1
          }
          
          // Update assignment too
          await db.collection('check_in_assignments').doc(assignmentDoc.id).update({
            recurringWeek: recurringWeek
          });
        }
        
        // Update response
        await db.collection('formResponses').doc(responseId).update({
          recurringWeek: recurringWeek,
          updatedAt: Timestamp.now()
        });
        
        totalUpdated++;
        
        return NextResponse.json({
          success: true,
          message: 'recurringWeek updated successfully',
          result: {
            responseId,
            recurringWeek,
            updated: true,
            fromAssignment: assignmentData.recurringWeek !== undefined
          }
        });
        
      } catch (error: any) {
        console.error('Error fixing response:', error);
        return NextResponse.json({
          success: false,
          message: 'Failed to fix response',
          error: error.message
        }, { status: 500 });
      }
    }
    
    // If fixAll or clientEmail provided, find and fix multiple
    let query = db.collection('formResponses') as any;
    
    if (clientEmail) {
      // Find client first
      const clientsSnapshot = await db.collection('clients')
        .where('email', '==', clientEmail)
        .limit(1)
        .get();
      
      if (clientsSnapshot.empty) {
        return NextResponse.json({
          success: false,
          message: `Client not found with email: ${clientEmail}`
        }, { status: 404 });
      }
      
      const clientId = clientsSnapshot.docs[0].id;
      query = query.where('clientId', '==', clientId);
    }
    
    const responsesSnapshot = await query.get();
    
    for (const doc of responsesSnapshot.docs) {
      const responseData = doc.data();
      totalProcessed++;
      
      // Skip if already set
      if (responseData.recurringWeek !== undefined && responseData.recurringWeek !== null) {
        totalSkipped++;
        continue;
      }
      
      try {
        const assignmentId = responseData.assignmentId;
        if (!assignmentId) {
          results.push({
            responseId: doc.id,
            success: false,
            error: 'assignmentId not set'
          });
          totalFailed++;
          continue;
        }
        
        // Fetch assignment
        let assignmentDoc = await db.collection('check_in_assignments').doc(assignmentId).get();
        
        if (!assignmentDoc.exists) {
          const query = await db.collection('check_in_assignments')
            .where('id', '==', assignmentId)
            .limit(1)
            .get();
          
          if (!query.empty) {
            assignmentDoc = query.docs[0];
          }
        }
        
        if (!assignmentDoc.exists) {
          results.push({
            responseId: doc.id,
            success: false,
            error: 'Assignment not found'
          });
          totalFailed++;
          continue;
        }
        
        const assignmentData = assignmentDoc.data();
        let recurringWeek = assignmentData.recurringWeek;
        
        // Derive if missing
        if (recurringWeek === undefined || recurringWeek === null) {
          const weekMatch = assignmentData.id?.match(/_week_(\d+)$/);
          if (weekMatch) {
            recurringWeek = parseInt(weekMatch[1], 10);
          } else {
            recurringWeek = 1;
          }
          
          // Update assignment too
          await db.collection('check_in_assignments').doc(assignmentDoc.id).update({
            recurringWeek: recurringWeek,
            updatedAt: Timestamp.now()
          });
        }
        
        // Update response
        await db.collection('formResponses').doc(doc.id).update({
          recurringWeek: recurringWeek,
          updatedAt: Timestamp.now()
        });
        
        results.push({
          responseId: doc.id,
          success: true,
          recurringWeek,
          updated: true
        });
        
        totalUpdated++;
        
      } catch (error: any) {
        results.push({
          responseId: doc.id,
          success: false,
          error: error.message
        });
        totalFailed++;
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Fix complete',
      summary: {
        totalProcessed,
        totalUpdated,
        totalSkipped,
        totalFailed
      },
      results: results.slice(0, 100) // Limit results to first 100
    });
    
  } catch (error: any) {
    console.error('Error in fix-recurring-week:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fix recurringWeek',
      error: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/admin/fix-recurring-week?responseId=xxx
 * Check if a specific response needs fixing
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const responseId = searchParams.get('responseId');
    const clientEmail = searchParams.get('clientEmail');
    
    const db = getDb();
    
    if (responseId) {
      // Check specific response
      const responseDoc = await db.collection('formResponses').doc(responseId).get();
      
      if (!responseDoc.exists) {
        return NextResponse.json({
          success: false,
          message: 'Response not found'
        }, { status: 404 });
      }
      
      const responseData = responseDoc.data();
      const needsFix = responseData.recurringWeek === undefined || responseData.recurringWeek === null;
      
      return NextResponse.json({
        success: true,
        responseId,
        hasRecurringWeek: !needsFix,
        recurringWeek: responseData.recurringWeek ?? null,
        needsFix
      });
    }
    
    if (clientEmail) {
      // Count responses missing recurringWeek for this client
      const clientsSnapshot = await db.collection('clients')
        .where('email', '==', clientEmail)
        .limit(1)
        .get();
      
      if (clientsSnapshot.empty) {
        return NextResponse.json({
          success: false,
          message: 'Client not found'
        }, { status: 404 });
      }
      
      const clientId = clientsSnapshot.docs[0].id;
      const responsesSnapshot = await db.collection('formResponses')
        .where('clientId', '==', clientId)
        .get();
      
      const total = responsesSnapshot.docs.length;
      const missing = responsesSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.recurringWeek === undefined || data.recurringWeek === null;
      }).length;
      
      return NextResponse.json({
        success: true,
        clientEmail,
        totalResponses: total,
        missingRecurringWeek: missing,
        hasAll: missing === 0
      });
    }
    
    return NextResponse.json({
      success: false,
      message: 'Please provide responseId or clientEmail parameter'
    }, { status: 400 });
    
  } catch (error: any) {
    console.error('Error checking recurringWeek:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to check',
      error: error.message
    }, { status: 500 });
  }
}

