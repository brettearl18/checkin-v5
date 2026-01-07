import { NextRequest, NextResponse } from 'next/server';
import { getDb, getAuthInstance } from '@/lib/firebase-server';
import { autoCreateMeasurementSchedule } from '@/lib/auto-allocate-checkin';
import { logSafeError } from '@/lib/logger';
import { validatePassword } from '@/lib/password-validation';

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
    let db;
    try {
      db = getDb();
      // Validate db is properly initialized
      if (!db || typeof db.collection !== 'function') {
        console.error('Database instance is invalid:', typeof db);
        throw new Error('Database instance is not properly initialized');
      }
    } catch (dbError: any) {
      console.error('Error getting database instance:', dbError);
      return NextResponse.json({
        success: false,
        message: 'Database connection failed',
        error: dbError instanceof Error ? dbError.message : 'Unknown error'
      }, { status: 500 });
    }

    const { email, password, firstName, lastName, role, coachCode, coachId: providedCoachId } = await request.json();

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !role) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: email, password, firstName, lastName, role'
      }, { status: 400 });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json({
        success: false,
        message: passwordValidation.message || 'Password does not meet requirements'
      }, { status: 400 });
    }

    // Validate role
    if (!['admin', 'coach', 'client'].includes(role)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid role. Must be admin, coach, or client'
      }, { status: 400 });
    }

    // If registering as a client, coach code is REQUIRED
    let coachId: string | null = null;
    if (role === 'client') {
      // For clients, require coach code (not optional)
      if (!coachCode || coachCode.trim().length === 0) {
        return NextResponse.json({
          success: false,
          message: 'Coach code is required for client registration'
        }, { status: 400 });
      }

      // Look up coach by shortUID (coach code)
      try {
        const coachCodeUpper = coachCode.trim().toUpperCase();
        const coachesSnapshot = await db.collection('coaches')
          .where('shortUID', '==', coachCodeUpper)
          .where('status', '==', 'active') // Only allow active coaches
          .limit(1)
          .get();

        if (coachesSnapshot.empty) {
          return NextResponse.json({
            success: false,
            message: 'Invalid coach code. Please check the code and try again, or contact your coach.'
          }, { status: 404 });
        }

        const coachDoc = coachesSnapshot.docs[0];
        coachId = coachDoc.id;
      } catch (error) {
        console.error('Error validating coach code:', error);
        return NextResponse.json({
          success: false,
          message: 'Failed to validate coach code. Please try again.'
        }, { status: 500 });
      }
    } else if (role !== 'client' && providedCoachId) {
      // For non-client roles, use providedCoachId if given (backward compatibility)
      coachId = providedCoachId;
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
    let existingClientQuery;
    try {
      existingClientQuery = await db.collection('clients')
        .where('email', '==', email)
        .get();
    } catch (error: any) {
      console.error('Error checking existing client:', error);
      return NextResponse.json({
        success: false,
        message: 'Failed to check existing client',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, { status: 500 });
    }

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
    let auth;
    let userRecord;
    try {
      auth = getAuthInstance();
      userRecord = await auth.createUser({
        email,
        password,
        displayName: `${firstName} ${lastName}`,
        emailVerified: false
      });
    } catch (authError: any) {
      logSafeError('Error creating Firebase Auth user', authError);
      // Handle specific Firebase Auth errors
      if (authError.code === 'auth/email-already-exists') {
        return NextResponse.json({
          success: false,
          message: 'An account with this email already exists'
        }, { status: 409 });
      }
      
      if (authError.code === 'auth/weak-password') {
        return NextResponse.json({
          success: false,
          message: 'Password is too weak. Please choose a stronger password'
        }, { status: 400 });
      }
      
      if (authError.code === 'auth/invalid-email') {
        return NextResponse.json({
          success: false,
          message: 'Invalid email address'
        }, { status: 400 });
      }
      
      throw authError; // Re-throw to be caught by outer catch
    }

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
    try {
      await db.collection('users').doc(userRecord.uid).set(userProfile);
    } catch (error: any) {
      logSafeError('Error saving user profile', error);
      // Try to clean up the auth user if profile save fails
      try {
        await auth.deleteUser(userRecord.uid);
      } catch (deleteError) {
        logSafeError('Error cleaning up auth user', deleteError);
      }
      return NextResponse.json({
        success: false,
        message: 'Failed to save user profile',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, { status: 500 });
    }

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
        onboardingStatus: 'not_started', // Initialize onboarding status
        canStartCheckIns: false, // Cannot start check-ins until onboarding is complete
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

      try {
        await db.collection('clients').doc(userRecord.uid).set(clientRecord);
        
        // Auto-create scoring configuration with moderate defaults for new clients
        try {
          const { getDefaultThresholds } = await import('@/lib/scoring-utils');
          const moderateThresholds = getDefaultThresholds('moderate');
          
          await db.collection('clientScoring').doc(userRecord.uid).set({
            clientId: userRecord.uid,
            scoringProfile: 'moderate',
            thresholds: moderateThresholds,
            createdAt: new Date(),
            updatedAt: new Date()
          }, { merge: true });
        } catch (scoringError) {
          console.error('Error creating default scoring config:', scoringError);
          // Don't fail registration if scoring config creation fails
        }
        
        // Note: Check-ins are now allocated manually by coaches after client signs up
        // Auto-create measurement schedule only (check-ins allocated manually)
        if (coachId) {
          try {
            await autoCreateMeasurementSchedule(userRecord.uid, coachId, new Date());
          } catch (allocationError) {
            console.error('Error auto-creating measurement schedule:', allocationError);
            // Don't fail registration if allocation fails - log it and continue
          }
        }

        // Send welcome email to self-registered client
        try {
          const { sendEmail, getSelfRegistrationWelcomeEmailTemplate } = await import('@/lib/email-service');
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://checkinv5.web.app';
          const loginUrl = `${baseUrl}/login`;
          
          // Get coach name if coachId is provided
          let coachName: string | undefined;
          if (coachId) {
            try {
              const coachDoc = await db.collection('coaches').doc(coachId).get();
              if (coachDoc.exists) {
                const coachData = coachDoc.data();
                coachName = coachData ? `${coachData.firstName || ''} ${coachData.lastName || ''}`.trim() : undefined;
              }
            } catch (coachError) {
              console.error('Error fetching coach name for welcome email:', coachError);
              // Continue without coach name
            }
          }

          const { subject, html } = getSelfRegistrationWelcomeEmailTemplate(
            `${firstName} ${lastName}`,
            email,
            loginUrl,
            coachName
          );

          await sendEmail({
            to: email,
            subject,
            html,
            emailType: 'self-registration-welcome',
            metadata: {
              clientId: userRecord.uid,
              clientName: `${firstName} ${lastName}`,
              clientEmail: email,
              coachId: coachId || null,
            },
          });
        } catch (emailError) {
          logSafeError('Error sending welcome email to self-registered client', emailError);
          // Don't fail registration if email fails - log it and continue
        }
      } catch (error: any) {
        console.error('Error saving client record:', error);
        // Try to clean up the auth user and user profile if client record save fails
        try {
          await auth.deleteUser(userRecord.uid);
          await db.collection('users').doc(userRecord.uid).delete();
        } catch (deleteError) {
          console.error('Error cleaning up after client record save failure:', deleteError);
        }
        return NextResponse.json({
          success: false,
          message: 'Failed to save client record',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        }, { status: 500 });
      }
    }

    // If registering as a coach, create coach record
    if (role === 'coach') {
      let shortUID;
      try {
        shortUID = await generateUniqueShortUID(db);
      } catch (error: any) {
        console.error('Error generating short UID:', error);
        // Try to clean up the auth user and user profile
        try {
          await auth.deleteUser(userRecord.uid);
          await db.collection('users').doc(userRecord.uid).delete();
        } catch (deleteError) {
          console.error('Error cleaning up after short UID generation failure:', deleteError);
        }
        return NextResponse.json({
          success: false,
          message: 'Failed to generate coach code',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        }, { status: 500 });
      }

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

      try {
        await db.collection('coaches').doc(userRecord.uid).set(coachRecord);
      } catch (error: any) {
        console.error('Error saving coach record:', error);
        // Try to clean up the auth user and user profile
        try {
          await auth.deleteUser(userRecord.uid);
          await db.collection('users').doc(userRecord.uid).delete();
        } catch (deleteError) {
          console.error('Error cleaning up after coach record save failure:', deleteError);
        }
        return NextResponse.json({
          success: false,
          message: 'Failed to save coach record',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        }, { status: 500 });
      }

      // Create standard forms for the new coach
      try {
        await createStandardForms(userRecord.uid, `${firstName} ${lastName}`, db);
      } catch (error: any) {
        console.error('Error creating standard forms:', error);
        // Don't fail registration if forms creation fails - coach can create them manually
        console.warn('Coach registered but standard forms creation failed. Coach can create forms manually.');
      }

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
