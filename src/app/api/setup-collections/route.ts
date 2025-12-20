import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    if (action === 'setup') {
      await setupCollections();
      return NextResponse.json({
        success: true,
        message: 'Collections setup completed successfully'
      });
    } else if (action === 'clear') {
      await clearCollections();
      return NextResponse.json({
        success: true,
        message: 'Collections cleared successfully'
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Invalid action. Use "setup" or "clear"'
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in setup-collections:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to setup collections',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function setupCollections() {
  console.log('Setting up Firestore collections...');
  
  // Create sample questions
  const questions = [
    {
      id: 'q1',
      coachId: 'demo-coach-id',
      text: 'How would you rate your energy level today?',
      type: 'scale',
      options: ['1 - Very Low', '2 - Low', '3 - Moderate', '4 - High', '5 - Very High'],
      required: true,
      category: 'energy',
      weight: 1,
      isActive: true,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'q2',
      coachId: 'demo-coach-id',
      text: 'Did you complete your workout today?',
      type: 'boolean',
      required: true,
      category: 'fitness',
      weight: 1,
      isActive: true,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'q3',
      coachId: 'demo-coach-id',
      text: 'How many hours of sleep did you get last night?',
      type: 'multiple-choice',
      options: ['Less than 6 hours', '6-7 hours', '7-8 hours', '8-9 hours', 'More than 9 hours'],
      required: true,
      category: 'sleep',
      weight: 1,
      isActive: true,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'q4',
      coachId: 'demo-coach-id',
      text: 'Describe your mood today in detail.',
      type: 'text',
      required: false,
      category: 'mental-health',
      weight: 1,
      isActive: true,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  // Create sample forms
  const forms = [
    {
      id: 'form1',
      coachId: 'demo-coach-id',
      title: 'Daily Wellness Check-in',
      description: 'Quick daily assessment of your wellness metrics',
      questions: ['q1', 'q2', 'q3'],
      category: 'daily',
      estimatedTime: 5,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'form2',
      coachId: 'demo-coach-id',
      title: 'Weekly Progress Assessment',
      description: 'Comprehensive weekly review of your progress',
      questions: ['q1', 'q2', 'q3', 'q4'],
      category: 'weekly',
      estimatedTime: 15,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  // Create sample clients
  const clients = [
    {
      id: 'client1',
      coachId: 'demo-coach-id',
      firstName: 'Sarah',
      lastName: 'Johnson',
      email: 'sarah.johnson@example.com',
      phone: '+1234567890',
      status: 'active',
      profile: {
        goals: ['Weight loss', 'Better sleep', 'Stress management'],
        preferences: {
          communication: 'email',
          checkInFrequency: 'daily'
        },
        healthMetrics: {
          startingWeight: 150,
          targetWeight: 140,
          height: 165
        }
      },
      progress: {
        overallScore: 75,
        completedCheckins: 12,
        totalCheckins: 15,
        lastActivity: new Date()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'client2',
      coachId: 'demo-coach-id',
      firstName: 'Mike',
      lastName: 'Chen',
      email: 'mike.chen@example.com',
      phone: '+1234567891',
      status: 'active',
      profile: {
        goals: ['Muscle gain', 'Improved fitness', 'Better nutrition'],
        preferences: {
          communication: 'sms',
          checkInFrequency: 'weekly'
        },
        healthMetrics: {
          startingWeight: 160,
          targetWeight: 170,
          height: 175
        }
      },
      progress: {
        overallScore: 82,
        completedCheckins: 8,
        totalCheckins: 10,
        lastActivity: new Date()
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  // Create sample check-in assignments
  const checkInAssignments = [
    {
      id: 'assignment1',
      formId: 'form1',
      clientId: 'client1',
      coachId: 'demo-coach-id',
      title: 'Daily Wellness Check-in',
      description: 'Complete your daily wellness assessment',
      assignedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      status: 'pending',
      isRecurring: true,
      recurringWeek: 1,
      totalWeeks: 8
    },
    {
      id: 'assignment2',
      formId: 'form2',
      clientId: 'client1',
      coachId: 'demo-coach-id',
      title: 'Weekly Progress Assessment',
      description: 'Complete your weekly progress review',
      assignedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      status: 'pending',
      isRecurring: false
    }
  ];

  // Create sample form responses
  const formResponses = [
    {
      id: 'response1',
      formId: 'form1',
      clientId: 'client1',
      coachId: 'demo-coach-id',
      checkInId: 'assignment1',
      responses: [
        {
          questionId: 'q1',
          answer: '4 - High',
          score: 4
        },
        {
          questionId: 'q2',
          answer: 'Yes',
          score: 5
        },
        {
          questionId: 'q3',
          answer: '7-8 hours',
          score: 4
        }
      ],
      submittedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      totalScore: 13,
      maxScore: 15,
      percentageScore: 87,
      status: 'completed'
    }
  ];

  // Batch write to Firestore
  const batch = db.batch();

  // Add questions
  questions.forEach(question => {
    const docRef = db.collection('questions').doc(question.id);
    batch.set(docRef, question);
  });

  // Add forms
  forms.forEach(form => {
    const docRef = db.collection('forms').doc(form.id);
    batch.set(docRef, form);
  });

  // Add clients
  clients.forEach(client => {
    const docRef = db.collection('clients').doc(client.id);
    batch.set(docRef, client);
  });

  // Add check-in assignments
  checkInAssignments.forEach(assignment => {
    const docRef = db.collection('check_in_assignments').doc(assignment.id);
    batch.set(docRef, assignment);
  });

  // Add form responses
  formResponses.forEach(response => {
    const docRef = db.collection('formResponses').doc(response.id);
    batch.set(docRef, response);
  });

  await batch.commit();
  console.log('Collections setup completed');
}

async function clearCollections() {
  console.log('Clearing Firestore collections...');
  
  const collections = ['questions', 'forms', 'clients', 'check_in_assignments', 'formResponses'];
  
  for (const collectionName of collections) {
    try {
      const snapshot = await db.collection(collectionName).get();
      const batch = db.batch();
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`Cleared ${collectionName} collection`);
    } catch (error) {
      console.error(`Error clearing ${collectionName}:`, error);
    }
  }
  
  console.log('Collections cleared');
}
