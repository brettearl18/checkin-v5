import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { isWithinCheckInWindow } from '@/lib/checkin-window-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    
    // Find the form
    let formId = null;
    let formData = null;
    
    // Try the known form ID first
    const knownFormId = 'form-1765694942359-sk9mu6mmr';
    const formDoc = await db.collection('forms').doc(knownFormId).get();
    
    if (formDoc.exists) {
      formId = knownFormId;
      formData = formDoc.data();
    } else {
      // Search by title
      const formsSnapshot = await db.collection('forms')
        .where('title', '==', 'Vana Health 2026 Check In')
        .limit(1)
        .get();
      
      if (!formsSnapshot.empty) {
        formId = formsSnapshot.docs[0].id;
        formData = formsSnapshot.docs[0].data();
      }
    }
    
    if (!formId || !formData) {
      return NextResponse.json({
        success: false,
        message: 'Form "Vana Health 2026 Check In" not found'
      }, { status: 404 });
    }
    
    const now = new Date();
    
    // Find all assignments for this form
    const assignmentsSnapshot = await db.collection('check_in_assignments')
      .where('formId', '==', formId)
      .limit(20)
      .get();
    
    const assignments = assignmentsSnapshot.docs.map(doc => {
      const data = doc.data();
      const dueDate = data.dueDate?.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
      const window = data.checkInWindow || { enabled: false };
      
      // Calculate window status
      let windowStatus = { isOpen: true, message: 'Always available' };
      if (window.enabled) {
        windowStatus = isWithinCheckInWindow(window, dueDate);
      }
      
      // Find the Monday of the week containing dueDate
      const dayOfWeek = dueDate.getDay();
      const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : (8 - dayOfWeek));
      const weekMonday = new Date(dueDate);
      weekMonday.setDate(dueDate.getDate() - daysToMonday);
      weekMonday.setHours(9, 0, 0, 0);
      
      // Window opens: Friday before that Monday (3 days before)
      const windowStart = new Date(weekMonday);
      windowStart.setDate(weekMonday.getDate() - 3);
      windowStart.setHours(9, 0, 0, 0);
      
      // Window closes: Tuesday after that Monday (1 day after)
      const windowEnd = new Date(weekMonday);
      windowEnd.setDate(weekMonday.getDate() + 1);
      windowEnd.setHours(12, 0, 0, 0);
      
      return {
        id: doc.id,
        clientId: data.clientId,
        dueDate: dueDate.toISOString(),
        dueDateLocal: dueDate.toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }),
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dueDate.getDay()],
        status: data.status || 'pending',
        recurringWeek: data.recurringWeek || null,
        checkInWindow: window,
        calculatedWindow: {
          start: windowStart.toISOString(),
          startLocal: windowStart.toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }),
          end: windowEnd.toISOString(),
          endLocal: windowEnd.toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })
        },
        windowStatus: windowStatus,
        currentTime: now.toISOString(),
        currentTimeLocal: now.toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }),
        isWithinWindow: now >= windowStart && now <= windowEnd,
        isOverdue: now > windowEnd && dueDate < now,
        isFuture: windowStart > now
      };
    });
    
    // Sort by due date
    assignments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    
    return NextResponse.json({
      success: true,
      form: {
        id: formId,
        title: formData.title,
        coachId: formData.coachId
      },
      currentTime: {
        iso: now.toISOString(),
        local: now.toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }),
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()]
      },
      assignments: assignments,
      summary: {
        total: assignments.length,
        pending: assignments.filter(a => a.status === 'pending').length,
        completed: assignments.filter(a => a.status === 'completed').length,
        windowsOpen: assignments.filter(a => a.isWithinWindow).length,
        windowsClosed: assignments.filter(a => a.isOverdue).length,
        windowsFuture: assignments.filter(a => a.isFuture).length
      }
    });
    
  } catch (error) {
    console.error('Error checking Vana form status:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to check form status',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}


