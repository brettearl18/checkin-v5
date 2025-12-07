import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

/**
 * Clears all test/demo data from the database
 * This includes:
 * - Questions with coachId 'demo-coach-id' or test coach IDs
 * - Clients with coachId 'demo-coach-id' or test coach IDs
 * - Forms with coachId 'demo-coach-id' or test coach IDs
 * - Check-in assignments for test clients
 * - Form responses for test clients
 * - Test users/profiles
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { confirm } = body;

    if (confirm !== 'CLEAR_ALL_TEST_DATA') {
      return NextResponse.json({
        success: false,
        message: 'Confirmation required. Send { "confirm": "CLEAR_ALL_TEST_DATA" } to proceed.'
      }, { status: 400 });
    }

    const db = getDb();
    const deletedCounts: { [key: string]: number } = {};

    // Test/demo identifiers to look for
    const testIdentifiers = [
      'demo-coach-id',
      'coach-001',
      'test-coach',
      'test-coach-1',
      'template'
    ];

    // Test email patterns
    const testEmailPatterns = [
      '@example.com',
      '@checkinv5.com',
      'test@',
      'demo@',
      'sample@'
    ];

    // 1. Delete test questions
    try {
      for (const testId of testIdentifiers) {
        const questionsSnapshot = await db.collection('questions')
          .where('coachId', '==', testId)
          .get();
        
        const deletePromises = questionsSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
        deletedCounts[`questions_${testId}`] = questionsSnapshot.docs.length;
      }
    } catch (error) {
      console.error('Error deleting test questions:', error);
    }

    // 2. Delete test clients
    try {
      // Delete clients by coachId
      for (const testId of testIdentifiers) {
        const clientsSnapshot = await db.collection('clients')
          .where('coachId', '==', testId)
          .get();
        
        const deletePromises = clientsSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
        deletedCounts[`clients_${testId}`] = clientsSnapshot.docs.length;
      }

      // Delete clients with test email patterns (get all and filter)
      const allClientsSnapshot = await db.collection('clients').get();
      const testClients = allClientsSnapshot.docs.filter(doc => {
        const email = doc.data().email || '';
        return testEmailPatterns.some(pattern => email.includes(pattern));
      });
      
      const testClientDeletePromises = testClients.map(doc => doc.ref.delete());
      await Promise.all(testClientDeletePromises);
      deletedCounts['clients_test_emails'] = testClients.length;
    } catch (error) {
      console.error('Error deleting test clients:', error);
    }

    // 3. Delete test forms
    try {
      for (const testId of testIdentifiers) {
        const formsSnapshot = await db.collection('forms')
          .where('coachId', '==', testId)
          .get();
        
        const deletePromises = formsSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
        deletedCounts[`forms_${testId}`] = formsSnapshot.docs.length;
      }
    } catch (error) {
      console.error('Error deleting test forms:', error);
    }

    // 4. Delete test check-in assignments
    try {
      for (const testId of testIdentifiers) {
        const assignmentsSnapshot = await db.collection('check_in_assignments')
          .where('coachId', '==', testId)
          .get();
        
        const deletePromises = assignmentsSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
        deletedCounts[`assignments_${testId}`] = assignmentsSnapshot.docs.length;
      }
    } catch (error) {
      console.error('Error deleting test assignments:', error);
    }

    // 5. Delete test form responses
    try {
      for (const testId of testIdentifiers) {
        const responsesSnapshot = await db.collection('formResponses')
          .where('coachId', '==', testId)
          .get();
        
        const deletePromises = responsesSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
        deletedCounts[`responses_${testId}`] = responsesSnapshot.docs.length;
      }
    } catch (error) {
      console.error('Error deleting test responses:', error);
    }

    // 6. Delete test user profiles (get all and filter by email patterns)
    try {
      const allUsersSnapshot = await db.collection('users').get();
      const testUsers = allUsersSnapshot.docs.filter(doc => {
        const email = doc.data().email || '';
        return testEmailPatterns.some(pattern => email.includes(pattern));
      });
      
      const deletePromises = testUsers.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);
      deletedCounts['users_test_emails'] = testUsers.length;
    } catch (error) {
      console.error('Error deleting test users:', error);
    }

    // 7. Delete test check-ins (old collection name)
    try {
      const checkInsSnapshot = await db.collection('checkIns').get();
      const deletePromises = checkInsSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);
      deletedCounts['checkIns'] = checkInsSnapshot.docs.length;
    } catch (error) {
      console.error('Error deleting test check-ins:', error);
    }

    // 8. Delete test notifications
    try {
      for (const testId of testIdentifiers) {
        const notificationsSnapshot = await db.collection('notifications')
          .where('metadata.coachId', '==', testId)
          .get();
        
        const deletePromises = notificationsSnapshot.docs.map(doc => doc.ref.delete());
        await Promise.all(deletePromises);
        deletedCounts[`notifications_${testId}`] = notificationsSnapshot.docs.length;
      }
    } catch (error) {
      console.error('Error deleting test notifications:', error);
    }

    // Calculate totals
    const totalDeleted = Object.values(deletedCounts).reduce((sum, count) => sum + count, 0);

    return NextResponse.json({
      success: true,
      message: `Cleared ${totalDeleted} test/demo records`,
      deletedCounts,
      totalDeleted
    });

  } catch (error) {
    console.error('Error clearing test data:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to clear test data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

