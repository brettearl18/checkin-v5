import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function POST() {
  try {
    const db = getDb();
    
    // Create a detailed client profile
    const clientProfile = {
      id: 'client-mockup-001',
      name: 'Sarah Johnson',
      email: 'sarah.johnson@email.com',
      phone: '+1 (555) 123-4567',
      dateOfBirth: '1985-03-15',
      gender: 'female',
      height: 165, // cm
      weight: 68, // kg
      targetWeight: 62, // kg
      bmi: 25.0,
      targetBMI: 22.8,
      
      // Health Goals
      goals: [
        {
          id: 'goal-001',
          title: 'Lose 6kg in 3 months',
          description: 'Gradual weight loss through diet and exercise',
          targetDate: '2024-06-15',
          progress: 0.4, // 40% complete
          status: 'active'
        },
        {
          id: 'goal-002',
          title: 'Improve cardiovascular fitness',
          description: 'Build endurance through regular cardio workouts',
          targetDate: '2024-07-01',
          progress: 0.6, // 60% complete
          status: 'active'
        },
        {
          id: 'goal-003',
          title: 'Reduce stress levels',
          description: 'Implement daily meditation and stress management',
          targetDate: '2024-05-30',
          progress: 0.8, // 80% complete
          status: 'active'
        }
      ],
      
      // Health Metrics
      healthMetrics: {
        bloodPressure: '120/80',
        restingHeartRate: 72,
        cholesterol: {
          total: 180,
          hdl: 55,
          ldl: 100,
          triglycerides: 120
        },
        bloodSugar: 95,
        bodyFatPercentage: 28,
        muscleMass: 45
      },
      
      // Lifestyle Information
      lifestyle: {
        activityLevel: 'moderate',
        exerciseFrequency: '3-4 times per week',
        sleepHours: 7,
        stressLevel: 'moderate',
        smoking: false,
        alcoholConsumption: 'occasional',
        dietaryRestrictions: ['gluten-free'],
        allergies: ['peanuts'],
        medications: ['Vitamin D', 'Omega-3']
      },
      
      // Coaching Details
      coaching: {
        startDate: '2024-01-15',
        coachId: 'coach-001',
        coachName: 'Dr. Michael Chen',
        sessionFrequency: 'weekly',
        nextSession: '2024-04-20',
        totalSessions: 12,
        completedSessions: 8,
        programType: 'weight-loss-and-fitness',
        status: 'active'
      },
      
      // Progress Tracking
      progress: {
        weightHistory: [
          { date: '2024-01-15', weight: 74 },
          { date: '2024-02-15', weight: 72 },
          { date: '2024-03-15', weight: 70 },
          { date: '2024-04-15', weight: 68 }
        ],
        measurements: {
          chest: 95,
          waist: 78,
          hips: 98,
          arms: 28,
          thighs: 58
        },
        fitnessScores: {
          cardio: 7.5,
          strength: 6.8,
          flexibility: 8.2,
          balance: 7.0
        }
      },
      
      // Risk Assessment
      riskFactors: {
        familyHistory: ['diabetes', 'heart disease'],
        currentRisks: ['sedentary lifestyle', 'stress'],
        riskScore: 0.3, // Low risk
        lastAssessment: '2024-04-01'
      },
      
      // Notes and Observations
      notes: [
        {
          id: 'note-001',
          date: '2024-04-15',
          coachId: 'coach-001',
          content: 'Sarah is making excellent progress with her weight loss goals. She has been consistent with her meal planning and exercise routine. Her stress levels have improved significantly since starting meditation.',
          type: 'progress'
        },
        {
          id: 'note-002',
          date: '2024-04-10',
          coachId: 'coach-001',
          content: 'Discussed increasing cardio intensity to 4-5 times per week. Sarah is ready for this progression and has shown good recovery between sessions.',
          type: 'planning'
        }
      ],
      
      // Engagement Metrics
      engagement: {
        checkInRate: 0.95, // 95% of expected check-ins
        lastCheckIn: '2024-04-15',
        responseTime: 2.3, // hours average
        satisfactionScore: 9.2,
        motivationLevel: 'high'
      },
      
      // Timestamps
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active'
    };

    // Add to Firestore
    await db.collection('clients').doc(clientProfile.id).set(clientProfile);

    return NextResponse.json({
      success: true,
      message: 'Client profile created successfully!',
      clientId: clientProfile.id,
      client: clientProfile
    });

  } catch (error) {
    console.error('Error creating client profile:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create client profile',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 