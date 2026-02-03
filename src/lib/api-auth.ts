/**
 * API Route Authentication Utilities
 * Provides functions to verify authentication and authorization for API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb, getAuthInstance } from './firebase-server';
import { logSafeError } from './logger';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  role?: string;
  roles?: string[];
  isAdmin: boolean;
  isCoach: boolean;
  isClient: boolean;
}

/**
 * Extract and verify Firebase Auth token from request headers
 * Returns the decoded token or null if invalid
 */
async function verifyAuthToken(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const auth = getAuthInstance();
    const decodedToken = await auth.verifyIdToken(token);

    // Get user data from Firestore for role information
    const db = getDb();
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();

    // Check roles from custom claims (preferred) or Firestore
    const role = decodedToken.role || userData?.role;
    const roles = decodedToken.roles || userData?.roles || [];
    const isAdmin = role === 'admin' || roles.includes('admin');
    const isCoach = role === 'coach' || roles.includes('coach');
    const isClient = role === 'client' || roles.includes('client');

    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role,
      roles,
      isAdmin,
      isCoach,
      isClient
    };
  } catch (error) {
    logSafeError('Error verifying auth token', error);
    return null;
  }
}

/**
 * Require authentication for an API route
 * Returns the authenticated user or a 401 response
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const user = await verifyAuthToken(request);

  if (!user) {
    return NextResponse.json(
      { success: false, message: 'Authentication required' },
      { status: 401 }
    );
  }

  return { user };
}

/**
 * Require admin role for an API route
 * Returns the authenticated admin user or a 403 response
 */
export async function requireAdmin(
  request: NextRequest
): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const authResult = await requireAuth(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult;

  if (!user.isAdmin) {
    return NextResponse.json(
      { success: false, message: 'Admin access required' },
      { status: 403 }
    );
  }

  return { user };
}

/**
 * Require coach role for an API route
 * Returns the authenticated coach user or a 403 response
 */
export async function requireCoach(
  request: NextRequest
): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const authResult = await requireAuth(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult;

  if (!user.isCoach && !user.isAdmin) {
    return NextResponse.json(
      { success: false, message: 'Coach access required' },
      { status: 403 }
    );
  }

  return { user };
}

/**
 * Require specific role(s) for an API route
 * Returns the authenticated user or a 403 response
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: string[]
): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const authResult = await requireAuth(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult;

  // Admin can access everything
  if (user.isAdmin) {
    return { user };
  }

  // Check if user has one of the allowed roles
  const hasRole = allowedRoles.some(role => 
    user.role === role || 
    (user.roles && user.roles.includes(role))
  );

  if (!hasRole) {
    return NextResponse.json(
      { success: false, message: `Access denied. Required role: ${allowedRoles.join(' or ')}` },
      { status: 403 }
    );
  }

  return { user };
}

/**
 * Verify that a user can access a specific client's data
 * Coaches can only access their own clients, admins can access all
 */
export async function verifyClientAccess(
  request: NextRequest,
  clientId: string
): Promise<{ user: AuthenticatedUser } | NextResponse> {
  const authResult = await requireAuth(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult;

  // Admins can access all clients
  if (user.isAdmin) {
    return { user };
  }

  // Coaches can only access their own clients
  if (user.isCoach) {
    try {
      const db = getDb();
      const clientDoc = await db.collection('clients').doc(clientId).get();
      
      if (!clientDoc.exists) {
        return NextResponse.json(
          { success: false, message: 'Client not found' },
          { status: 404 }
        );
      }

      const clientData = clientDoc.data();
      if (clientData?.coachId !== user.uid) {
        return NextResponse.json(
          { success: false, message: 'Access denied. You can only access your own clients.' },
          { status: 403 }
        );
      }

      return { user };
    } catch (error) {
      logSafeError('Error verifying client access', error);
      return NextResponse.json(
        { success: false, message: 'Error verifying access' },
        { status: 500 }
      );
    }
  }

  // Clients can only access their own data
  if (user.isClient) {
    if (clientId === user.uid) return { user };
    // Client may use document ID - verify the client doc belongs to them
    try {
      const db = getDb();
      const clientDoc = await db.collection('clients').doc(clientId).get();
      if (clientDoc.exists) {
        const clientData = clientDoc.data();
        if (clientData?.authUid === user.uid || clientData?.id === user.uid) {
          return { user };
        }
      }
    } catch {
      // Fall through to deny
    }
    return NextResponse.json(
      { success: false, message: 'Access denied. You can only access your own data.' },
      { status: 403 }
    );
  }

  return NextResponse.json(
    { success: false, message: 'Access denied' },
    { status: 403 }
  );
}

/**
 * Optional authentication - returns user if authenticated, null otherwise
 * Does not return an error response, useful for routes that work with or without auth
 */
export async function optionalAuth(
  request: NextRequest
): Promise<AuthenticatedUser | null> {
  return await verifyAuthToken(request);
}



