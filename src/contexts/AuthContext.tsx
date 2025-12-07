'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase-client';

interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'coach' | 'client';
  roles?: ('admin' | 'coach' | 'client')[]; // Support multiple roles
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  status: 'active' | 'pending' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    lastLogin: Date;
    loginCount: number;
    invitedBy?: string;
  };
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, userData: Partial<UserProfile>) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  isAdmin: boolean;
  isCoach: boolean;
  isClient: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile from Firestore
  const fetchUserProfile = async (uid: string) => {
    try {
      // First try to get from users collection (for coaches and admins)
      let userDoc = await getDoc(doc(db, 'users', uid));
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        // Prioritize admin role if present, otherwise use data.role or first role in roles array
        const determinePrimaryRole = () => {
          if (data.role === 'admin' || (data.roles && data.roles.includes('admin'))) {
            return 'admin';
          }
          return data.role || (data.roles && data.roles[0]) || 'client';
        };
        setUserProfile({
          uid,
          email: data.email,
          role: determinePrimaryRole(), // Primary role (prioritize admin)
          roles: data.roles || [data.role || 'client'], // Support multiple roles
          firstName: data.profile?.firstName || data.firstName || '',
          lastName: data.profile?.lastName || data.lastName || '',
          phone: data.profile?.phone || data.phone,
          avatar: data.profile?.avatar || data.avatar,
          status: data.status || 'active',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          metadata: data.metadata ? {
            lastLogin: data.metadata.lastLogin?.toDate() || new Date(),
            loginCount: data.metadata.loginCount || 0,
            invitedBy: data.metadata.invitedBy
          } : undefined
        });
        return;
      }

      // If not found in users, try clients collection
      const clientsQuery = await db.collection('clients').where('authUid', '==', uid).limit(1).get();
      
      if (!clientsQuery.empty) {
        const clientDoc = clientsQuery.docs[0];
        const clientData = clientDoc.data();
        
        setUserProfile({
          uid,
          email: clientData.email,
          role: 'client',
          firstName: clientData.firstName,
          lastName: clientData.lastName,
          phone: clientData.phone,
          avatar: undefined,
          status: clientData.status,
          createdAt: clientData.createdAt?.toDate() || new Date(),
          updatedAt: clientData.updatedAt?.toDate() || new Date(),
          metadata: {
            lastLogin: new Date(),
            loginCount: 1,
            coachId: clientData.coachId
          }
        });
        return;
      }

      // If not found in either collection, set profile to null
      setUserProfile(null);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUserProfile(null);
    }
  };

  // Update user profile in Firestore
  const updateUserProfileInFirestore = async (uid: string, data: Partial<UserProfile>) => {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, {
        ...data,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      // Refresh user profile
      await fetchUserProfile(uid);
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  };

  // Login function
  const login = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Update last login
      await updateUserProfileInFirestore(user.uid, {
        metadata: {
          lastLogin: new Date(),
          loginCount: (userProfile?.metadata?.loginCount || 0) + 1
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  // Register function
  const register = async (email: string, password: string, userData: Partial<UserProfile>) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create user profile in Firestore
      const profileData: any = {
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
      };

      // Only add optional fields if they have values
      if (userData.phone) profileData.phone = userData.phone;
      if (userData.avatar) profileData.avatar = userData.avatar;

      const userProfileData = {
        uid: user.uid,
        email: user.email,
        role: userData.role || 'client',
        profile: profileData,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        metadata: {
          lastLogin: new Date(),
          loginCount: 1,
          ...(userData.metadata?.invitedBy && { invitedBy: userData.metadata.invitedBy })
        }
      };

      await setDoc(doc(db, 'users', user.uid), userProfileData);

      // Update display name in Firebase Auth
      if (userData.firstName && userData.lastName) {
        await updateProfile(user, {
          displayName: `${userData.firstName} ${userData.lastName}`
        });
      }
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await signOut(auth);
      setUserProfile(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  // Reset password function
  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  };

  // Update user profile function
  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user) throw new Error('No user logged in');
    
    try {
      await updateUserProfileInFirestore(user.uid, data);
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        await fetchUserProfile(user.uid);
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Computed properties for role checking (support multiple roles)
  const isAdmin = userProfile?.role === 'admin' || userProfile?.roles?.includes('admin') || false;
  const isCoach = userProfile?.role === 'coach' || userProfile?.roles?.includes('coach') || false;
  const isClient = userProfile?.role === 'client' || userProfile?.roles?.includes('client') || false;

  const value = {
    user,
    userProfile,
    loading,
    login,
    register,
    logout,
    resetPassword,
    updateUserProfile,
    isAdmin,
    isCoach,
    isClient
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 