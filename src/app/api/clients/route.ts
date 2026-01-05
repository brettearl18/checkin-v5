import { NextRequest, NextResponse } from 'next/server';
import { getDb, getAuthInstance } from '@/lib/firebase-server';
import { autoCreateMeasurementSchedule } from '@/lib/auto-allocate-checkin';
import { logSafeError, logInfo } from '@/lib/logger';
import { validatePassword } from '@/lib/password-validation';
import crypto from 'crypto';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Generate a secure onboarding token
function generateOnboardingToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Send onboarding email using Mailgun
async function sendOnboardingEmail(email: string, onboardingToken: string, coachName: string, clientName?: string, clientId?: string, coachId?: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const onboardingUrl = `${baseUrl}/client-onboarding?token=${onboardingToken}&email=${encodeURIComponent(email)}`;

  try {
    const { sendEmail, getOnboardingEmailTemplate } = await import('@/lib/email-service');
    const { subject, html } = getOnboardingEmailTemplate(
      clientName || 'there',
      onboardingUrl,
      coachName
    );

    await sendEmail({
      to: email,
      subject,
      html,
      emailType: 'onboarding',
      metadata: {
        clientId: clientId || '',
        clientName: clientName || 'there',
        coachId: coachId || '',
      },
    });

    return true;
  } catch (error) {
    logSafeError('Error sending onboarding email', error);
    // Don't fail the client creation if email fails
    return false;
  }
}

export async function GET(request: NextRequest) {
  const db = getDb();
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');

    let query = db.collection('clients');

    // If coachId is provided, filter by coachId
    if (coachId) {
      query = query.where('coachId', '==', coachId);
    }

    const snapshot = await query.get();
    const now = new Date();
    
    const clients = snapshot.docs.map(doc => {
      const data = doc.data();
      
      // Check if pausedUntil date has passed - auto-reactivate if so
      if (data.status === 'paused' && data.pausedUntil) {
        const pausedUntilDate = data.pausedUntil?.toDate ? data.pausedUntil.toDate() : new Date(data.pausedUntil);
        
        // If pausedUntil date has passed, automatically reactivate
        if (pausedUntilDate <= now) {
          // Update the client in the background
          db.collection('clients').doc(doc.id).update({
            status: 'active',
            pausedUntil: null
          }).catch(err => console.error('Error auto-reactivating client:', err));
          
          return {
            id: doc.id,
            ...data,
            status: 'active',
            pausedUntil: null
          };
        }
      }
      
      return {
        id: doc.id,
        ...data
      };
    });

    return NextResponse.json({
      success: true,
      clients
    });

  } catch (error: any) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const auth = getAuthInstance();
  try {
    const clientData = await request.json();
    const { 
      firstName, 
      lastName, 
      email, 
      phone, 
      username,
      password,
      goals,
      communicationPreference,
      checkInFrequency, 
      coachId 
    } = clientData;

    // Validate required fields
    if (!firstName || !lastName || !email || !coachId) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: firstName, lastName, email, coachId'
      }, { status: 400 });
    }

    // Validate password if provided
    if (password) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        return NextResponse.json({
          success: false,
          message: passwordValidation.message || 'Password does not meet requirements'
        }, { status: 400 });
      }
    }

    // Check if client already exists by email
    const existingClientQuery = await db.collection('clients')
      .where('email', '==', email)
      .get();

    if (!existingClientQuery.empty) {
      return NextResponse.json({
        success: false,
        message: 'A client with this email already exists'
      }, { status: 409 });
    }

    // Check if Firebase Auth user already exists
    let authUid: string | null = null;
    let userCredentials: { email: string; username: string; password: string } | null = null;

    try {
      const existingUser = await auth.getUserByEmail(email);
      return NextResponse.json({
        success: false,
        message: 'A user with this email already exists in the system'
      }, { status: 409 });
    } catch (error: any) {
      // User doesn't exist, which is what we want
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Get coach information
    const coachDoc = await db.collection('coaches').doc(coachId).get();
    const coachData = coachDoc.exists ? coachDoc.data() : null;
    const coachName = coachData ? `${coachData.firstName} ${coachData.lastName}` : 'Your Coach';

    // If password is provided, create Firebase Auth account immediately
    if (password) {
      try {
        // Use email as username if username not provided
        const displayName = `${firstName} ${lastName}`;
        
        // Create Firebase Auth user
        const userRecord = await auth.createUser({
          email: email,
          password: password,
          displayName: displayName,
          emailVerified: false // Client should verify email on first login
        });

        authUid = userRecord.uid;

        // Set custom claims for client role
        await auth.setCustomUserClaims(userRecord.uid, {
          role: 'client',
          coachId: coachId
        });

        // Create user profile in users collection
        await db.collection('users').doc(userRecord.uid).set({
          uid: userRecord.uid,
          email: email,
          role: 'client',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
          profile: {
            firstName: firstName,
            lastName: lastName,
          },
          metadata: {
            lastLogin: null,
            loginCount: 0,
            invitedBy: coachId,
          }
        }, { merge: true });

        // Store credentials for response (username is optional, email is used for login)
        userCredentials = {
          email: email,
          username: username || email, // Use email if username not provided
          password: password
        };

      } catch (authError: any) {
        logSafeError('Error creating Firebase Auth user', authError);
        return NextResponse.json({
          success: false,
          message: `Failed to create user account: ${authError.message}`
        }, { status: 500 });
      }
    }

    // Create client record
    const clientId = authUid || `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const client = {
      id: clientId,
      firstName,
      lastName,
      email,
      phone: phone || '',
      wellnessGoals: goals || [],
      preferredCommunication: communicationPreference || 'email',
      checkInFrequency: checkInFrequency || 'weekly',
      coachId,
      status: authUid ? 'active' : 'pending', // Active if account created, pending if not
      authUid: authUid || null,
      progressScore: 0,
      totalCheckIns: 0,
      lastCheckIn: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to Firestore
    await db.collection('clients').doc(clientId).set(client);

    // Auto-create scoring configuration with moderate defaults for new clients
    try {
      const { getDefaultThresholds } = await import('@/lib/scoring-utils');
      const moderateThresholds = getDefaultThresholds('moderate');
      
      await db.collection('clientScoring').doc(clientId).set({
        clientId,
        scoringProfile: 'moderate',
        thresholds: moderateThresholds,
        createdAt: new Date(),
        updatedAt: new Date()
      }, { merge: true });
    } catch (scoringError) {
      logSafeError('Error creating default scoring config', scoringError);
      // Don't fail client creation if scoring config creation fails
    }

    // Note: Check-ins are now allocated manually by coaches after client signs up
    // Auto-create measurement schedule only (check-ins allocated manually)
    try {
      if (coachId) {
        // Only create measurement schedule if coach is assigned
        await autoCreateMeasurementSchedule(clientId, coachId, new Date());
      }
      } catch (allocationError) {
        logSafeError('Error auto-creating measurement schedule', allocationError);
        // Don't fail client creation if allocation fails - log it and continue
      }

    // If credentials were created, send credentials email and return them (for popup display)
    // Otherwise, send onboarding email with token
    if (userCredentials) {
      // Send credentials email
      try {
        const { sendEmail, getCredentialsEmailTemplate } = await import('@/lib/email-service');
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const loginUrl = `${baseUrl}/login`;
        const { subject, html } = getCredentialsEmailTemplate(
          `${firstName} ${lastName}`,
          email,
          userCredentials.password,
          loginUrl,
          coachName
        );

        await sendEmail({
          to: email,
          subject,
          html,
          emailType: 'credentials',
          metadata: {
            clientId: clientId,
            clientName: `${firstName} ${lastName}`,
            coachId: coachId,
          },
        });
      } catch (emailError) {
        logSafeError('Error sending credentials email', emailError);
        // Don't fail the client creation if email fails
      }

      // Send notification to admin/coach about new client signup
      try {
        const { sendEmail } = await import('@/lib/email-service');
        const { getClientSignupNotificationTemplate } = await import('@/lib/email-templates');
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://checkinv5.web.app';
        const { subject, html } = getClientSignupNotificationTemplate(
          `${firstName} ${lastName}`,
          email,
          clientId,
          coachName
        );

        // Send to admin/coach notification emails
        const notificationEmails = ['silvi@vanahealth.com.au', 'brett.earl@gmail.com'];
        await sendEmail({
          to: notificationEmails,
          subject,
          html,
          emailType: 'admin-notification',
          metadata: {
            notificationType: 'client-signup',
            clientId: clientId,
            clientName: `${firstName} ${lastName}`,
            clientEmail: email,
            coachId: coachId,
          },
        });
      } catch (notificationError) {
        logSafeError('Error sending client signup notification', notificationError);
        // Don't fail the client creation if notification fails
      }

      return NextResponse.json({
        success: true,
        message: 'Client created successfully with login credentials. Email sent.',
        clientId: clientId,
        client: client,
        credentials: userCredentials
      });
    } else {
      // Fallback to old onboarding flow if no password provided
      const onboardingToken = generateOnboardingToken();
      const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      await db.collection('clients').doc(clientId).update({
        onboardingToken,
        tokenExpiry
      });

      await sendOnboardingEmail(email, onboardingToken, coachName, `${firstName} ${lastName}`, clientId, coachId);

      // Send notification to admin/coach about new client signup
      try {
        const { sendEmail } = await import('@/lib/email-service');
        const { getClientSignupNotificationTemplate } = await import('@/lib/email-templates');
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://checkinv5.web.app';
        const { subject, html } = getClientSignupNotificationTemplate(
          `${firstName} ${lastName}`,
          email,
          clientId,
          coachName
        );

        // Send to admin/coach notification emails
        const notificationEmails = ['silvi@vanahealth.com.au', 'brett.earl@gmail.com'];
        await sendEmail({
          to: notificationEmails,
          subject,
          html,
          emailType: 'admin-notification',
          metadata: {
            notificationType: 'client-signup',
            clientId: clientId,
            clientName: `${firstName} ${lastName}`,
            clientEmail: email,
            coachId: coachId,
          },
        });
      } catch (notificationError) {
        logSafeError('Error sending client signup notification', notificationError);
        // Don't fail the client creation if notification fails
      }

      return NextResponse.json({
        success: true,
        message: 'Client created successfully. Onboarding email sent.',
        clientId: clientId,
        client: { ...client, onboardingToken }
      });
    }

  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create client', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
