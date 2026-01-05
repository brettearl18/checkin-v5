import { NextRequest, NextResponse } from 'next/server';
import { getDb, getAuthInstance } from '@/lib/firebase-server';
import { logInfo, logError, logSafeError } from '@/lib/logger';
import { requireAdmin } from '@/lib/api-auth';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
/**
 * Sets a user as admin and coach by:
 * 1. Updating their role in Firestore users collection (supports multiple roles)
 * 2. Setting custom claims in Firebase Auth
 * 3. Ensuring coach record exists
 * 
 * Requires: Admin authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { userId, firstName, lastName, email, password } = body;

    if (!userId) {
      return NextResponse.json({
        success: false,
        message: 'User ID is required'
      }, { status: 400 });
    }

    const db = getDb();
    const auth = getAuthInstance();

    // 1. Check if user exists in Firebase Auth, create if not
    let userRecord;
    try {
      userRecord = await auth.getUser(userId);
      logInfo(`✅ User exists in Firebase Auth`);
      
      // Update password if provided for existing user
      if (password) {
        try {
          await auth.updateUser(userId, { password });
          logInfo(`✅ Password updated for user`);
        } catch (updateError: any) {
          logSafeError('Error updating password', updateError);
          // Continue even if password update fails
        }
      }
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        // User doesn't exist in Firebase Auth - create account if email and password provided
        if (!email) {
          return NextResponse.json({
            success: false,
            message: 'User does not exist in Firebase Auth. Please provide email and password to create the account.'
          }, { status: 400 });
        }
        
        if (!password) {
          return NextResponse.json({
            success: false,
            message: 'User does not exist in Firebase Auth. Please provide a password to create the account.'
          }, { status: 400 });
        }

        // Create Firebase Auth account
        try {
          userRecord = await auth.createUser({
            uid: userId, // Use the provided UID
            email: email,
            password: password,
            displayName: `${firstName || 'Silvana'} ${lastName || 'Earl'}`,
            emailVerified: false
          });
          logInfo(`✅ Created Firebase Auth account`);
        } catch (createError: any) {
          logSafeError('Error creating Firebase Auth user', createError);
          return NextResponse.json({
            success: false,
            message: `Failed to create Firebase Auth account: ${createError.message}`
          }, { status: 500 });
        }
      } else {
        throw error;
      }
    }

    // 2. Set custom claims in Firebase Auth (admin takes precedence)
    try {
      await auth.setCustomUserClaims(userId, {
        role: 'admin',
        roles: ['admin', 'coach'] // Support multiple roles
      });
      logInfo(`✅ Set custom claims as admin and coach`);
    } catch (error) {
      logSafeError('Error setting custom claims', error);
      // Continue even if custom claims fail - Firestore role is primary
    }

    // 3. Update or create user profile in Firestore
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    // Use email from userRecord if available, otherwise from request body
    const userEmail = userRecord?.email || email;

    const userData: any = {
      role: 'admin', // Primary role for backward compatibility
      roles: ['admin', 'coach'], // Multiple roles support
      status: 'active',
      updatedAt: new Date()
    };

    // If user exists, merge with existing data
    if (userDoc.exists) {
      const existingData = userDoc.data();
      await userRef.update({
        ...userData,
        // Preserve existing fields
        email: userEmail || existingData.email,
        profile: {
          ...existingData.profile,
          firstName: firstName || existingData.profile?.firstName || 'Silvana',
          lastName: lastName || existingData.profile?.lastName || 'Earl'
        }
      });
    } else {
      // Create new user profile
      await userRef.set({
        uid: userId,
        email: userEmail || '',
        role: 'admin',
        roles: ['admin', 'coach'],
        status: 'active',
        profile: {
          firstName: firstName || 'Silvana',
          lastName: lastName || 'Earl'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // 4. Ensure coach record exists
    try {
      const coachRef = db.collection('coaches').doc(userId);
      const coachDoc = await coachRef.get();
      
      if (coachDoc.exists()) {
        await coachRef.update({
          status: 'active',
          updatedAt: new Date()
        });
      } else {
        // Create coach record
        await coachRef.set({
          id: userId,
          firstName: firstName || 'Silvana',
          lastName: lastName || 'Earl',
          email: userEmail || '',
          status: 'active',
          specialization: 'Health & Wellness Coaching',
          clients: [],
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    } catch (error) {
      logSafeError('Error creating/updating coach record', error);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully set user ${userId} as admin and coach${userRecord && !userRecord.emailVerified ? '. Account created - user should verify email on first login.' : ''}`,
      userId,
      roles: ['admin', 'coach'],
      accountCreated: userRecord && !userRecord.emailVerified,
      email: userEmail
    });

  } catch (error) {
    logSafeError('Error setting admin/coach roles', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to set admin/coach roles',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

