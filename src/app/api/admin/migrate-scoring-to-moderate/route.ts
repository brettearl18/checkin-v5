import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireAdmin } from '@/lib/api-auth';
import { getDefaultThresholds } from '@/lib/scoring-utils';
import { logInfo, logSafeError } from '@/lib/logger';

/**
 * POST /api/admin/migrate-scoring-to-moderate
 * Migrates all existing clients with 'lifestyle' scoring profile to 'moderate'
 * Only updates clients who have 'lifestyle' profile, preserves custom thresholds
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    await requireAdmin(request);

    const db = getDb();
    const moderateThresholds = getDefaultThresholds('moderate');
    
    logInfo('[Migration] Starting migration of lifestyle scoring to moderate');

    // Fetch all clientScoring documents
    const scoringSnapshot = await db.collection('clientScoring').get();
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const doc of scoringSnapshot.docs) {
      try {
        const data = doc.data();
        const clientId = doc.id;

        // Only update if:
        // 1. Has 'lifestyle' scoringProfile, OR
        // 2. Has lifestyle thresholds (redMax: 33, orangeMax: 80), OR
        // 3. Has no thresholds but has 'lifestyle' profile
        const isLifestyle = 
          data.scoringProfile === 'lifestyle' ||
          (data.thresholds?.redMax === 33 && data.thresholds?.orangeMax === 80) ||
          (!data.thresholds && data.scoringProfile === 'lifestyle');

        if (isLifestyle) {
          // Update to moderate
          await doc.ref.update({
            scoringProfile: 'moderate',
            thresholds: moderateThresholds,
            updatedAt: new Date(),
            migratedAt: new Date(),
            migrationNote: 'Migrated from lifestyle to moderate default thresholds'
          });
          
          updated++;
          logInfo(`[Migration] Updated client ${clientId} from lifestyle to moderate`);
        } else {
          skipped++;
        }
      } catch (error) {
        errors++;
        logSafeError(`[Migration] Error updating client ${doc.id}`, error);
      }
    }

    logInfo(`[Migration] Complete: ${updated} updated, ${skipped} skipped, ${errors} errors`);

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      stats: {
        updated,
        skipped,
        errors,
        total: scoringSnapshot.size
      }
    });

  } catch (error: any) {
    if (error.status === 401 || error.status === 403) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: Admin access required' },
        { status: error.status }
      );
    }

    logSafeError('[Migration] Migration failed', error);
    return NextResponse.json(
      { success: false, message: 'Migration failed', error: error.message },
      { status: 500 }
    );
  }
}

