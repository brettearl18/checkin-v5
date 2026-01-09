import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { getDefaultThresholds, convertLegacyThresholds } from '@/lib/scoring-utils';
import { ONBOARDING_QUESTIONS } from '@/lib/onboarding-questions';

export const dynamic = 'force-dynamic';

/**
 * Get the Monday that starts a week for a given date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setDate(d.getDate() - daysToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Use shared cache utility (Phase 1: Shared cache for cross-route invalidation)
import { getCached, setCache, deleteCache } from '@/lib/dashboard-cache';



export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const clientEmail = searchParams.get('clientEmail');
    const userUid = searchParams.get('userUid'); // Allow passing user UID directly
    const isPreview = searchParams.get('preview') === 'true';
    const coachId = searchParams.get('coachId');

    // If in preview mode, verify coach/admin has access to this client
    if (isPreview && clientId && coachId) {
      try {
        // Check if user is an admin (admins can access any client)
        const userDoc = await db.collection('users').doc(coachId).get();
        const isAdmin = userDoc.exists && (userDoc.data()?.role === 'admin' || userDoc.data()?.roles?.includes('admin'));
        
        if (!isAdmin) {
          // For non-admins (coaches), verify they're assigned to this client
          const clientDoc = await db.collection('clients').doc(clientId).get();
          if (clientDoc.exists) {
            const clientData = clientDoc.data();
            // Verify this coach is assigned to this client
            if (clientData?.coachId !== coachId) {
              return NextResponse.json({
                success: false,
                message: 'You do not have permission to preview this client\'s portal'
              }, { status: 403 });
            }
          } else {
            return NextResponse.json({
              success: false,
              message: 'Client not found'
            }, { status: 404 });
          }
        }
        // Admins can access any client, so no further checks needed
      } catch (error) {
        return NextResponse.json({
          success: false,
          message: 'Error verifying preview access'
        }, { status: 500 });
      }
    }

    if (!clientId && !clientEmail && !userUid) {
      return NextResponse.json({
        success: false,
        message: 'Client ID, email, or user UID is required'
      }, { status: 400 });
    }

    // Check cache first (Phase 1: Add basic caching)
    // Note: We need to determine clientIdToUse first for cache key
    let clientIdToUse = clientId || userUid;
    
    // Quick cache check if we have clientId or userUid directly
    if (clientIdToUse) {
      const cachedData = getCached(`dashboard:${clientIdToUse}`);
      if (cachedData) {
        return NextResponse.json({
          success: true,
          data: cachedData,
          cached: true
        });
      }
    }

    let clientData = null;
    if (!clientIdToUse) {
      clientIdToUse = clientId || userUid;
    }

    // If we have email but no clientId, find the client by email
    if (clientEmail && !clientId) {
      const clientsSnapshot = await db.collection('clients')
        .where('email', '==', clientEmail)
        .limit(1)
        .get();

      if (!clientsSnapshot.empty) {
        const clientDoc = clientsSnapshot.docs[0];
        clientData = {
          id: clientDoc.id,
          ...clientDoc.data()
        };
        clientIdToUse = clientDoc.id;
      } else {
        // If client not found by email, but we have userUid, use that
        // This handles cases where client document doesn't exist but responses do
        if (userUid) {
          console.log('Client not found by email, using userUid:', userUid);
          clientIdToUse = userUid;
        } else {
          return NextResponse.json({
            success: false,
            message: 'Client not found with this email'
          }, { status: 404 });
        }
      }
    } else if (clientId) {
      // Fetch client data by ID
      const clientDoc = await db.collection('clients').doc(clientId).get();
      if (clientDoc.exists) {
        clientData = {
          id: clientDoc.id,
          ...clientDoc.data()
        };
      } else {
        // If client document doesn't exist, but we have userUid, use that
        if (userUid) {
          console.log('Client document not found, using userUid:', userUid);
          clientIdToUse = userUid;
        } else {
          return NextResponse.json({
            success: false,
            message: 'Client not found'
          }, { status: 404 });
        }
      }
    }

    // Final fallback: if we still don't have a clientIdToUse, use userUid
    if (!clientIdToUse && userUid) {
      console.log('Using userUid as final fallback:', userUid);
      clientIdToUse = userUid;
    }

    if (!clientIdToUse) {
      return NextResponse.json({
        success: false,
        message: 'Unable to determine client ID'
      }, { status: 400 });
    }

    // Fetch check-in assignments for this client
    let checkInAssignments = [];
    try {
      // Helper function to convert date fields
      const convertDate = (dateField: any) => {
        if (!dateField) return new Date().toISOString();
        
        // Handle Firestore Timestamp
        if (dateField.toDate && typeof dateField.toDate === 'function') {
          return dateField.toDate().toISOString();
        }
        
        // Handle Firebase Timestamp object with _seconds
        if (dateField._seconds) {
          return new Date(dateField._seconds * 1000).toISOString();
        }
        
        // Handle Date object
        if (dateField instanceof Date) {
          return dateField.toISOString();
        }
        
        // Handle ISO string
        if (typeof dateField === 'string') {
          return new Date(dateField).toISOString();
        }
        
        // Fallback
        return new Date().toISOString();
      };

      const assignmentsSnapshot = await db.collection('check_in_assignments')
        .where('clientId', '==', clientIdToUse)
        .get();

      let allAssignments = assignmentsSnapshot.docs.map(doc => {
        const data = doc.data();
        
        // Calculate dueDate if missing (for backward compatibility)
        let dueDate = data.dueDate;
        if (!dueDate && data.startDate) {
          const startDate = new Date(data.startDate);
          const dueTime = data.dueTime || '09:00';
          const [hours, minutes] = dueTime.split(':').map(Number);
          dueDate = new Date(startDate);
          dueDate.setHours(hours, minutes, 0, 0);
        }
        
        const dueDateObj = dueDate ? (typeof dueDate === 'string' ? new Date(dueDate) : (dueDate.toDate ? dueDate.toDate() : dueDate)) : new Date();
        const now = new Date();
        
        // Determine display status
        let displayStatus: 'pending' | 'completed' | 'overdue' = 'pending';
        if (data.status === 'completed' || data.completedAt) {
          displayStatus = 'completed';
        } else if (dueDateObj < now) {
          displayStatus = 'overdue';
        }
        
        return {
          id: doc.id,
          ...data,
          dueDate: convertDate(dueDate || data.dueDate || new Date()),
          status: displayStatus,
          recurringWeek: data.recurringWeek || 1,
          totalWeeks: data.totalWeeks || 1,
          isRecurring: data.isRecurring || false,
          clientId: clientIdToUse
        };
      });

      // Expand recurring check-ins into individual weekly assignments (same logic as check-ins endpoint)
      const recurringSeriesMap = new Map<string, any[]>();
      const nonRecurringAssignments: any[] = [];
      
      allAssignments.forEach(assignment => {
        if (assignment.isRecurring && assignment.totalWeeks > 1) {
          const seriesKey = `${assignment.formId}_${assignment.clientId}`;
          if (!recurringSeriesMap.has(seriesKey)) {
            recurringSeriesMap.set(seriesKey, []);
          }
          recurringSeriesMap.get(seriesKey)!.push(assignment);
        } else {
          nonRecurringAssignments.push(assignment);
        }
      });
      
      const expandedAssignments: any[] = [...nonRecurringAssignments];
      const now = new Date();
      
      // Process each recurring series and expand missing weeks
      recurringSeriesMap.forEach((seriesAssignments) => {
        // Group by recurringWeek and keep only one per week
        const weekMap = new Map<number, any>();
        seriesAssignments.forEach(assignment => {
          const week = assignment.recurringWeek || 1;
          if (!weekMap.has(week)) {
            weekMap.set(week, assignment);
          } else {
            const existing = weekMap.get(week)!;
            if (assignment.status === 'completed' && existing.status !== 'completed') {
              weekMap.set(week, assignment);
            } else if (assignment.status === existing.status) {
              const existingDate = existing.assignedAt ? new Date(existing.assignedAt).getTime() : 0;
              const currentDate = assignment.assignedAt ? new Date(assignment.assignedAt).getTime() : 0;
              if (currentDate > existingDate) {
                weekMap.set(week, assignment);
              }
            }
          }
        });
        
        const deduplicatedSeries = Array.from(weekMap.values()).sort((a, b) => {
          const weekA = a.recurringWeek || 1;
          const weekB = b.recurringWeek || 1;
          return weekA - weekB;
        });
        
        const baseAssignment = deduplicatedSeries.find(a => a.recurringWeek === 1) || deduplicatedSeries[0];
        
        if (!baseAssignment) {
          // If no base assignment found, skip this series
          return;
        }
        
        // Add all existing assignments from the series
        deduplicatedSeries.forEach(assignment => {
          expandedAssignments.push(assignment);
        });
        
        // Generate future weeks if needed
        if (baseAssignment.totalWeeks && baseAssignment.totalWeeks > 1) {
          const firstDueDate = new Date(baseAssignment.dueDate);
          const firstWeekStart = getWeekStart(firstDueDate);
          const maxExistingWeek = Math.max(...deduplicatedSeries.map(a => a.recurringWeek || 1));
          
          // Calculate 3 weeks ago Monday to include recent past weeks
          const threeWeeksAgoMonday = new Date(now);
          threeWeeksAgoMonday.setDate(now.getDate() - 21);
          threeWeeksAgoMonday.setHours(0, 0, 0, 0);
          const threeWeeksAgoMondayStart = getWeekStart(threeWeeksAgoMonday);
          
          for (let week = maxExistingWeek + 1; week <= baseAssignment.totalWeeks; week++) {
            const weekMonday = new Date(firstWeekStart);
            weekMonday.setDate(firstWeekStart.getDate() + (7 * (week - 1)));
            weekMonday.setHours(9, 0, 0, 0);
            
            // Include future weeks AND recent past weeks (within 3 weeks) that weren't created
            if (weekMonday >= threeWeeksAgoMondayStart) {
              expandedAssignments.push({
                ...baseAssignment,
                id: `${baseAssignment.id}_week_${week}`,
                recurringWeek: week,
                dueDate: weekMonday.toISOString(),
                status: weekMonday < now ? 'overdue' : 'pending',
                checkInWindow: null,
                responseId: undefined,
                coachResponded: false,
                completedAt: undefined,
                score: undefined
              });
            }
          }
        }
      });
      
      checkInAssignments = expandedAssignments.sort((a, b) => {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    } catch (error) {
      console.log('No check_in_assignments found for client, using empty array');
    }

    // Fetch coach data if client has a coachId
    let coachData = null;
    if (clientData?.coachId) {
      try {
        const coachDoc = await db.collection('coaches').doc(clientData.coachId).get();
        if (coachDoc.exists) {
          coachData = {
            id: coachDoc.id,
            ...coachDoc.data()
          };
        }
      } catch (error) {
        console.log('Error fetching coach data:', error);
      }
    }

    // Fetch recent form responses with coach feedback status
    let recentResponses = [];
    try {
      console.log('=== Fetching Recent Responses ===');
      console.log('clientIdToUse (from clients collection):', clientIdToUse);
      console.log('userUid (from auth):', userUid);
      console.log('clientData?.id:', clientData?.id);
      console.log('clientData?.email:', clientData?.email);
      
      // IMPORTANT: Responses are stored with clientId = userProfile.uid (Firebase Auth UID)
      // So we should prioritize userUid when querying responses
      // Try to fetch responses - prioritize userUid first, then clientId
      const clientIdsToTry: string[] = [];
      
      // Priority 1: userUid (this is what responses are stored with)
      if (userUid) {
        clientIdsToTry.push(userUid);
      }
      
      // Priority 2: clientIdToUse (document ID from clients collection)
      if (clientIdToUse && clientIdToUse !== userUid) {
        clientIdsToTry.push(clientIdToUse);
      }
      
      // Priority 3: client document uid field if it exists
      if (clientData?.uid && clientData.uid !== userUid && clientData.uid !== clientIdToUse) {
        clientIdsToTry.push(clientData.uid);
      }
      
      console.log('Client IDs to try (in priority order):', clientIdsToTry);
      
      // Also try fetching via assignments - sometimes responses are linked through assignments
      let responseIdsFromAssignments: string[] = [];
      try {
        const assignmentsSnapshot = await db.collection('check_in_assignments')
          .where('clientId', '==', clientIdToUse)
          .get();
        
        assignmentsSnapshot.docs.forEach(doc => {
          const assignmentData = doc.data();
          if (assignmentData?.responseId) {
            responseIdsFromAssignments.push(assignmentData.responseId);
          }
        });
        
        // Also try with userUid
        if (userUid && userUid !== clientIdToUse) {
          const assignmentsByUid = await db.collection('check_in_assignments')
            .where('clientId', '==', userUid)
            .get();
          
          assignmentsByUid.docs.forEach(doc => {
            const assignmentData = doc.data();
            if (assignmentData?.responseId) {
              responseIdsFromAssignments.push(assignmentData.responseId);
            }
          });
        }
        
        console.log('Found responseIds from assignments:', responseIdsFromAssignments);
      } catch (assignmentError) {
        console.log('Error fetching assignments:', assignmentError);
      }
      
      let allResponses: any[] = [];
      
      for (const idToTry of clientIdsToTry) {
        try {
          let responsesSnapshot;
          
          // Try with orderBy first (requires index)
          try {
            responsesSnapshot = await db.collection('formResponses')
              .where('clientId', '==', idToTry)
              .orderBy('submittedAt', 'desc')
              .limit(5)
              .get();
            console.log(`Found ${responsesSnapshot.size} responses with orderBy for ${idToTry}`);
          } catch (indexError: any) {
            // If index doesn't exist, fetch without orderBy and sort in memory
            console.log('Index error, fetching without orderBy:', indexError.message);
            const allResponsesForId = await db.collection('formResponses')
              .where('clientId', '==', idToTry)
              .get();
            
            console.log(`Found ${allResponsesForId.size} responses without orderBy for ${idToTry}`);
            
            // Sort by submittedAt in memory
            const sortedDocs = allResponsesForId.docs.sort((a, b) => {
              const dateA = a.data().submittedAt?.toDate?.() || a.data().submittedAt || new Date(0);
              const dateB = b.data().submittedAt?.toDate?.() || b.data().submittedAt || new Date(0);
              const timeA = dateA instanceof Date ? dateA.getTime() : new Date(dateA).getTime();
              const timeB = dateB instanceof Date ? dateB.getTime() : new Date(dateB).getTime();
              return timeB - timeA; // Descending order
            });
            
            // Take top 5
            responsesSnapshot = {
              docs: sortedDocs.slice(0, 5),
              empty: sortedDocs.length === 0,
              size: sortedDocs.length
            } as any;
          }

          if (!responsesSnapshot.empty && responsesSnapshot.docs.length > 0) {
            allResponses.push(...responsesSnapshot.docs);
          }
        } catch (error) {
          console.log(`Error fetching responses for ${idToTry}:`, error);
        }
      }
      
      // Remove duplicates and sort by date
      const uniqueResponses = new Map();
      allResponses.forEach(doc => {
        const data = doc.data();
        const submittedAt = data.submittedAt?.toDate?.() || data.submittedAt || new Date(0);
        const time = submittedAt instanceof Date ? submittedAt.getTime() : new Date(submittedAt).getTime();
        if (!uniqueResponses.has(doc.id) || uniqueResponses.get(doc.id).time < time) {
          uniqueResponses.set(doc.id, { doc, time });
        }
      });
      
      // Also fetch responses by responseId from assignments
      if (responseIdsFromAssignments.length > 0) {
        for (const responseId of responseIdsFromAssignments) {
          try {
            const responseDoc = await db.collection('formResponses').doc(responseId).get();
            if (responseDoc.exists) {
              const data = responseDoc.data();
              // Only add if it matches our client
              if (data?.clientId === userUid || data?.clientId === clientIdToUse) {
                const submittedAt = data.submittedAt?.toDate?.() || data.submittedAt || new Date(0);
                const time = submittedAt instanceof Date ? submittedAt.getTime() : new Date(submittedAt).getTime();
                if (!uniqueResponses.has(responseDoc.id) || uniqueResponses.get(responseDoc.id).time < time) {
                  uniqueResponses.set(responseDoc.id, { doc: responseDoc, time });
                }
              }
            }
          } catch (error) {
            console.log(`Error fetching response ${responseId}:`, error);
          }
        }
      }
      
      const sortedUniqueDocs = Array.from(uniqueResponses.values())
        .sort((a, b) => b.time - a.time)
        .slice(0, 5)
        .map(item => item.doc);

      console.log(`Total unique responses found: ${sortedUniqueDocs.length}`);

      if (sortedUniqueDocs.length > 0) {
        recentResponses = await Promise.all(
          sortedUniqueDocs.map(async (doc) => {
            const responseData = doc.data();
            
            console.log('Processing response:', {
              id: doc.id,
              clientId: responseData.clientId,
              formTitle: responseData.formTitle,
              score: responseData.score
            });
            
            // Check if coach has provided feedback
            let hasFeedback = false;
            let feedbackCount = 0;
            try {
              const feedbackSnapshot = await db.collection('coachFeedback')
                .where('responseId', '==', doc.id)
                .get();
              feedbackCount = feedbackSnapshot.size;
              hasFeedback = feedbackCount > 0;
            } catch (error) {
              console.log('Error checking feedback:', error);
            }

            return {
              id: doc.id,
              formId: responseData.formId || '',
              formTitle: responseData.formTitle || 'Check-in',
              score: responseData.score || responseData.percentageScore || 0,
              submittedAt: responseData.submittedAt?.toDate?.()?.toISOString() || responseData.submittedAt || new Date().toISOString(),
              hasFeedback: hasFeedback,
              feedbackCount: feedbackCount,
              clientApproved: responseData.clientApproved || false
            };
          })
        );
        console.log('✅ Processed recent responses:', recentResponses.length);
        console.log('Response IDs:', recentResponses.map(r => r.id));
      } else {
        console.log('❌ No responses found for any of these IDs:', clientIdsToTry);
        
        // Final fallback: Query all responses and filter by clientId (less efficient but comprehensive)
        try {
          console.log('Trying fallback: fetching all responses and filtering...');
          const allResponsesFallback = await db.collection('formResponses')
            .limit(100) // Limit to avoid performance issues
            .get();
          
          const matchingResponses: any[] = [];
          allResponsesFallback.docs.forEach(doc => {
            const data = doc.data();
            // Check if this response matches any of our client IDs
            if (clientIdsToTry.includes(data.clientId)) {
              matchingResponses.push(doc);
            }
          });
          
          if (matchingResponses.length > 0) {
            console.log(`Found ${matchingResponses.length} responses via fallback method`);
            
            // Sort and take top 5
            const sortedFallback = matchingResponses.sort((a, b) => {
              const dateA = a.data().submittedAt?.toDate?.() || a.data().submittedAt || new Date(0);
              const dateB = b.data().submittedAt?.toDate?.() || b.data().submittedAt || new Date(0);
              const timeA = dateA instanceof Date ? dateA.getTime() : new Date(dateA).getTime();
              const timeB = dateB instanceof Date ? dateB.getTime() : new Date(dateB).getTime();
              return timeB - timeA;
            }).slice(0, 5);
            
            // Process these responses
            recentResponses = await Promise.all(
              sortedFallback.map(async (doc) => {
                const responseData = doc.data();
                
                let hasFeedback = false;
                let feedbackCount = 0;
                try {
                  const feedbackSnapshot = await db.collection('coachFeedback')
                    .where('responseId', '==', doc.id)
                    .get();
                  feedbackCount = feedbackSnapshot.size;
                  hasFeedback = feedbackCount > 0;
                } catch (error) {
                  console.log('Error checking feedback:', error);
                }

                return {
                  id: doc.id,
                  formId: responseData.formId || '',
                  formTitle: responseData.formTitle || 'Check-in',
                  score: responseData.score || responseData.percentageScore || 0,
                  submittedAt: responseData.submittedAt?.toDate?.()?.toISOString() || responseData.submittedAt || new Date().toISOString(),
                  hasFeedback: hasFeedback,
                  feedbackCount: feedbackCount,
                  clientApproved: responseData.clientApproved || false
                };
              })
            );
            
            console.log('✅ Processed responses via fallback:', recentResponses.length);
          } else {
            // Debug: Let's check what clientIds actually exist in formResponses
            try {
              const allResponsesSample = await db.collection('formResponses').limit(10).get();
              const sampleClientIds = new Set<string>();
              allResponsesSample.docs.forEach(doc => {
                const data = doc.data();
                if (data.clientId) {
                  sampleClientIds.add(data.clientId);
                }
              });
              console.log('Sample clientIds found in formResponses:', Array.from(sampleClientIds));
            } catch (debugError) {
              console.log('Error checking sample responses:', debugError);
            }
          }
        } catch (fallbackError) {
          console.log('Error in fallback query:', fallbackError);
        }
      }
    } catch (error) {
      console.error('Error fetching recent responses:', error);
    }

    // Fetch scoring configuration (Phase 1: Remove client-side Firestore)
    let scoringConfig = null;
    try {
      const scoringDoc = await db.collection('clientScoring').doc(clientIdToUse).get();
      if (scoringDoc.exists) {
        const scoringData = scoringDoc.data();
        let thresholds;
        
        // Check if new format (redMax/orangeMax) exists
        if (scoringData?.thresholds?.redMax !== undefined && scoringData?.thresholds?.orangeMax !== undefined) {
          thresholds = {
            redMax: scoringData.thresholds.redMax,
            orangeMax: scoringData.thresholds.orangeMax
          };
        } else if (scoringData?.thresholds?.red !== undefined && scoringData?.thresholds?.yellow !== undefined) {
          // Convert legacy format
          thresholds = convertLegacyThresholds(scoringData.thresholds);
        } else if (scoringData?.scoringProfile) {
          // Use profile defaults
          thresholds = getDefaultThresholds(scoringData.scoringProfile as any);
        } else {
          // Default to moderate
          thresholds = getDefaultThresholds('moderate');
        }
        
        scoringConfig = {
          thresholds,
          scoringProfile: scoringData?.scoringProfile || 'moderate'
        };
      } else {
        // No scoring config, use default moderate thresholds
        scoringConfig = {
          thresholds: getDefaultThresholds('moderate'),
          scoringProfile: 'moderate'
        };
      }
    } catch (error) {
      console.error('Error fetching scoring config:', error);
      // Use default moderate thresholds on error
      scoringConfig = {
        thresholds: getDefaultThresholds('moderate'),
        scoringProfile: 'moderate'
      };
    }

    // Fetch onboarding questionnaire status (Phase 1: Consolidate API calls)
    let onboardingStatus = 'not_started';
    let onboardingProgress = 0;
    try {
      const clientDoc = await db.collection('clients').doc(clientIdToUse).get();
      if (clientDoc.exists) {
        onboardingStatus = clientDoc.data()?.onboardingStatus || 'not_started';
      }
      
      // Fetch onboarding responses if they exist
      const onboardingSnapshot = await db.collection('client_onboarding_responses')
        .where('clientId', '==', clientIdToUse)
        .limit(1)
        .get();
      
      if (!onboardingSnapshot.empty) {
        const onboardingData = onboardingSnapshot.docs[0].data();
        onboardingProgress = onboardingData?.progress?.completionPercentage || 0;
      }
    } catch (error) {
      console.error('Error fetching onboarding status:', error);
    }

    // Fetch onboarding todos (Phase 1: Consolidate API calls)
    let onboardingTodos = {
      hasWeight: false,
      hasMeasurements: false,
      hasBeforePhotos: false
    };
    
    // Fetch measurement schedule and next task
    let measurementSchedule = null;
    let nextMeasurementTask = null;
    
    try {
      // Fetch measurements and images in parallel
      const [measurementsSnapshot, imagesSnapshot] = await Promise.all([
        db.collection('client_measurements')
          .where('clientId', '==', clientIdToUse)
          .limit(50)
          .get(),
        db.collection('progress_images')
          .where('clientId', '==', clientIdToUse)
          .limit(50)
          .get()
      ]);
      
      const measurements = measurementsSnapshot.docs.map(doc => doc.data());
      const images = imagesSnapshot.docs.map(doc => doc.data());
      
      onboardingTodos = {
        hasWeight: measurements.some((m: any) => m.bodyWeight && m.bodyWeight > 0),
        hasMeasurements: measurements.some((m: any) => {
          const measurementValues = m.measurements || {};
          return Object.keys(measurementValues).length > 0 && 
                 Object.values(measurementValues).some((v: any) => v && v > 0);
        }),
        hasBeforePhotos: images.some((img: any) => img.imageType === 'before')
      };

      // Fetch measurement schedule
      try {
        const scheduleSnapshot = await db.collection('measurement_schedules')
          .where('clientId', '==', clientIdToUse)
          .where('isActive', '==', true)
          .limit(1)
          .get();

        if (!scheduleSnapshot.empty) {
          const scheduleDoc = scheduleSnapshot.docs[0];
          const scheduleData = scheduleDoc.data();
          
          measurementSchedule = {
            id: scheduleDoc.id,
            clientId: scheduleData.clientId,
            coachId: scheduleData.coachId,
            firstFridayDate: scheduleData.firstFridayDate?.toDate?.()?.toISOString()?.split('T')[0] || 
                            (scheduleData.firstFridayDate instanceof Date ? scheduleData.firstFridayDate.toISOString().split('T')[0] : scheduleData.firstFridayDate),
            frequency: scheduleData.frequency || 'fortnightly',
            isActive: scheduleData.isActive
          };

          // Calculate next measurement task date
          if (measurementSchedule.firstFridayDate) {
            const { getNextMeasurementDate, getMeasurementTaskStatus } = await import('@/lib/measurement-task-utils');
            const nextDate = getNextMeasurementDate(measurementSchedule);
            if (nextDate) {
              const taskStatus = getMeasurementTaskStatus(nextDate);
              nextMeasurementTask = {
                dueDate: nextDate,
                status: taskStatus.status,
                daysUntil: taskStatus.days
              };
            }
          }
        }
      } catch (scheduleError) {
        console.error('Error fetching measurement schedule:', scheduleError);
      }
    } catch (error) {
      console.error('Error fetching onboarding todos:', error);
    }

    // Prepare response data
    const responseData = {
      client: clientData,
      coach: coachData,
      checkInAssignments: checkInAssignments,
      summary: {
        totalAssignments: checkInAssignments.length,
        pendingAssignments: checkInAssignments.filter(a => a.status === 'pending').length,
        completedAssignments: checkInAssignments.filter(a => a.status === 'completed').length,
        recentResponses: recentResponses
      },
      scoringConfig,
      onboarding: {
        status: onboardingStatus,
        progress: onboardingProgress,
        todos: onboardingTodos
      },
      measurementSchedule,
      nextMeasurementTask
    };

    // Cache the response (Phase 1: Add basic caching)
    const cacheKey = `dashboard:${clientIdToUse}`;
    setCache(cacheKey, responseData);

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Error fetching client portal data:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch client portal data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
