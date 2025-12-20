import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    
    // Test queries that require indexes to verify they work
    const indexTests = [
      {
        name: 'check_in_assignments by clientId and dueDate',
        query: () => db.collection('check_in_assignments')
          .where('clientId', '==', 'test-client')
          .orderBy('dueDate', 'asc')
          .limit(1)
      },
      {
        name: 'forms by coachId and createdAt',
        query: () => db.collection('forms')
          .where('coachId', '==', 'test-coach')
          .orderBy('createdAt', 'desc')
          .limit(1)
      },
      {
        name: 'questions by coachId and createdAt',
        query: () => db.collection('questions')
          .where('coachId', '==', 'test-coach')
          .orderBy('createdAt', 'desc')
          .limit(1)
      },
      {
        name: 'clients by coachId and cleared',
        query: () => db.collection('clients')
          .where('coachId', '==', 'test-coach')
          .where('cleared', '==', false)
          .limit(1)
      },
      {
        name: 'formResponses by coachId and submittedAt',
        query: () => db.collection('formResponses')
          .where('coachId', '==', 'test-coach')
          .orderBy('submittedAt', 'desc')
          .limit(1)
      }
    ];

    const results = [];

    for (const test of indexTests) {
      try {
        await test.query().get();
        results.push({
          name: test.name,
          status: '✅ Working',
          error: null
        });
      } catch (error: any) {
        results.push({
          name: test.name,
          status: '❌ Failed',
          error: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Index verification completed',
      results,
      recommendations: [
        'If any tests failed, create the missing indexes using the Firebase Console',
        'Use the direct links from error messages to create indexes quickly',
        'Wait 1-5 minutes for indexes to become active after creation'
      ]
    });

  } catch (error) {
    console.error('Error testing indexes:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to test indexes',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    if (action === 'create-sample-data') {
      const db = getDb();
      
      // Create sample data to test indexes
      const sampleData = {
        check_in_assignments: [
          {
            clientId: 'test-client-1',
            coachId: 'test-coach-1',
            dueDate: new Date(),
            status: 'pending',
            assignedAt: new Date()
          }
        ],
        forms: [
          {
            coachId: 'test-coach-1',
            title: 'Test Form',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        questions: [
          {
            coachId: 'test-coach-1',
            text: 'Test Question',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        clients: [
          {
            coachId: 'test-coach-1',
            firstName: 'Test',
            lastName: 'Client',
            cleared: false,
            createdAt: new Date()
          }
        ],
        formResponses: [
          {
            coachId: 'test-coach-1',
            clientId: 'test-client-1',
            submittedAt: new Date(),
            score: 85
          }
        ]
      };

      const results = [];

      for (const [collection, documents] of Object.entries(sampleData)) {
        try {
          const batch = db.batch();
          documents.forEach((doc: any) => {
            const docRef = db.collection(collection).doc();
            batch.set(docRef, doc);
          });
          await batch.commit();
          results.push({
            collection,
            status: '✅ Created',
            count: documents.length
          });
        } catch (error: any) {
          results.push({
            collection,
            status: '❌ Failed',
            error: error.message
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Sample data creation completed',
        results
      });
    }

    return NextResponse.json({
      success: false,
      message: 'Invalid action'
    }, { status: 400 });

  } catch (error) {
    console.error('Error in setup-indexes POST:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to process request',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
