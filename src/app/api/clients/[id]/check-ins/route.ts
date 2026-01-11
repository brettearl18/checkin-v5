import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { FEATURE_FLAGS } from '@/lib/feature-flags';

export const dynamic = 'force-dynamic';

interface CheckIn {
  id: string;
  formTitle: string;
  formId?: string;
  assignedAt: any;
  completedAt: any;
  status: string;
  isRecurring?: boolean;
  recurringWeek?: number;
  totalWeeks?: number;
  duration?: number;
  frequency?: string;
  startDate?: any;
  dueDate?: any;
  category: string;
  score: number;
  responseCount: number;
  responseId?: string; // Link to formResponse document
  coachResponded?: boolean; // Whether coach has provided feedback
  checkInWindow?: {
    enabled: boolean;
    startDay: string;
    startTime: string;
    endDay: string;
    endTime: string;
  };
  pausedUntil?: string;
  notes?: string;
}

interface ClientMetrics {
  totalCheckIns: number;
  completedCheckIns: number;
  averageScore: number;
  lastActivity: string | null;
  progressScore: number;
  completionRate: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id: clientId } = await params;
    
    // First, try to find the client to get all possible IDs
    // The clientId parameter might be a document ID, authUid, or id field
    let clientDoc = await db.collection('clients').doc(clientId).get();
    let clientData = null;
    let possibleClientIds = [clientId]; // Start with the provided ID
    
    // If not found by document ID, try by authUid or id field
    if (!clientDoc.exists) {
      try {
        const queryByAuthUid = await db.collection('clients')
          .where('authUid', '==', clientId)
          .limit(1)
          .get();
        
        if (!queryByAuthUid.empty) {
          clientDoc = queryByAuthUid.docs[0];
          clientData = clientDoc.data();
          possibleClientIds.push(clientDoc.id); // Add document ID
          if (clientData?.authUid) {
            possibleClientIds.push(clientData.authUid); // Add authUid
          }
        } else {
          const queryById = await db.collection('clients')
            .where('id', '==', clientId)
            .limit(1)
            .get();
          
          if (!queryById.empty) {
            clientDoc = queryById.docs[0];
            clientData = clientDoc.data();
            possibleClientIds.push(clientDoc.id); // Add document ID
            if (clientData?.authUid) {
              possibleClientIds.push(clientData.authUid); // Add authUid
            }
          }
        }
      } catch (queryError) {
        console.log('Error querying client:', queryError);
      }
    } else {
      clientData = clientDoc.data();
      // If found by document ID, also check for authUid
      if (clientData?.authUid && clientData.authUid !== clientId) {
        possibleClientIds.push(clientData.authUid);
      }
    }
    
    // Remove duplicates
    possibleClientIds = [...new Set(possibleClientIds)];
    
    // Fetch check-in assignments for this client
    // Try querying with all possible client IDs
    let allAssignments: any[] = [];
    const seenIds = new Set<string>();
    
    try {
      for (const idToTry of possibleClientIds) {
        try {
          const snapshot = await db.collection('check_in_assignments')
            .where('clientId', '==', idToTry)
            .get();
          
          if (snapshot && snapshot.docs) {
            snapshot.docs.forEach((doc: any) => {
              // Avoid duplicates by document ID
              if (doc && doc.id && !seenIds.has(doc.id)) {
                seenIds.add(doc.id);
                allAssignments.push(doc);
              }
            });
          }
        } catch (queryError: any) {
          console.log(`Error querying assignments for ${idToTry}:`, queryError?.message || queryError);
          // Continue with other IDs
        }
      }
    } catch (error: any) {
      console.error('Error in assignment query loop:', error?.message || error);
      // Continue with empty array - better to return empty than fail
    }
    
    // Create a proper snapshot-like object that matches Firestore QuerySnapshot interface
    const assignmentsSnapshot = {
      docs: allAssignments,
      empty: allAssignments.length === 0,
      size: allAssignments.length,
      forEach: (callback: (doc: any) => void) => {
        allAssignments.forEach(callback);
      }
    } as any;
    
    const checkIns: CheckIn[] = [];
    const completedCheckIns: CheckIn[] = [];
    let lastActivity: string | null = null;
    let totalScore = 0;
    
    // Fetch form titles for all assignments in parallel
    const formIds = new Set<string>();
    assignmentsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.formId) {
        formIds.add(data.formId);
      }
    });

    // Fetch all forms at once - include thresholds
    const formPromises = Array.from(formIds).map(async (formId) => {
      try {
        const formDoc = await db.collection('forms').doc(formId).get();
        if (formDoc.exists) {
          const formData = formDoc.data();
          return { 
            formId, 
            title: formData?.title || 'Unknown Form',
            thresholds: formData?.thresholds || formData?.trafficLightThresholds || null
          };
        }
      } catch (error) {
        console.error(`Error fetching form ${formId}:`, error);
      }
      return { formId, title: 'Unknown Form', thresholds: null };
    });

    const formTitlesMap = new Map<string, string>();
    const formThresholdsMap = new Map<string, any>();
    const formResults = await Promise.all(formPromises);
    formResults.forEach(({ formId, title, thresholds }) => {
      formTitlesMap.set(formId, title);
      if (thresholds) {
        formThresholdsMap.set(formId, thresholds);
      }
    });

    // Process all assignments - need to use Promise.all since we're checking coach feedback
    const checkInsPromises = assignmentsSnapshot.docs.map(async (doc) => {
      const data = doc.data();
      // Get form title from the map, or use stored formTitle, or fallback to 'Unknown Form'
      const formTitle = data.formTitle || (data.formId ? formTitlesMap.get(data.formId) : null) || 'Unknown Form';
      
      // Convert dueDate
      let dueDate = data.dueDate;
      if (dueDate?.toDate && typeof dueDate.toDate === 'function') {
        dueDate = dueDate.toDate().toISOString();
      } else if (dueDate?._seconds) {
        dueDate = new Date(dueDate._seconds * 1000).toISOString();
      } else if (dueDate instanceof Date) {
        dueDate = dueDate.toISOString();
      }

      // Convert startDate
      let startDate = data.startDate;
      if (startDate?.toDate && typeof startDate.toDate === 'function') {
        startDate = startDate.toDate().toISOString();
      } else if (startDate?._seconds) {
        startDate = new Date(startDate._seconds * 1000).toISOString();
      } else if (startDate instanceof Date) {
        startDate = startDate.toISOString();
      } else if (typeof startDate === 'string') {
        // Keep as is if it's already a string
      }

      // Check if pausedUntil date has passed - auto-reactivate if so
      let status = data.status || 'active';
      let pausedUntil = data.pausedUntil;
      
      // If check-in has a responseId or completedAt, it should be marked as completed
      // This takes priority over other status logic
      if (data.responseId || data.completedAt) {
        status = 'completed';
      } else if (status === 'inactive' && pausedUntil) {
        const pausedUntilDate = pausedUntil?.toDate ? pausedUntil.toDate() : new Date(pausedUntil);
        const now = new Date();
        
        // If pausedUntil date has passed, automatically reactivate
        if (pausedUntilDate <= now) {
          status = 'active';
          pausedUntil = null;
          // Update the assignment in the background
          db.collection('check_in_assignments').doc(doc.id).update({
            status: 'active',
            pausedUntil: null
          }).catch(err => console.error('Error auto-reactivating check-in:', err));
        }
      }

      // Check if coach has responded (has feedback)
      let coachResponded = false;
      const responseId = data.responseId;
      let responseCount = data.responseCount || 0;
      
      // If responseCount is 0 but we have a responseId, fetch the actual count from the response
      if (responseId && (!responseCount || responseCount === 0)) {
        try {
          const responseDoc = await db.collection('formResponses').doc(responseId).get();
          if (responseDoc.exists) {
            const responseData = responseDoc.data();
            // Use answeredQuestions if available, otherwise count responses
            if (responseData?.answeredQuestions) {
              responseCount = responseData.answeredQuestions;
            } else if (responseData?.responses && Array.isArray(responseData.responses)) {
              responseCount = responseData.responses.length;
            } else if (responseData?.totalQuestions) {
              responseCount = responseData.totalQuestions;
            }
            
            // Update the assignment with the correct count for future queries
            if (responseCount > 0) {
              db.collection('check_in_assignments').doc(doc.id).update({
                responseCount: responseCount,
                totalQuestions: responseData.totalQuestions || responseCount,
                answeredQuestions: responseData.answeredQuestions || responseCount
              }).catch(err => console.error('Error updating assignment response count:', err));
            }
          }
        } catch (error) {
          console.log('Error fetching response for response count:', error);
        }
      }
      
      if (responseId) {
        try {
          const feedbackSnapshot = await db.collection('coachFeedback')
            .where('responseId', '==', responseId)
            .limit(1)
            .get();
          
          coachResponded = !feedbackSnapshot.empty || data.coachResponded || false;
        } catch (error) {
          console.log('Error checking feedback:', error);
          coachResponded = data.coachResponded || false;
        }
      }

      // Get form thresholds - priority: assignment stored thresholds > form thresholds
      const formThresholds = data.formThresholds || (data.formId ? formThresholdsMap.get(data.formId) : null);

      const checkIn: CheckIn = {
        id: doc.id,
        formTitle: formTitle,
        formId: data.formId || '',
        assignedAt: data.assignedAt?.toDate?.()?.toISOString() || data.assignedAt,
        completedAt: data.completedAt?.toDate?.()?.toISOString() || data.completedAt,
        status: status,
        isRecurring: data.isRecurring || false,
        recurringWeek: data.recurringWeek,
        totalWeeks: data.totalWeeks || data.duration,
        duration: data.duration || data.totalWeeks,
        frequency: data.frequency || (data.isRecurring ? 'weekly' : 'once'),
        startDate: startDate || data.startDate,
        dueDate: dueDate || data.dueDate,
        category: data.category || 'general',
        score: data.score || 0,
        responseCount: responseCount, // Use the fetched/corrected responseCount
        responseId: data.responseId || undefined, // Include responseId for linking to form response
        coachResponded: coachResponded, // Include coach response status
        checkInWindow: data.checkInWindow || {
          enabled: false,
          startDay: 'monday',
          startTime: '09:00',
          endDay: 'tuesday',
          endTime: '12:00'
        },
        pausedUntil: pausedUntil ? (pausedUntil?.toDate ? pausedUntil.toDate().toISOString() : new Date(pausedUntil).toISOString()) : undefined,
        notes: data.notes || '',
        formThresholds: formThresholds // Include form thresholds for priority use
      } as any;
      
      return checkIn;
    });
    
    const allCheckIns = await Promise.all(checkInsPromises);
    
    // Feature flag: If pre-created assignments are enabled, skip dynamic expansion
    // All Week 2+ assignments already exist as documents in the database
    let expandedCheckIns: CheckIn[] = [];
    
    if (FEATURE_FLAGS.USE_PRE_CREATED_ASSIGNMENTS) {
      // All assignments already exist in the database - no dynamic expansion needed
      expandedCheckIns = allCheckIns;
    } else {
      // Legacy: Dynamic expansion for recurring series (backward compatibility)
      const recurringSeriesMap = new Map<string, CheckIn[]>();
      const nonRecurringCheckIns: CheckIn[] = [];
      
      allCheckIns.forEach((checkIn) => {
        if (checkIn.isRecurring && checkIn.formId) {
          const key = `${checkIn.formId}_${checkIn.formTitle}`;
          if (!recurringSeriesMap.has(key)) {
            recurringSeriesMap.set(key, []);
          }
          recurringSeriesMap.get(key)!.push(checkIn);
        } else {
          nonRecurringCheckIns.push(checkIn);
        }
      });
      
      // Expand recurring series to include future weeks (same logic as client portal)
      expandedCheckIns = [...nonRecurringCheckIns];
      const now = new Date();
      
      // Helper to get Monday of the week
      const getWeekStart = (date: Date): Date => {
        const d = new Date(date);
        const dayOfWeek = d.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        d.setDate(d.getDate() - daysToMonday);
        d.setHours(0, 0, 0, 0);
        return d;
      };
      
      recurringSeriesMap.forEach((seriesAssignments) => {
        // Deduplicate by recurringWeek, keeping most recent
        const weekMap = new Map<number, CheckIn>();
        seriesAssignments.forEach(assignment => {
          const week = assignment.recurringWeek || 1;
          const existing = weekMap.get(week);
          if (!existing) {
            weekMap.set(week, assignment);
          } else if (assignment.status === 'completed' && existing.status !== 'completed') {
            weekMap.set(week, assignment);
          }
        });
        
        const deduplicatedSeries = Array.from(weekMap.values()).sort((a, b) => {
          const weekA = a.recurringWeek || 1;
          const weekB = b.recurringWeek || 1;
          return weekA - weekB;
        });
        
        // Get base assignment (Week 1 if available)
        const baseAssignment = deduplicatedSeries.find(a => a.recurringWeek === 1) || deduplicatedSeries[0];
        if (!baseAssignment) return;
        
        // Add existing assignments
        deduplicatedSeries.forEach(assignment => {
          expandedCheckIns.push(assignment);
        });
        
        // Generate future weeks if needed
        if (baseAssignment.totalWeeks && baseAssignment.totalWeeks > 1) {
          const firstDueDate = baseAssignment.dueDate ? new Date(baseAssignment.dueDate) : new Date();
          const firstWeekStart = getWeekStart(firstDueDate);
          const maxExistingWeek = Math.max(...deduplicatedSeries.map(a => a.recurringWeek || 1));
          
          for (let week = maxExistingWeek + 1; week <= baseAssignment.totalWeeks; week++) {
            const weekMonday = new Date(firstWeekStart);
            weekMonday.setDate(firstWeekStart.getDate() + (7 * (week - 1)));
            weekMonday.setHours(9, 0, 0, 0);
            
            // Include future weeks OR recent past weeks (within 3 weeks)
            const weeksAgo = (now.getTime() - weekMonday.getTime()) / (1000 * 60 * 60 * 24 * 7);
            const isFuture = weekMonday >= now;
            const isRecentPast = weeksAgo <= 3 && weekMonday < now;
            
            if (isFuture || isRecentPast) {
              expandedCheckIns.push({
                ...baseAssignment,
                id: `${baseAssignment.id}_week_${week}`,
                recurringWeek: week,
                dueDate: weekMonday.toISOString(),
                status: weekMonday < now ? 'overdue' : 'pending',
                completedAt: undefined,
                score: 0,
                responseCount: 0,
                responseId: undefined,
                coachResponded: false
              } as CheckIn);
            }
          }
        }
      });
    }
    
    // Process all check-ins
    expandedCheckIns.forEach((checkIn) => {
      checkIns.push(checkIn);
      
      if (checkIn.status === 'completed') {
        completedCheckIns.push(checkIn);
        totalScore += checkIn.score;
        
        // Track last activity
        const completedDate = checkIn.completedAt ? new Date(checkIn.completedAt) : null;
        if (completedDate && (!lastActivity || completedDate > new Date(lastActivity))) {
          lastActivity = completedDate.toISOString();
        }
      }
    });
    
    // Sort check-ins by assigned date (most recent first)
    checkIns.sort((a, b) => {
      const dateA = a.assignedAt ? new Date(a.assignedAt) : new Date(0);
      const dateB = b.assignedAt ? new Date(b.assignedAt) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
    
    // Sort completed check-ins by completed date (most recent first)
    completedCheckIns.sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt) : new Date(0);
      const dateB = b.completedAt ? new Date(b.completedAt) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
    
    // Calculate metrics
    const totalCheckIns = checkIns.length;
    const completedCount = completedCheckIns.length;
    const averageScore = completedCount > 0 ? Math.round(totalScore / completedCount) : 0;
    const completionRate = totalCheckIns > 0 ? Math.round((completedCount / totalCheckIns) * 100) : 0;
    
    // Progress Score should be the average score of completed check-ins
    // This represents how well the client is performing, not just completion rate
    const progressScore = averageScore;
    
    const metrics: ClientMetrics = {
      totalCheckIns,
      completedCheckIns: completedCount,
      averageScore,
      lastActivity,
      progressScore, // Now represents average score, not completion rate
      completionRate // Add completion rate to metrics
    };
    
    return NextResponse.json({
      success: true,
      checkIns: checkIns, // Return all check-ins, not just completed ones
      completedCheckIns: completedCheckIns, // Also return completed check-ins separately
      metrics
    });

  } catch (error: any) {
    console.error('Error fetching client check-ins:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Unknown error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
