import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { extractTextInsights } from '@/lib/openai-service';
import { getCoachContext } from '@/lib/ai-context';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const { searchParams } = new URL(request.url);
    const regenerate = searchParams.get('regenerate') === 'true';

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    const db = getDb();

    // Fetch client
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Client not found'
      }, { status: 404 });
    }

    const clientData = clientDoc.data();
    const coachId = clientData?.coachId || clientData?.assignedCoach;

    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: false,
        message: 'OpenAI API key not configured'
      }, { status: 500 });
    }

    // Get date range for this week (last 7 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    // Check for existing cached weekly summary first (to avoid unnecessary OpenAI calls)
    try {
      let summarySnapshot;
      try {
        summarySnapshot = await db.collection('weekly_summaries')
          .where('clientId', '==', clientId)
          .orderBy('generatedAt', 'desc')
          .limit(1)
          .get();
      } catch (indexError: any) {
        // If index doesn't exist, fetch without orderBy
        if (indexError?.code === 9 || indexError?.message?.includes('index')) {
          const allSummaries = await db.collection('weekly_summaries')
            .where('clientId', '==', clientId)
            .get();
          
          const sortedDocs = allSummaries.docs.sort((a, b) => {
            const dateA = a.data().generatedAt?.toDate?.() || new Date(a.data().generatedAt || 0);
            const dateB = b.data().generatedAt?.toDate?.() || new Date(b.data().generatedAt || 0);
            return dateB.getTime() - dateA.getTime();
          });
          
          summarySnapshot = {
            docs: sortedDocs.slice(0, 1),
            empty: sortedDocs.length === 0
          } as any;
        } else {
          throw indexError;
        }
      }

      // If we have a recent summary (within last 8 days) and not forcing regenerate, return it
      if (!summarySnapshot.empty && summarySnapshot.docs[0] && !regenerate) {
        const doc = summarySnapshot.docs[0];
        const existingSummary = doc.data ? doc.data() : (doc as any).data;
        const existingDate = existingSummary.generatedAt?.toDate?.() || new Date(existingSummary.generatedAt);
        const daysDiff = (endDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysDiff < 8) {
          // Return cached summary - no OpenAI call needed!
          return NextResponse.json({
            success: true,
            data: {
              summary: existingSummary.summary,
              checkInsCount: existingSummary.checkInsCount || 0,
              measurementsCount: existingSummary.measurementsCount || 0,
              averageScore: existingSummary.averageScore || 0,
              currentScore: existingSummary.currentScore || 0,
              dateRange: existingSummary.dateRange || {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
              },
              generatedAt: existingDate.toISOString()
            },
            cached: true
          });
        }
      }
    } catch (cacheError) {
      console.error('Error checking cached weekly summary:', cacheError);
      // Continue to generate new summary if cache check fails
    }

    // Fetch check-ins from this week
    const checkInsSnapshot = await db.collection('check_in_assignments')
      .where('clientId', '==', clientId)
      .where('status', '==', 'completed')
      .get();

    const checkIns = checkInsSnapshot.docs
      .map(doc => {
        const data = doc.data();
        const completedAt = data.completedAt?.toDate?.() || new Date(data.completedAt);
        return { ...data, completedAt, id: doc.id };
      })
      .filter(checkIn => {
        const date = checkIn.completedAt instanceof Date ? checkIn.completedAt : new Date(checkIn.completedAt);
        return date >= startDate && date <= endDate;
      })
      .sort((a, b) => {
        const dateA = a.completedAt instanceof Date ? a.completedAt.getTime() : new Date(a.completedAt).getTime();
        const dateB = b.completedAt instanceof Date ? b.completedAt.getTime() : new Date(b.completedAt).getTime();
        return dateB - dateA;
      });

    // Fetch measurements from this week
    const measurementsSnapshot = await db.collection('measurements')
      .where('clientId', '==', clientId)
      .get();

    const measurements = measurementsSnapshot.docs
      .map(doc => {
        const data = doc.data();
        const date = data.date?.toDate?.() || new Date(data.date);
        return { ...data, date, id: doc.id };
      })
      .filter(measurement => {
        const date = measurement.date instanceof Date ? measurement.date : new Date(measurement.date);
        return date >= startDate && date <= endDate;
      });

    // Extract text responses from check-ins
    const textResponses: string[] = [];
    for (const checkIn of checkIns) {
      if (checkIn.responseId) {
        try {
          const responseDoc = await db.collection('formResponses').doc(checkIn.responseId).get();
          if (responseDoc.exists) {
            const responseData = responseDoc.data();
            const responses = responseData?.responses || [];
            responses.forEach((r: any) => {
              if ((r.type === 'text' || r.type === 'textarea') && r.answer) {
                textResponses.push(String(r.answer));
              }
            });
          }
        } catch (error) {
          console.log('Error fetching form response:', error);
        }
      }
    }

    // Calculate scores
    const scores = checkIns.map(checkIn => checkIn.score || 0).filter(score => score > 0);
    const currentScore = scores.length > 0 ? scores[scores.length - 1] : null;
    const averageScore = scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;

    // Get coach context
    let coachContext = null;
    if (coachId) {
      try {
        coachContext = await getCoachContext(coachId, db);
      } catch (error) {
        console.error('Error fetching coach context:', error);
      }
    }

    // Generate weekly summary using AI
    let weeklySummary = null;
    try {
      // Prepare context for summary
      const summaryContext = `Client: ${clientData?.firstName || ''} ${clientData?.lastName || ''}
Current Progress Score: ${currentScore || 'N/A'}%
Average Score This Week: ${averageScore || 'N/A'}%
Check-ins Completed This Week: ${checkIns.length}
Measurements Recorded: ${measurements.length}`;

      // Use extractTextInsights for weekly summary
      const insights = await extractTextInsights({
        textResponses: textResponses.length > 0 
          ? textResponses.slice(0, 10)
          : [summaryContext + '\n\nClient completed check-ins but provided no detailed text responses this week.'],
        context: { 
          score: currentScore || averageScore || 0, 
          weekNumber: 1,
          checkInCount: checkIns.length,
          measurementsCount: measurements.length
        },
        coachContext: coachContext || undefined
      });

      // Format the weekly summary
      const summaryText = `**Week Summary (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})**

${insights.summary || 'Unable to generate summary at this time.'}

${insights.themes && insights.themes.length > 0 ? `\n**Key Themes:** ${insights.themes.slice(0, 3).join(', ')}` : ''}
${insights.achievements && insights.achievements.length > 0 ? `\n**Notable Achievements:** ${insights.achievements.slice(0, 2).join(', ')}` : ''}
${insights.concerns && insights.concerns.length > 0 ? `\n**Areas to Watch:** ${insights.concerns.slice(0, 2).join(', ')}` : ''}`;

      weeklySummary = {
        summary: summaryText,
        themes: insights.themes || [],
        achievements: insights.achievements || []
      };

      // Prepare summary data for saving
      const summaryData = {
        clientId,
        coachId: coachId || null,
        summary: summaryText,
        checkInsCount: checkIns.length,
        measurementsCount: measurements.length,
        averageScore,
        currentScore,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        generatedAt: new Date()
      };

      // Save summary to database for caching (non-blocking)
      try {
        // Update or create weekly summary document (for this week)
        // Find existing summary for this week
        let shouldUpdate = false;
        try {
          let summarySnapshot;
          try {
            summarySnapshot = await db.collection('weekly_summaries')
              .where('clientId', '==', clientId)
              .orderBy('generatedAt', 'desc')
              .limit(1)
              .get();
          } catch (indexError: any) {
            // If index doesn't exist, fetch without orderBy
            if (indexError?.code === 9 || indexError?.message?.includes('index')) {
              console.log('Weekly summaries index not found, fetching without orderBy');
              const allSummaries = await db.collection('weekly_summaries')
                .where('clientId', '==', clientId)
                .get();
              
              // Sort in memory by generatedAt descending
              const sortedDocs = allSummaries.docs.sort((a, b) => {
                const dateA = a.data().generatedAt?.toDate?.() || new Date(a.data().generatedAt || 0);
                const dateB = b.data().generatedAt?.toDate?.() || new Date(b.data().generatedAt || 0);
                return dateB.getTime() - dateA.getTime();
              });
              
              // Create a mock snapshot-like object with the most recent doc
              summarySnapshot = {
                docs: sortedDocs.slice(0, 1),
                empty: sortedDocs.length === 0
              } as any;
            } else {
              throw indexError;
            }
          }

          // Check if we have a summary from this week (within last 8 days)
          if (!summarySnapshot.empty && summarySnapshot.docs[0]) {
            const doc = summarySnapshot.docs[0];
            const existingSummary = doc.data ? doc.data() : (doc as any).data;
            const docRef = doc.ref || db.collection('weekly_summaries').doc((doc as any).id);
            const existingDate = existingSummary.generatedAt?.toDate?.() || new Date(existingSummary.generatedAt);
            const daysDiff = (endDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysDiff < 8) {
              // Update existing if less than 8 days old
              await docRef.update(summaryData);
              shouldUpdate = true;
            }
          }
        } catch (error: any) {
          console.error('Error checking/updating weekly summary:', error);
          // Continue to create new summary if check fails
        }

        if (!shouldUpdate) {
          // Create new summary
          await db.collection('weekly_summaries').add(summaryData);
        }
      } catch (saveError) {
        console.error('Error saving weekly summary to database (non-critical):', saveError);
        // Don't fail the request if save fails - just log and continue
      }

      return NextResponse.json({
        success: true,
        data: {
          summary: summaryText,
          checkInsCount: checkIns.length,
          measurementsCount: measurements.length,
          averageScore,
          currentScore,
          dateRange: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          }
        }
      });
    } catch (error: any) {
      console.error('Error generating weekly summary:', error);
      return NextResponse.json({
        success: false,
        message: 'Failed to generate weekly summary',
        error: error?.message || 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in weekly summary endpoint:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch weekly summary',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}


import { extractTextInsights } from '@/lib/openai-service';
import { getCoachContext } from '@/lib/ai-context';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const { searchParams } = new URL(request.url);
    const regenerate = searchParams.get('regenerate') === 'true';

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    const db = getDb();

    // Fetch client
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Client not found'
      }, { status: 404 });
    }

    const clientData = clientDoc.data();
    const coachId = clientData?.coachId || clientData?.assignedCoach;

    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: false,
        message: 'OpenAI API key not configured'
      }, { status: 500 });
    }

    // Get date range for this week (last 7 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    // Check for existing cached weekly summary first (to avoid unnecessary OpenAI calls)
    try {
      let summarySnapshot;
      try {
        summarySnapshot = await db.collection('weekly_summaries')
          .where('clientId', '==', clientId)
          .orderBy('generatedAt', 'desc')
          .limit(1)
          .get();
      } catch (indexError: any) {
        // If index doesn't exist, fetch without orderBy
        if (indexError?.code === 9 || indexError?.message?.includes('index')) {
          const allSummaries = await db.collection('weekly_summaries')
            .where('clientId', '==', clientId)
            .get();
          
          const sortedDocs = allSummaries.docs.sort((a, b) => {
            const dateA = a.data().generatedAt?.toDate?.() || new Date(a.data().generatedAt || 0);
            const dateB = b.data().generatedAt?.toDate?.() || new Date(b.data().generatedAt || 0);
            return dateB.getTime() - dateA.getTime();
          });
          
          summarySnapshot = {
            docs: sortedDocs.slice(0, 1),
            empty: sortedDocs.length === 0
          } as any;
        } else {
          throw indexError;
        }
      }

      // If we have a recent summary (within last 8 days) and not forcing regenerate, return it
      if (!summarySnapshot.empty && summarySnapshot.docs[0] && !regenerate) {
        const doc = summarySnapshot.docs[0];
        const existingSummary = doc.data ? doc.data() : (doc as any).data;
        const existingDate = existingSummary.generatedAt?.toDate?.() || new Date(existingSummary.generatedAt);
        const daysDiff = (endDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysDiff < 8) {
          // Return cached summary - no OpenAI call needed!
          return NextResponse.json({
            success: true,
            data: {
              summary: existingSummary.summary,
              checkInsCount: existingSummary.checkInsCount || 0,
              measurementsCount: existingSummary.measurementsCount || 0,
              averageScore: existingSummary.averageScore || 0,
              currentScore: existingSummary.currentScore || 0,
              dateRange: existingSummary.dateRange || {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
              },
              generatedAt: existingDate.toISOString()
            },
            cached: true
          });
        }
      }
    } catch (cacheError) {
      console.error('Error checking cached weekly summary:', cacheError);
      // Continue to generate new summary if cache check fails
    }

    // Fetch check-ins from this week
    const checkInsSnapshot = await db.collection('check_in_assignments')
      .where('clientId', '==', clientId)
      .where('status', '==', 'completed')
      .get();

    const checkIns = checkInsSnapshot.docs
      .map(doc => {
        const data = doc.data();
        const completedAt = data.completedAt?.toDate?.() || new Date(data.completedAt);
        return { ...data, completedAt, id: doc.id };
      })
      .filter(checkIn => {
        const date = checkIn.completedAt instanceof Date ? checkIn.completedAt : new Date(checkIn.completedAt);
        return date >= startDate && date <= endDate;
      })
      .sort((a, b) => {
        const dateA = a.completedAt instanceof Date ? a.completedAt.getTime() : new Date(a.completedAt).getTime();
        const dateB = b.completedAt instanceof Date ? b.completedAt.getTime() : new Date(b.completedAt).getTime();
        return dateB - dateA;
      });

    // Fetch measurements from this week
    const measurementsSnapshot = await db.collection('measurements')
      .where('clientId', '==', clientId)
      .get();

    const measurements = measurementsSnapshot.docs
      .map(doc => {
        const data = doc.data();
        const date = data.date?.toDate?.() || new Date(data.date);
        return { ...data, date, id: doc.id };
      })
      .filter(measurement => {
        const date = measurement.date instanceof Date ? measurement.date : new Date(measurement.date);
        return date >= startDate && date <= endDate;
      });

    // Extract text responses from check-ins
    const textResponses: string[] = [];
    for (const checkIn of checkIns) {
      if (checkIn.responseId) {
        try {
          const responseDoc = await db.collection('formResponses').doc(checkIn.responseId).get();
          if (responseDoc.exists) {
            const responseData = responseDoc.data();
            const responses = responseData?.responses || [];
            responses.forEach((r: any) => {
              if ((r.type === 'text' || r.type === 'textarea') && r.answer) {
                textResponses.push(String(r.answer));
              }
            });
          }
        } catch (error) {
          console.log('Error fetching form response:', error);
        }
      }
    }

    // Calculate scores
    const scores = checkIns.map(checkIn => checkIn.score || 0).filter(score => score > 0);
    const currentScore = scores.length > 0 ? scores[scores.length - 1] : null;
    const averageScore = scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;

    // Get coach context
    let coachContext = null;
    if (coachId) {
      try {
        coachContext = await getCoachContext(coachId, db);
      } catch (error) {
        console.error('Error fetching coach context:', error);
      }
    }

    // Generate weekly summary using AI
    let weeklySummary = null;
    try {
      // Prepare context for summary
      const summaryContext = `Client: ${clientData?.firstName || ''} ${clientData?.lastName || ''}
Current Progress Score: ${currentScore || 'N/A'}%
Average Score This Week: ${averageScore || 'N/A'}%
Check-ins Completed This Week: ${checkIns.length}
Measurements Recorded: ${measurements.length}`;

      // Use extractTextInsights for weekly summary
      const insights = await extractTextInsights({
        textResponses: textResponses.length > 0 
          ? textResponses.slice(0, 10)
          : [summaryContext + '\n\nClient completed check-ins but provided no detailed text responses this week.'],
        context: { 
          score: currentScore || averageScore || 0, 
          weekNumber: 1,
          checkInCount: checkIns.length,
          measurementsCount: measurements.length
        },
        coachContext: coachContext || undefined
      });

      // Format the weekly summary
      const summaryText = `**Week Summary (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})**

${insights.summary || 'Unable to generate summary at this time.'}

${insights.themes && insights.themes.length > 0 ? `\n**Key Themes:** ${insights.themes.slice(0, 3).join(', ')}` : ''}
${insights.achievements && insights.achievements.length > 0 ? `\n**Notable Achievements:** ${insights.achievements.slice(0, 2).join(', ')}` : ''}
${insights.concerns && insights.concerns.length > 0 ? `\n**Areas to Watch:** ${insights.concerns.slice(0, 2).join(', ')}` : ''}`;

      weeklySummary = {
        summary: summaryText,
        themes: insights.themes || [],
        achievements: insights.achievements || []
      };

      // Prepare summary data for saving
      const summaryData = {
        clientId,
        coachId: coachId || null,
        summary: summaryText,
        checkInsCount: checkIns.length,
        measurementsCount: measurements.length,
        averageScore,
        currentScore,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        },
        generatedAt: new Date()
      };

      // Save summary to database for caching (non-blocking)
      try {
        // Update or create weekly summary document (for this week)
        // Find existing summary for this week
        let shouldUpdate = false;
        try {
          let summarySnapshot;
          try {
            summarySnapshot = await db.collection('weekly_summaries')
              .where('clientId', '==', clientId)
              .orderBy('generatedAt', 'desc')
              .limit(1)
              .get();
          } catch (indexError: any) {
            // If index doesn't exist, fetch without orderBy
            if (indexError?.code === 9 || indexError?.message?.includes('index')) {
              console.log('Weekly summaries index not found, fetching without orderBy');
              const allSummaries = await db.collection('weekly_summaries')
                .where('clientId', '==', clientId)
                .get();
              
              // Sort in memory by generatedAt descending
              const sortedDocs = allSummaries.docs.sort((a, b) => {
                const dateA = a.data().generatedAt?.toDate?.() || new Date(a.data().generatedAt || 0);
                const dateB = b.data().generatedAt?.toDate?.() || new Date(b.data().generatedAt || 0);
                return dateB.getTime() - dateA.getTime();
              });
              
              // Create a mock snapshot-like object with the most recent doc
              summarySnapshot = {
                docs: sortedDocs.slice(0, 1),
                empty: sortedDocs.length === 0
              } as any;
            } else {
              throw indexError;
            }
          }

          // Check if we have a summary from this week (within last 8 days)
          if (!summarySnapshot.empty && summarySnapshot.docs[0]) {
            const doc = summarySnapshot.docs[0];
            const existingSummary = doc.data ? doc.data() : (doc as any).data;
            const docRef = doc.ref || db.collection('weekly_summaries').doc((doc as any).id);
            const existingDate = existingSummary.generatedAt?.toDate?.() || new Date(existingSummary.generatedAt);
            const daysDiff = (endDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysDiff < 8) {
              // Update existing if less than 8 days old
              await docRef.update(summaryData);
              shouldUpdate = true;
            }
          }
        } catch (error: any) {
          console.error('Error checking/updating weekly summary:', error);
          // Continue to create new summary if check fails
        }

        if (!shouldUpdate) {
          // Create new summary
          await db.collection('weekly_summaries').add(summaryData);
        }
      } catch (saveError) {
        console.error('Error saving weekly summary to database (non-critical):', saveError);
        // Don't fail the request if save fails - just log and continue
      }

      return NextResponse.json({
        success: true,
        data: {
          summary: summaryText,
          checkInsCount: checkIns.length,
          measurementsCount: measurements.length,
          averageScore,
          currentScore,
          dateRange: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          }
        }
      });
    } catch (error: any) {
      console.error('Error generating weekly summary:', error);
      return NextResponse.json({
        success: false,
        message: 'Failed to generate weekly summary',
        error: error?.message || 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in weekly summary endpoint:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch weekly summary',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

