/**
 * Script to check the Vana Health 2026 Check In form status
 * Shows due dates, window settings, and expected status
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
try {
  const serviceAccount = require('../service-account-key.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
  console.error('Error initializing Firebase:', error.message);
  console.log('Note: This script requires service-account-key.json');
  process.exit(1);
}

const db = admin.firestore();

async function checkVanaForm() {
  try {
    console.log('=== CHECKING VANA HEALTH 2026 CHECK IN FORM ===\n');
    
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
      } else {
        // Try case-insensitive search
        const allForms = await db.collection('forms').get();
        for (const doc of allForms.docs) {
          const title = doc.data().title || '';
          if (title.toLowerCase().includes('vana') && title.toLowerCase().includes('2026')) {
            formId = doc.id;
            formData = doc.data();
            break;
          }
        }
      }
    }
    
    if (!formId || !formData) {
      console.log('❌ Form "Vana Health 2026 Check In" not found');
      process.exit(1);
    }
    
    console.log('✅ FORM FOUND:');
    console.log('   ID:', formId);
    console.log('   Title:', formData.title);
    console.log('   Coach ID:', formData.coachId);
    console.log('');
    
    // Get current time
    const now = new Date();
    console.log('=== CURRENT TIME ===');
    console.log('   Now:', now.toISOString());
    console.log('   Local:', now.toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }));
    console.log('   Day of Week:', ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()]);
    console.log('');
    
    // Find all assignments for this form
    const assignmentsSnapshot = await db.collection('check_in_assignments')
      .where('formId', '==', formId)
      .get();
    
    console.log(`=== ASSIGNMENTS (${assignmentsSnapshot.size} total) ===\n`);
    
    // Get assignments sorted by due date
    const assignments = assignmentsSnapshot.docs.map(doc => {
      const data = doc.data();
      const dueDate = data.dueDate?.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
      return {
        id: doc.id,
        clientId: data.clientId,
        dueDate: dueDate,
        status: data.status || 'pending',
        recurringWeek: data.recurringWeek || null,
        checkInWindow: data.checkInWindow || null
      };
    });
    
    // Sort by due date
    assignments.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    
    // Show first 10 assignments
    const displayAssignments = assignments.slice(0, 10);
    
    for (const assignment of displayAssignments) {
      const dueDate = assignment.dueDate;
      const window = assignment.checkInWindow || { enabled: false };
      
      console.log(`Assignment ${assignment.id.substring(0, 8)}...`);
      console.log('   Client ID:', assignment.clientId);
      console.log('   Status:', assignment.status);
      console.log('   Recurring Week:', assignment.recurringWeek || 'N/A');
      console.log('   Due Date:', dueDate.toISOString());
      console.log('   Due Date Local:', dueDate.toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }));
      console.log('   Day of Week:', ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dueDate.getDay()]);
      
      if (window.enabled) {
        console.log('   Check-in Window:');
        console.log('     Start:', window.startDay, window.startTime);
        console.log('     End:', window.endDay, window.endTime);
        
        // Calculate window times
        const dueDateLocal = new Date(dueDate);
        dueDateLocal.setHours(9, 0, 0, 0); // Monday 9am
        
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
        
        console.log('     Calculated Window:');
        console.log('       Opens:', windowStart.toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }));
        console.log('       Closes:', windowEnd.toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }));
        
        // Check current status
        const isOpen = now >= windowStart && now <= windowEnd;
        const isOverdue = now > windowEnd && dueDate < now;
        const isFuture = windowStart > now;
        
        console.log('     Current Status:');
        if (isOpen) {
          console.log('       ✅ WINDOW IS OPEN');
        } else if (isOverdue) {
          console.log('       ❌ WINDOW CLOSED (Overdue)');
        } else if (isFuture) {
          console.log('       ⏳ WINDOW NOT YET OPEN');
          const hoursUntilOpen = (windowStart.getTime() - now.getTime()) / (1000 * 60 * 60);
          console.log('         Opens in:', Math.round(hoursUntilOpen), 'hours');
        }
        
        if (assignment.status === 'completed') {
          console.log('       ✅ Assignment is COMPLETED');
        }
      } else {
        console.log('   Check-in Window: DISABLED (always open)');
      }
      
      console.log('');
    }
    
    // Summary
    console.log('=== SUMMARY ===');
    console.log(`Total assignments: ${assignments.length}`);
    console.log(`Pending: ${assignments.filter(a => a.status === 'pending').length}`);
    console.log(`Completed: ${assignments.filter(a => a.status === 'completed').length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkVanaForm();


