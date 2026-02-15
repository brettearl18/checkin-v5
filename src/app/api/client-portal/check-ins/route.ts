import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { notificationService } from '@/lib/notification-service';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { verifyClientAccess } from '@/lib/api-auth';
import { logSafeError } from '@/lib/logger';
// Window system removed - using fixed Friday 10am to Tuesday 12pm schedule

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



export async function GET(request: NextRequest) {
  try {
    // Feature flag: Use pre-created assignments if enabled
    if (FEATURE_FLAGS.USE_PRE_CREATED_ASSIGNMENTS) {
      // Import and call the new simplified endpoint
      const preCreatedModule = await import('../check-ins-precreated/route');
      return preCreatedModule.GET(request);
    }
    
    // Legacy: Dynamic generation (existing code below)
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    const accessResult = await verifyClientAccess(request, clientId);
    if (accessResult instanceof NextResponse) return accessResult;

    // Check if client has completed onboarding
    // If not, return empty check-ins list (coaches can still allocate, but clients won't see them)
    let onboardingCompleted = false;
    try {
      const clientDoc = await db.collection('clients').doc(clientId).get();
      if (clientDoc.exists) {
        const clientData = clientDoc.data();
        const canStartCheckIns = clientData?.canStartCheckIns;
        const onboardingStatus = clientData?.onboardingStatus;
        // Onboarding is completed if status is 'completed' or 'submitted', OR canStartCheckIns is true
        onboardingCompleted = 
          onboardingStatus === 'completed' || 
          onboardingStatus === 'submitted' ||
          canStartCheckIns === true;
      }
    } catch (error) {
      console.error('Error checking client onboarding status:', error);
      // If we can't check, default to showing check-ins (fail open for better UX)
      onboardingCompleted = true;
    }

    // If onboarding is not completed, return empty list
    if (!onboardingCompleted) {
      return NextResponse.json({
        success: true,
        data: {
          checkins: [],
          summary: {
            total: 0,
            pending: 0,
            completed: 0,
            overdue: 0
          }
        }
      });
    }

    let allAssignments: any[] = [];

    try {
      // Try with orderBy first
      const assignmentsSnapshot = await db.collection('check_in_assignments')
        .where('clientId', '==', clientId)
        .orderBy('dueDate', 'asc')
        .get();

      allAssignments = await Promise.all(assignmentsSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        
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

        // Check if pausedUntil date has passed - auto-reactivate if so
        let assignmentStatus = data.status || 'active';
        let pausedUntil = data.pausedUntil;
        
        if (assignmentStatus === 'inactive' && pausedUntil) {
          const pausedUntilDate = pausedUntil?.toDate ? pausedUntil.toDate() : new Date(pausedUntil);
          const now = new Date();
          
          // If pausedUntil date has passed, automatically reactivate
          if (pausedUntilDate <= now) {
            assignmentStatus = 'active';
            pausedUntil = null;
            // Update the assignment in the background
            db.collection('check_in_assignments').doc(doc.id).update({
              status: 'active',
              pausedUntil: null
            }).catch(err => console.error('Error auto-reactivating check-in:', err));
          }
        }

        // Convert Firestore Timestamp to Date for dueDate
        const dueDate = convertDate(data.dueDate);
        const dueDateObj = new Date(dueDate);
        const now = new Date();
        
        // Determine display status: 'pending', 'completed', 'overdue', or 'missed' (parked by coach)
        // A check-in is completed if: status is 'completed', OR has completedAt, OR has responseId (definitive proof of completion)
        let displayStatus: 'pending' | 'completed' | 'overdue' | 'missed';
        if (assignmentStatus === 'completed' || data.completedAt || data.responseId) {
          displayStatus = 'completed';
        } else if (assignmentStatus === 'missed') {
          displayStatus = 'missed';
        } else {
          // Check if overdue (3+ days past due date)
          const daysPastDue = Math.floor((now.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));
          if (daysPastDue >= 3) {
            displayStatus = 'overdue';
            // Auto-update database status to 'overdue' if it's not already set (only for pending/active statuses)
            if (assignmentStatus !== 'overdue' && assignmentStatus !== 'completed' && assignmentStatus !== 'missed') {
              // Update in background (don't wait for it)
              db.collection('check_in_assignments').doc(doc.id).update({
                status: 'overdue',
                updatedAt: new Date()
              }).catch(err => console.error('Error updating assignment status to overdue:', err));
            }
          } else {
            // Map 'active' and 'pending' to 'pending' for display
            displayStatus = 'pending';
          }
        }
        
        // Check if coach has responded (has feedback)
        let coachResponded = false;
        const responseId = data.responseId;
        
        if (responseId) {
          try {
            const feedbackSnapshot = await db.collection('coachFeedback')
              .where('responseId', '==', responseId)
              .limit(1)
              .get();
            
            coachResponded = !feedbackSnapshot.empty;
          } catch (error) {
            console.log('Error checking feedback:', error);
          }
        }

        // Window system removed - kept for backwards compatibility only
        const checkInWindow = data.checkInWindow || null;

        const assignmentData = {
          id: data.id || doc.id, // Use original id field if it exists, otherwise use document ID
          documentId: doc.id, // Preserve the Firestore document ID separately
          title: data.formTitle || 'Check-in Assignment',
          description: data.description || 'Complete your assigned check-in',
          dueDate: dueDate,
          status: displayStatus,
          formId: data.formId || '',
          assignedBy: data.assignedBy || 'Coach',
          assignedAt: convertDate(data.assignedAt),
          completedAt: data.completedAt ? convertDate(data.completedAt) : undefined,
          score: data.score || undefined,
          isRecurring: data.isRecurring || false,
          recurringWeek: data.recurringWeek || 1,
          totalWeeks: data.totalWeeks || 1,
          checkInWindow: checkInWindow,
          pausedUntil: pausedUntil ? (pausedUntil?.toDate ? pausedUntil.toDate().toISOString() : new Date(pausedUntil).toISOString()) : undefined,
          responseId: responseId,
          coachResponded: coachResponded || data.coachResponded || false
        };

        return assignmentData;
      }));
    } catch (indexError) {
      console.log('Index error, trying without orderBy:', indexError);
      
      // Fallback: query without orderBy
      const assignmentsSnapshot = await db.collection('check_in_assignments')
        .where('clientId', '==', clientId)
        .get();

      allAssignments = await Promise.all(assignmentsSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        
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

        // Determine assignment status
        const assignmentStatus = data.status || 'active';
        
        // Convert Firestore Timestamp to Date for dueDate
        const dueDate = convertDate(data.dueDate);
        const dueDateObj = new Date(dueDate);
        const now = new Date();
        
        // Determine display status: 'pending', 'completed', 'overdue', or 'missed' (parked by coach)
        // A check-in is completed if: status is 'completed', OR has completedAt, OR has responseId (definitive proof of completion)
        let displayStatus: 'pending' | 'completed' | 'overdue' | 'missed';
        if (assignmentStatus === 'completed' || data.completedAt || data.responseId) {
          displayStatus = 'completed';
        } else if (assignmentStatus === 'missed') {
          displayStatus = 'missed';
        } else {
          // Check if overdue (3+ days past due date)
          const daysPastDue = Math.floor((now.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));
          if (daysPastDue >= 3) {
            displayStatus = 'overdue';
            // Auto-update database status to 'overdue' if it's not already set (only for pending/active statuses)
            if (assignmentStatus !== 'overdue' && assignmentStatus !== 'completed' && assignmentStatus !== 'missed') {
              // Update in background (don't wait for it)
              db.collection('check_in_assignments').doc(doc.id).update({
                status: 'overdue',
                updatedAt: new Date()
              }).catch(err => console.error('Error updating assignment status to overdue:', err));
            }
          } else {
            // Map 'active' and 'pending' to 'pending' for display
            displayStatus = 'pending';
          }
        }
        
        // Check if coach has responded (has feedback)
        let coachResponded = false;
        const responseId = data.responseId;
        
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

        // Ensure checkInWindow is properly structured (same logic as above)
        let checkInWindow = null; // Window system removed - kept for backwards compatibility
        if (data.checkInWindow) {
          if (typeof data.checkInWindow === 'object' && 
              data.checkInWindow.enabled !== undefined &&
              data.checkInWindow.startDay &&
              data.checkInWindow.startTime) {
            checkInWindow = data.checkInWindow;
          } else {
            console.log('Invalid checkInWindow structure for assignment (fallback):', doc.id);
          }
        }

        return {
          id: data.id || doc.id, // Use original id field if it exists, otherwise use document ID
          documentId: doc.id, // Preserve the Firestore document ID separately
          title: data.formTitle || 'Check-in Assignment',
          description: data.description || 'Complete your assigned check-in',
          dueDate: dueDate,
          status: displayStatus,
          formId: data.formId || '',
          assignedBy: data.assignedBy || 'Coach',
          assignedAt: convertDate(data.assignedAt),
          completedAt: data.completedAt ? convertDate(data.completedAt) : undefined,
          score: data.score || undefined,
          isRecurring: data.isRecurring || false,
          recurringWeek: data.recurringWeek || 1,
          totalWeeks: data.totalWeeks || 1,
          checkInWindow: checkInWindow,
          responseId: responseId,
          coachResponded: coachResponded || data.coachResponded || false
        };
      }));

      // Sort manually by due date
      allAssignments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }

    // Expand recurring check-ins into individual weekly assignments
    // Group assignments by formId and clientId to identify recurring series
    const recurringSeriesMap = new Map<string, any[]>();
    const nonRecurringAssignments: any[] = [];
    
    allAssignments.forEach(assignment => {
      if (assignment.isRecurring && assignment.totalWeeks > 1) {
        // Use a unique key based on formId and clientId only
        // This ensures all recurring check-ins for the same form+client are in ONE series
        // If multiple series exist (due to different start dates), we'll merge them
        const seriesKey = `${assignment.formId}_${assignment.clientId}`;
        if (!recurringSeriesMap.has(seriesKey)) {
          recurringSeriesMap.set(seriesKey, []);
        }
        recurringSeriesMap.get(seriesKey)!.push(assignment);
      } else {
        // Non-recurring assignments go directly to the result
        nonRecurringAssignments.push(assignment);
      }
    });
    
    const expandedAssignments: any[] = [...nonRecurringAssignments];
    const now = new Date();
    
    // Process each recurring series and expand missing weeks
    // Use for...of instead of forEach to support await
    for (const [seriesKey, seriesAssignments] of recurringSeriesMap.entries()) {
      // If multiple assignments exist for the same form+client (multiple allocations), merge them
      // Group by recurringWeek and keep only one per week (prefer completed, then most recent)
      const weekMap = new Map<number, any>();
      seriesAssignments.forEach(assignment => {
        const week = assignment.recurringWeek || 1;
        if (!weekMap.has(week)) {
          weekMap.set(week, assignment);
        } else {
          // If duplicate week exists, prefer completed ones, then most recent
          const existing = weekMap.get(week)!;
          if (assignment.status === 'completed' && existing.status !== 'completed') {
            weekMap.set(week, assignment);
          } else if (assignment.status === existing.status) {
            // Both same status, prefer most recent assignedAt
            const existingDate = existing.assignedAt ? new Date(existing.assignedAt).getTime() : 0;
            const currentDate = assignment.assignedAt ? new Date(assignment.assignedAt).getTime() : 0;
            if (currentDate > existingDate) {
              weekMap.set(week, assignment);
            }
          }
        }
      });
      
      // Convert back to array, sorted by week number
      const deduplicatedSeries = Array.from(weekMap.values()).sort((a, b) => {
        const weekA = a.recurringWeek || 1;
        const weekB = b.recurringWeek || 1;
        return weekA - weekB;
      });
      
      // Get the base assignment (prefer one with recurringWeek: 1, otherwise the first one)
      const baseAssignment = deduplicatedSeries.find(a => a.recurringWeek === 1) || deduplicatedSeries[0];
      
      // Skip if no base assignment found (shouldn't happen, but safety check)
      if (!baseAssignment || !baseAssignment.clientId || !baseAssignment.formId) {
        // Just add existing assignments and continue to next series
        deduplicatedSeries.forEach(assignment => {
          expandedAssignments.push(assignment);
        });
        continue;
      }
      
      // CRITICAL: Query for ALL assignments (including completed Week X) for this client+form
      // This ensures we catch completed Week 2+ assignments that were created on submission
      const clientId = baseAssignment.clientId;
      const formId = baseAssignment.formId;
      const allWeeksQuery = await db.collection('check_in_assignments')
        .where('clientId', '==', clientId)
        .where('formId', '==', formId)
        .where('isRecurring', '==', true)
        .get();
      
      // Process all assignments from database (including completed Week X assignments)
      const allWeeksFromDB: any[] = [];
      allWeeksQuery.docs.forEach(doc => {
        const data = doc.data();
        const convertDate = (dateField: any) => {
          if (!dateField) return new Date().toISOString();
          if (dateField.toDate && typeof dateField.toDate === 'function') {
            return dateField.toDate().toISOString();
          }
          if (dateField._seconds) {
            return new Date(dateField._seconds * 1000).toISOString();
          }
          if (dateField instanceof Date) {
            return dateField.toISOString();
          }
          if (typeof dateField === 'string') {
            return new Date(dateField).toISOString();
          }
          return new Date().toISOString();
        };
        
        const dueDate = convertDate(data.dueDate);
        const dueDateObj = new Date(dueDate);
        
        // Determine display status
        // A check-in is completed if: status is 'completed', OR has completedAt, OR has responseId (definitive proof of completion)
        let displayStatus: 'pending' | 'completed' | 'overdue' | 'missed';
        if (data.status === 'completed' || data.completedAt || data.responseId) {
          displayStatus = 'completed';
        } else if (data.status === 'missed') {
          displayStatus = 'missed';
        } else {
          // Check if overdue (3+ days past due date)
          const daysPastDue = Math.floor((now.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));
          if (daysPastDue >= 3) {
            displayStatus = 'overdue';
            // Auto-update database status to 'overdue' if it's not already set
            const currentStatus = data.status || 'pending';
            if (currentStatus !== 'overdue' && currentStatus !== 'completed' && currentStatus !== 'missed') {
              // Update in background (don't wait for it)
              db.collection('check_in_assignments').doc(doc.id).update({
                status: 'overdue',
                updatedAt: new Date()
              }).catch(err => console.error('Error updating assignment status to overdue:', err));
            }
          } else {
            displayStatus = 'pending';
          }
        }
        
        // Only add if not already in deduplicatedSeries (avoid duplicates)
        const week = data.recurringWeek || 1;
        const isDuplicate = deduplicatedSeries.some(a => 
          (a.recurringWeek || 1) === week && a.documentId === doc.id
        );
        
        if (!isDuplicate) {
          allWeeksFromDB.push({
            id: data.id || doc.id,
            documentId: doc.id,
            title: data.formTitle || 'Check-in Assignment',
            description: data.description || 'Complete your assigned check-in',
            dueDate: dueDate,
            status: displayStatus,
            formId: data.formId || '',
            assignedBy: data.assignedBy || 'Coach',
            assignedAt: convertDate(data.assignedAt),
            completedAt: data.completedAt ? convertDate(data.completedAt) : undefined,
            score: data.score || undefined,
            isRecurring: data.isRecurring || false,
            recurringWeek: data.recurringWeek || 1,
            totalWeeks: data.totalWeeks || 1,
            checkInWindow: data.checkInWindow || null,
            responseId: data.responseId,
            coachResponded: false
          });
        }
      });
      
      // Merge all assignments (from initial query + newly found Week X assignments)
      // IMPORTANT: Deduplicate by recurringWeek, preferring completed assignments
      const allExistingAssignmentsMap = new Map<number, any>();
      
      // First, add assignments from deduplicatedSeries (these are from initial query)
      deduplicatedSeries.forEach(assignment => {
        const week = assignment.recurringWeek || 1;
        if (!allExistingAssignmentsMap.has(week)) {
          allExistingAssignmentsMap.set(week, assignment);
        } else {
          // Prefer completed assignments
          const existing = allExistingAssignmentsMap.get(week)!;
          // An assignment is completed if it has a responseId (definitive proof of completion)
          const existingIsCompleted = !!existing.responseId;
          const currentIsCompleted = !!assignment.responseId;
          if (currentIsCompleted && !existingIsCompleted) {
            allExistingAssignmentsMap.set(week, assignment);
          }
        }
      });
      
      // Then, add assignments from allWeeksFromDB (these are from query for all recurring weeks)
      // These should override non-completed ones since they're the most up-to-date
      allWeeksFromDB.forEach(assignment => {
        const week = assignment.recurringWeek || 1;
        if (!allExistingAssignmentsMap.has(week)) {
          allExistingAssignmentsMap.set(week, assignment);
        } else {
          // Prefer completed assignments and real documents
          const existing = allExistingAssignmentsMap.get(week)!;
          // An assignment is completed if it has a responseId (definitive proof of completion)
          const existingIsCompleted = !!existing.responseId;
          const currentIsCompleted = !!assignment.responseId;
          
          if (currentIsCompleted && !existingIsCompleted) {
            allExistingAssignmentsMap.set(week, assignment);
          } else if (existingIsCompleted && !currentIsCompleted) {
            // Keep existing completed one
          } else {
            // Both same completion status, prefer the one from allWeeksFromDB (more recent query)
            allExistingAssignmentsMap.set(week, assignment);
          }
        }
      });
      
      const allExistingAssignments = Array.from(allExistingAssignmentsMap.values());
      const existingWeeks = new Set(allExistingAssignments.map(a => a.recurringWeek || 1));
      
      // Add all existing assignments from the series (these are real documents from DB)
      allExistingAssignments.forEach(assignment => {
        expandedAssignments.push(assignment);
      });
      
      // Expand future weeks if there are more weeks to generate
      // Check if we need to generate future weeks beyond the existing ones
      if (baseAssignment && baseAssignment.totalWeeks > 1) {
        const firstDueDate = new Date(baseAssignment.dueDate);
        const checkInWindow = baseAssignment.checkInWindow || null; // Window system removed
        // Safely calculate max existing week (handle empty array)
        const weekNumbers = allExistingAssignments.map(a => a.recurringWeek || 1);
        const maxExistingWeek = weekNumbers.length > 0 ? Math.max(...weekNumbers) : 0;
        
        // Generate assignments for weeks beyond the existing ones
        // IMPORTANT: Only generate weeks that don't already exist as real assignment documents
        // Each week starts on Monday, so calculate Monday dates
        const firstWeekStart = getWeekStart(firstDueDate); // Get Monday of first week
        
        for (let week = maxExistingWeek + 1; week <= baseAssignment.totalWeeks; week++) {
          // Skip if this week already exists as a real assignment document (including completed ones)
          if (existingWeeks.has(week)) {
            continue;
          }
          // Calculate Monday for this week (7 days * (week - 1) from first Monday)
          const weekMonday = new Date(firstWeekStart);
          weekMonday.setDate(firstWeekStart.getDate() + (7 * (week - 1)));
          weekMonday.setHours(9, 0, 0, 0); // Set to 9:00 AM (default due time)
          
          // Include weeks that are:
          // 1. Future weeks (not yet arrived), OR
          // 2. Recent weeks (within 3 weeks in the past) that weren't completed
          // This ensures Week 2, Week 3, etc. show up even if their Monday has passed
          const weeksAgo = (now.getTime() - weekMonday.getTime()) / (1000 * 60 * 60 * 24 * 7);
          const isFuture = weekMonday >= now;
          const isRecentPast = weeksAgo <= 3 && weekMonday < now;
          
          if (isFuture || isRecentPast) {
            expandedAssignments.push({
              ...baseAssignment,
              id: `${baseAssignment.id}_week_${week}`, // Unique ID for each week
              recurringWeek: week,
              dueDate: weekMonday.toISOString(),
                status: (() => {
                  const daysPastDue = Math.floor((now.getTime() - weekMonday.getTime()) / (1000 * 60 * 60 * 24));
                  return daysPastDue >= 3 ? 'overdue' : 'pending';
                })(),
              checkInWindow: checkInWindow,
              responseId: undefined,
              coachResponded: false,
              completedAt: undefined,
              score: undefined
            });
          }
        }
      }
    }
    
    // Deduplicate check-ins: Remove duplicates based on recurringWeek + dueDate combination
    // If multiple check-ins have the same week number and same/similar due date, keep only one
    const seen = new Map<string, any>();
    const deduplicatedAssignments: any[] = [];
    
    expandedAssignments.forEach(assignment => {
      if (assignment.isRecurring && assignment.recurringWeek) {
        // Create a key based on recurringWeek and due date (rounded to day)
        const dueDate = new Date(assignment.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const key = `${assignment.recurringWeek}_${dueDate.toISOString().split('T')[0]}`;
        
        if (!seen.has(key)) {
          seen.set(key, assignment);
          deduplicatedAssignments.push(assignment);
        } else {
          // If duplicate found, prefer in this order:
          // 1. Completed assignments (has responseId and status === 'completed')
          // 2. Real assignment documents (has documentId and not a dynamic ID)
          // 3. Most recent assignedAt date
          const existing = seen.get(key)!;
          // An assignment is completed if it has a responseId (definitive proof of completion)
          const existingIsCompleted = !!existing.responseId;
          const currentIsCompleted = !!assignment.responseId;
          
          // Prefer completed assignments
          if (currentIsCompleted && !existingIsCompleted) {
            const index = deduplicatedAssignments.indexOf(existing);
            if (index > -1) {
              deduplicatedAssignments[index] = assignment;
              seen.set(key, assignment);
            }
          } else if (!currentIsCompleted && existingIsCompleted) {
            // Keep existing completed assignment
            return; // Skip current assignment
          } else {
            // Both same completion status, check if one is a real document vs dynamic
            const existingIsReal = existing.documentId && !existing.id?.includes('_week_');
            const currentIsReal = assignment.documentId && !assignment.id?.includes('_week_');
            
            if (currentIsReal && !existingIsReal) {
              // Prefer real document over dynamic
              const index = deduplicatedAssignments.indexOf(existing);
              if (index > -1) {
                deduplicatedAssignments[index] = assignment;
                seen.set(key, assignment);
              }
            } else if (!currentIsReal && existingIsReal) {
              // Keep existing real document
              return; // Skip current assignment
            } else {
              // Both same type, prefer most recent assignedAt date
              const existingDate = existing.assignedAt ? new Date(existing.assignedAt).getTime() : 0;
              const currentDate = assignment.assignedAt ? new Date(assignment.assignedAt).getTime() : 0;
              
              if (currentDate > existingDate) {
                const index = deduplicatedAssignments.indexOf(existing);
                if (index > -1) {
                  deduplicatedAssignments[index] = assignment;
                  seen.set(key, assignment);
                }
              }
            }
          }
        }
      } else {
        // Non-recurring assignments: deduplicate by id
        if (!seen.has(assignment.id)) {
          seen.set(assignment.id, assignment);
          deduplicatedAssignments.push(assignment);
        }
      }
    });
    
    // Show all assignments (including expanded recurring ones, now deduplicated)
    const assignments = deduplicatedAssignments;

    // Fetch coach names for all unique coach IDs
    const coachIds = [...new Set(assignments.map(a => a.assignedBy).filter(id => id && id !== 'Coach'))];
    const coachNames: { [key: string]: string } = {};

    if (coachIds.length > 0) {
      try {
        const coachesSnapshot = await db.collection('coaches').get();
        coachesSnapshot.docs.forEach(doc => {
          const coachData = doc.data();
          if (coachIds.includes(doc.id)) {
            const firstName = coachData.profile?.firstName || '';
            const lastName = coachData.profile?.lastName || '';
            coachNames[doc.id] = `${firstName} ${lastName}`.trim() || 'Unknown Coach';
          }
        });
      } catch (error) {
        console.error('Error fetching coach names:', error);
      }
    }

    // Update assignments with coach names
    assignments.forEach(assignment => {
      assignment.assignedBy = coachNames[assignment.assignedBy] || assignment.assignedBy || 'Coach';
    });

    // Calculate summary statistics based on ALL assignments (not just current ones)
    const total = allAssignments.length;
    const pending = allAssignments.filter(a => a.status === 'pending').length;
    const completed = allAssignments.filter(a => a.status === 'completed').length;
    const overdue = allAssignments.filter(a => {
      if (a.status === 'completed') return false;
      const dueDate = new Date(a.dueDate);
      return dueDate < new Date(); // Use new Date() for current date
    }).length;

    // Check for overdue check-ins and create notifications
    // Only send notifications for ACTIVE check-ins (not inactive/paused ones)
    const overdueAssignments = allAssignments.filter(assignment => {
      const dueDate = assignment.dueDate?.toDate ? assignment.dueDate.toDate() : new Date(assignment.dueDate);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      // Only notify for active check-ins that are overdue
      return diffDays > 0 && (assignment.status === 'active' || assignment.status === 'pending');
    });

    // Create notifications for overdue check-ins (limit to prevent spam)
    for (const assignment of overdueAssignments.slice(0, 3)) {
      try {
        await notificationService.createCheckInDueNotification(
          clientId,
          assignment.id,
          assignment.title,
          assignment.dueDate?.toDate ? assignment.dueDate.toDate() : new Date(assignment.dueDate)
        );
      } catch (error) {
        console.error('Error creating overdue notification:', error);
      }
    }

    console.log('Check-ins API Debug:', { total, pending, completed, overdue, assignments });

    return NextResponse.json({
      success: true,
      data: {
        checkins: assignments, // All assignments
        summary: {
          total,
          pending,
          completed,
          overdue
        }
      }
    });

  } catch (error) {
    console.error('Error fetching client check-ins:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch check-ins',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
    }, { status: 500 });
  }
}
