import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase-client';

// User roles
export type UserRole = 'admin' | 'coach' | 'client';

// User interface
export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  coachId?: string; // For clients, this is their assigned coach
  clientIds?: string[]; // For coaches, these are their assigned clients
  isActive: boolean;
  createdAt: Date;
  lastLogin: Date;
}

// Authentication context type
export interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, role: UserRole, name: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<AppUser>) => Promise<void>;
}

// Role-based route protection
export const routePermissions = {
  // Admin routes - only admins can access
  admin: [
    '/admin',
    '/admin/users',
    '/admin/coaches',
    '/admin/clients',
    '/admin/analytics',
    '/admin/settings'
  ],
  
  // Coach routes - coaches and admins can access
  coach: [
    '/dashboard',
    '/clients',
    '/clients/new',
    '/client/[id]',
    '/client/[id]/edit',
    '/questions',
    '/questions/create',
    '/forms',
    '/forms/create',
    '/forms/[id]',
    '/check-ins',
    '/responses',
    '/analytics',
    '/settings'
  ],
  
  // Client routes - clients, their coaches, and admins can access
  client: [
    '/client-portal',
    '/client-portal/check-ins',
    '/client-portal/profile',
    '/client-portal/progress'
  ]
};

// Check if user has permission to access a route
export function hasRoutePermission(user: AppUser | null, pathname: string): boolean {
  if (!user) return false;
  
  // Admins can access everything
  if (user.role === 'admin') return true;
  
  // Check role-specific permissions
  if (user.role === 'coach') {
    return routePermissions.coach.some(route => 
      pathname.startsWith(route.replace('[id]', ''))
    );
  }
  
  if (user.role === 'client') {
    return routePermissions.client.some(route => 
      pathname.startsWith(route)
    );
  }
  
  return false;
}

// Check if user can access specific client data
export function canAccessClient(user: AppUser | null, clientId: string): boolean {
  if (!user) return false;
  
  // Admins can access all clients
  if (user.role === 'admin') return true;
  
  // Coaches can access their assigned clients
  if (user.role === 'coach') {
    return user.clientIds?.includes(clientId) || false;
  }
  
  // Clients can only access their own data
  if (user.role === 'client') {
    return user.uid === clientId;
  }
  
  return false;
}

// Authentication functions
export async function signInUser(email: string, password: string): Promise<AppUser> {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
  
  if (!userDoc.exists()) {
    throw new Error('User profile not found');
  }
  
  const userData = userDoc.data() as AppUser;
  
  // Update last login
  await setDoc(doc(db, 'users', userCredential.user.uid), {
    lastLogin: serverTimestamp()
  }, { merge: true });
  
  return {
    ...userData,
    lastLogin: new Date()
  };
}

export async function signUpUser(
  email: string, 
  password: string, 
  role: UserRole, 
  name: string,
  coachId?: string
): Promise<AppUser> {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  
  const newUser: AppUser = {
    uid: userCredential.user.uid,
    email,
    role,
    name,
    coachId,
    clientIds: role === 'coach' ? [] : undefined,
    isActive: true,
    createdAt: new Date(),
    lastLogin: new Date()
  };
  
  await setDoc(doc(db, 'users', userCredential.user.uid), {
    ...newUser,
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp()
  });
  
  return newUser;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export async function updateUserProfile(uid: string, updates: Partial<AppUser>): Promise<void> {
  await setDoc(doc(db, 'users', uid), {
    ...updates,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

// Get user profile from Firebase
export async function getUserProfile(uid: string): Promise<AppUser | null> {
  const userDoc = await getDoc(doc(db, 'users', uid));
  
  if (!userDoc.exists()) {
    return null;
  }
  
  const data = userDoc.data();
  return {
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    lastLogin: data.lastLogin?.toDate() || new Date()
  } as AppUser;
} 