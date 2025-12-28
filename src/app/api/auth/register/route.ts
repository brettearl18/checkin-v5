import { NextRequest, NextResponse } from 'next/server';
import { getDb, getAuthInstance } from '@/lib/firebase-server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';


// Function to generate a short, readable UID
function generateShortUID(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Function to check if a short UID is unique
async function isShortUIDUnique(shortUID: string, db: any): Promise<boolean> {
  const snapshot = await db.collection('coaches')
    .where('shortUID', '==', shortUID)
    .limit(1)
    .get();
  return snapshot.empty;
}

// Function to generate a unique short UID
async function generateUniqueShortUID(db: any): Promise<string> {
  let shortUID: string;
  let attempts = 0;
  const maxAttempts = 10;
  
  do {
    shortUID = generateShortUID();
    attempts++;
    if (attempts > maxAttempts) {
      throw new Error('Unable to generate unique short UID after maximum attempts');
    }
  } while (!(await isShortUIDUnique(shortUID, db)));
  
  return shortUID;
}

// Function to create standard questions for men's health
async function createMensHealthQuestions(coachId: string, db: any) {
  const questions = [
    {
      id: `mens-q-${Date.now()}-1`,
      text: "How would you rate your current energy levels throughout the day?",
      type: "scale",
      options: ["Very Low", "Low", "Moderate", "High", "Very High"],
      category: "Energy & Vitality",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `mens-q-${Date.now()}-2`,
      text: "How many hours of quality sleep do you typically get per night?",
      type: "number",
      category: "Sleep Quality",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `mens-q-${Date.now()}-3`,
      text: "How often do you engage in strength training or resistance exercises?",
      type: "multiple_choice",
      options: ["Never", "1-2 times per week", "3-4 times per week", "5+ times per week"],
      category: "Physical Activity",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `mens-q-${Date.now()}-4`,
      text: "How would you describe your stress levels in the past week?",
      type: "scale",
      options: ["Very Low", "Low", "Moderate", "High", "Very High"],
      category: "Mental Health",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `mens-q-${Date.now()}-5`,
      text: "How satisfied are you with your current nutrition and eating habits?",
      type: "scale",
      options: ["Very Dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very Satisfied"],
      category: "Nutrition",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `mens-q-${Date.now()}-6`,
      text: "How often do you experience muscle soreness or joint discomfort?",
      type: "multiple_choice",
      options: ["Never", "Rarely", "Sometimes", "Often", "Always"],
      category: "Physical Health",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `mens-q-${Date.now()}-7`,
      text: "How would you rate your work-life balance currently?",
      type: "scale",
      options: ["Poor", "Fair", "Good", "Very Good", "Excellent"],
      category: "Lifestyle",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `mens-q-${Date.now()}-8`,
      text: "What is your primary health and fitness goal right now?",
      type: "text",
      category: "Goals",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  // Save questions to Firestore
  for (const question of questions) {
    await db.collection('questions').doc(question.id).set(question);
  }

  return questions;
}

// Function to create standard questions for women's health
async function createWomensHealthQuestions(coachId: string, db: any) {
  const questions = [
    {
      id: `womens-q-${Date.now()}-1`,
      text: "How would you rate your overall energy levels this week?",
      type: "scale",
      options: ["Very Low", "Low", "Moderate", "High", "Very High"],
      category: "Energy & Vitality",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `womens-q-${Date.now()}-2`,
      text: "How many hours of uninterrupted sleep do you typically get?",
      type: "number",
      category: "Sleep Quality",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `womens-q-${Date.now()}-3`,
      text: "How often do you participate in cardiovascular exercise?",
      type: "multiple_choice",
      options: ["Never", "1-2 times per week", "3-4 times per week", "5+ times per week"],
      category: "Physical Activity",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `womens-q-${Date.now()}-4`,
      text: "How would you describe your stress and anxiety levels recently?",
      type: "scale",
      options: ["Very Low", "Low", "Moderate", "High", "Very High"],
      category: "Mental Health",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `womens-q-${Date.now()}-5`,
      text: "How well do you feel you're meeting your nutritional needs?",
      type: "scale",
      options: ["Poorly", "Fairly", "Well", "Very Well", "Excellent"],
      category: "Nutrition",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `womens-q-${Date.now()}-6`,
      text: "How would you rate your hormonal balance and overall wellness?",
      type: "scale",
      options: ["Poor", "Fair", "Good", "Very Good", "Excellent"],
      category: "Hormonal Health",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `womens-q-${Date.now()}-7`,
      text: "How satisfied are you with your current self-care routine?",
      type: "scale",
      options: ["Very Dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very Satisfied"],
      category: "Self-Care",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `womens-q-${Date.now()}-8`,
      text: "What is your main health and wellness priority at the moment?",
      type: "text",
      category: "Goals",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  // Save questions to Firestore
  for (const question of questions) {
    await db.collection('questions').doc(question.id).set(question);
  }

  return questions;
}

// Function to create standard forms for new coaches
async function createStandardForms(coachId: string, coachName: string, db: any) {
  // Create men's health questions
  const mensQuestions = await createMensHealthQuestions(coachId, db);
  
  // Create women's health questions
  const womensQuestions = await createWomensHealthQuestions(coachId, db);

  // Create Men's Health Form
  const mensForm = {
    id: `mens-form-${Date.now()}`,
    title: "Men's Health Assessment",
    description: "Comprehensive health assessment form designed specifically for men's health and wellness goals.",
    category: "Health Assessment",
    questions: mensQuestions.map(q => q.id),
    estimatedTime: 10,
    coachId: coachId,
    isStandard: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Create Women's Health Form
  const womensForm = {
    id: `womens-form-${Date.now()}`,
    title: "Women's Health Assessment",
    description: "Comprehensive health assessment form designed specifically for women's health and wellness goals.",
    category: "Health Assessment",
    questions: womensQuestions.map(q => q.id),
    estimatedTime: 10,
    coachId: coachId,
    isStandard: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Save forms to Firestore
  await db.collection('forms').doc(mensForm.id).set(mensForm);
  await db.collection('forms').doc(womensForm.id).set(womensForm);

  return { mensForm, womensForm };
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const { email, password, firstName, lastName, role, coachId: providedCoachId } = await request.json();

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !role) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: email, password, firstName, lastName, role'
      }, { status: 400 });
    }

    // Validate role
    if (!['admin', 'coach', 'client'].includes(role)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid role. Must be admin, coach, or client'
      }, { status: 400 });
    }

    // If registering as a client, validate coach ID if provided
    let coachId = providedCoachId || null;
    if (role === 'client' && coachId) {
      try {
        const coachDoc = await db.collection('coaches').doc(coachId).get();
        if (!coachDoc.exists) {
          return NextResponse.json({
            success: false,
            message: 'Coach not found with the provided ID'
          }, { status: 404 });
        }
      } catch (error) {
        console.error('Error validating coach:', error);
        return NextResponse.json({
          success: false,
          message: 'Failed to validate coach'
        }, { status: 500 });
      }
    }

    // Check if client already exists
    const existingClientQuery = await db.collection('clients')
      .where('email', '==', email)
      .get();

    if (!existingClientQuery.empty) {
      const existingClient = existingClientQuery.docs[0].data();
      
      if (existingClient.status === 'pending') {
        return NextResponse.json({
          success: false,
          message: 'An invitation has already been sent to this email. Please check your email and complete the onboarding process, or contact your coach for a new invitation.'
        }, { status: 409 });
      }
      
      if (existingClient.status === 'active') {
        return NextResponse.json({
          success: false,
          message: 'An account with this email already exists. Please log in instead.'
        }, { status: 409 });
      }
    }

    // Create Firebase Auth user
    const auth = getAuthInstance();
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`,
      emailVerified: false
    });

    // Create user profile in Firestore
    const userProfile = {
      uid: userRecord.uid,
      email,
      firstName,
      lastName,
      role,
      coachId: role === 'client' ? (coachId || null) : null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to users collection
    await db.collection('users').doc(userRecord.uid).set(userProfile);

    // If registering as a client, create client record
    if (role === 'client') {
      const clientRecord = {
        id: userRecord.uid,
        coachId: coachId || null,
        firstName,
        lastName,
        email,
        phone: '',
        status: 'pending', // Set to pending if no coach assigned
        profile: {
          goals: [],
          preferences: {
            communication: 'email',
            checkInFrequency: 'weekly'
          },
          healthMetrics: {}
        },
        progress: {
          overallScore: 0,
          completedCheckins: 0,
          totalCheckins: 0,
          lastActivity: new Date()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection('clients').doc(userRecord.uid).set(clientRecord);
    }

    // If registering as a coach, create coach record
    if (role === 'coach') {
      const shortUID = await generateUniqueShortUID(db);
      const coachRecord = {
        id: userRecord.uid,
        shortUID,
        firstName,
        lastName,
        email,
        phone: '',
        status: 'active',
        specialization: '',
        bio: '',
        clients: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection('coaches').doc(userRecord.uid).set(coachRecord);

      // Create standard forms for the new coach
      await createStandardForms(userRecord.uid, `${firstName} ${lastName}`, db);

      return NextResponse.json({
        success: true,
        message: 'Coach registered successfully',
        user: {
          uid: userRecord.uid,
          email: userRecord.email,
          role,
          shortUID
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: 'User registered successfully',
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        role
      }
    });

  } catch (error: any) {
    // Log the full error for debugging
    console.error('Error registering user:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      name: error.name
    });
    
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/email-already-exists') {
      return NextResponse.json({
        success: false,
        message: 'An account with this email already exists'
      }, { status: 409 });
    }
    
    if (error.code === 'auth/weak-password') {
      return NextResponse.json({
        success: false,
        message: 'Password is too weak. Please choose a stronger password'
      }, { status: 400 });
    }
    
    if (error.code === 'auth/invalid-email') {
      return NextResponse.json({
        success: false,
        message: 'Invalid email address'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      message: 'Failed to register user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred during registration. Please try again.'
    }, { status: 500 });
  }
}
