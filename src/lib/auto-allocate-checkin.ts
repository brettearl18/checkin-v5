/**
 * Helper functions for auto-allocating check-ins to new clients
 */

import { getDb } from './firebase-server';
import { DEFAULT_CHECK_IN_WINDOW } from './checkin-window-utils';

// The default form ID for "Vana Health 2026 Check In"
const DEFAULT_FORM_ID = 'form-1765694942359-sk9mu6mmr';

/**
 * Find form ID by title (fallback if default doesn't exist)
 */
async function findFormByTitle(title: string): Promise<string | null> {
  const db = getDb();
  try {
    const formsSnapshot = await db.collection('forms')
      .where('title', '==', title)
      .limit(1)
      .get();
    
    if (!formsSnapshot.empty) {
      return formsSnapshot.docs[0].id;
    }
  } catch (error) {
    console.error('Error finding form by title:', error);
  }
  return null;
}

/**
 * Get the default form ID for new clients
 */
export async function getDefaultFormId(): Promise<string> {
  const db = getDb();
  
  // First, try the known form ID
  try {
    const formDoc = await db.collection('forms').doc(DEFAULT_FORM_ID).get();
    if (formDoc.exists) {
      return DEFAULT_FORM_ID;
    }
  } catch (error) {
    console.error('Error checking default form:', error);
  }
  
  // Fallback: search by title
  const formId = await findFormByTitle('Vana Health 2026 Check In');
  if (formId) {
    return formId;
  }
  
  throw new Error('Default check-in form not found. Please create "Vana Health 2026 Check In" form first.');
}

/**
 * Calculate the next Friday from a given date
 */
function getNextFriday(fromDate: Date = new Date()): Date {
  const date = new Date(fromDate);
  const dayOfWeek = date.getDay(); // 0 = Sunday, 5 = Friday
  
  // Calculate days until next Friday
  // If it's Friday, return next Friday (7 days later)
  // Otherwise calculate days to next Friday
  if (dayOfWeek === 5) {
    date.setDate(date.getDate() + 7);
  } else {
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    date.setDate(date.getDate() + daysUntilFriday);
  }
  return date;
}

/**
 * Auto-allocate check-in form to a new client
 * @param clientId - The client ID
 * @param coachId - The coach ID
 * @param startDate - Optional start date (defaults to today)
 * @returns Assignment ID if successful, null if failed
 */
export async function autoAllocateCheckIn(
  clientId: string,
  coachId: string,
  startDate?: Date
): Promise<string | null> {
  try {
    const db = getDb();
    
    // Get the form ID
    const formId = await getDefaultFormId();
    
    // Check if check-in is already allocated for this client and form
    const existingAssignments = await db.collection('check_in_assignments')
      .where('clientId', '==', clientId)
      .where('formId', '==', formId)
      .limit(1)
      .get();
    
    if (!existingAssignments.empty) {
      console.log('Check-in already allocated for client:', clientId, 'Form:', formId);
      return existingAssignments.docs[0].id;
    }
    
    // Fetch form to get the title
    const formDoc = await db.collection('forms').doc(formId).get();
    if (!formDoc.exists) {
      console.error('Form not found:', formId);
      return null;
    }
    
    const formData = formDoc.data();
    const formTitle = formData?.title || 'Vana Health 2026 Check In';
    
    // Calculate dates
    const today = startDate || new Date();
    const programStartDate = today.toISOString().split('T')[0];
    
    // For "open straight away", set first check-in date to today (if Friday) or next Friday
    // Check if today is Friday - if so, use today; otherwise use next Friday
    let firstCheckInDate: Date;
    if (today.getDay() === 5) {
      // Today is Friday - use today so it's immediately available
      firstCheckInDate = new Date(today);
    } else {
      // Use next Friday
      firstCheckInDate = getNextFriday(today);
    }
    const firstCheckInDateString = firstCheckInDate.toISOString().split('T')[0];
    
    // Set due date to the first check-in date at 9:00 AM (so it's immediately available)
    const dueDate = new Date(firstCheckInDate);
    dueDate.setHours(9, 0, 0, 0);
    
    // Generate unique assignment ID
    const assignmentId = `assignment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create assignment object
    const assignment = {
      id: assignmentId,
      formId,
      formTitle: formTitle,
      clientId,
      coachId,
      frequency: 'weekly',
      duration: 52, // 1 year default
      startDate: programStartDate,
      firstCheckInDate: firstCheckInDateString,
      dueDate: dueDate,
      dueTime: '09:00',
      checkInWindow: DEFAULT_CHECK_IN_WINDOW,
      status: 'active',
      assignedAt: new Date(),
      completedAt: null,
      score: 0,
      responseCount: 0,
      isRecurring: true,
      recurringWeek: 1,
      totalWeeks: 52
    };
    
    // Save to Firestore
    const docRef = await db.collection('check_in_assignments').add(assignment);
    console.log('Auto-allocated check-in to client:', clientId, 'Assignment ID:', docRef.id);
    
    return docRef.id;
    
  } catch (error) {
    console.error('Error auto-allocating check-in:', error);
    return null;
  }
}

/**
 * Auto-create measurement schedule for a new client (fortnightly)
 * @param clientId - The client ID
 * @param coachId - The coach ID
 * @param startDate - Optional start date (defaults to today)
 * @returns Schedule ID if successful, null if failed
 */
export async function autoCreateMeasurementSchedule(
  clientId: string,
  coachId: string,
  startDate?: Date
): Promise<string | null> {
  try {
    const db = getDb();
    
    const today = startDate || new Date();
    
    // For measurements, start from the next Friday after onboarding
    // If today is Friday, measurements start next Friday (1 week later), then every 2 weeks
    // Otherwise, start on the next Friday
    let firstFridayDate: Date;
    if (today.getDay() === 5) {
      // Today is Friday - measurements start next Friday (1 week later)
      firstFridayDate = new Date(today);
      firstFridayDate.setDate(today.getDate() + 7);
    } else {
      // Use next Friday
      firstFridayDate = getNextFriday(today);
    }
    
    // Check if schedule already exists for this client
    const existingScheduleSnapshot = await db.collection('measurement_schedules')
      .where('clientId', '==', clientId)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    if (!existingScheduleSnapshot.empty) {
      // Update existing schedule
      const existingDoc = existingScheduleSnapshot.docs[0];
      await existingDoc.ref.update({
        firstFridayDate: firstFridayDate,
        frequency: 'fortnightly',
        updatedAt: new Date()
      });
      console.log('Measurement schedule updated for client:', clientId);
      return existingDoc.id;
    }
    
    // Create new schedule
    const scheduleData = {
      clientId,
      coachId,
      firstFridayDate: firstFridayDate,
      frequency: 'fortnightly',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const scheduleDocRef = await db.collection('measurement_schedules').add(scheduleData);
    console.log('Auto-created measurement schedule for client:', clientId, 'Schedule ID:', scheduleDocRef.id);
    
    return scheduleDocRef.id;
    
  } catch (error) {
    console.error('Error auto-creating measurement schedule:', error);
    return null;
  }
}

