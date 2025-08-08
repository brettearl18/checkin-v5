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
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserProfile({
          uid,
          email: data.email,
          role: data.role,
          firstName: data.profile?.firstName || '',
          lastName: data.profile?.lastName || '',
          phone: data.profile?.phone,
          avatar: data.profile?.avatar,
          status: data.status,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          metadata: data.metadata ? {
            lastLogin: data.metadata.lastLogin?.toDate() || new Date(),
            loginCount: data.metadata.loginCount || 0,
            invitedBy: data.metadata.invitedBy
          } : undefined
        });
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
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

  // Computed properties for role checking
  const isAdmin = userProfile?.role === 'admin';
  const isCoach = userProfile?.role === 'coach';
  const isClient = userProfile?.role === 'client';

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