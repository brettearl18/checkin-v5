import { NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
export const dynamic = 'force-dynamic';

const sampleUsers = [
  {
    email: 'admin@checkinv5.com',
    password: 'admin123',
    role: 'admin',
    name: 'System Administrator',
    isActive: true
  },
  {
    email: 'coach@checkinv5.com',
    password: 'coach123',
    role: 'coach',
    name: 'Sarah Johnson',
    isActive: true
  },
  {
    email: 'client@checkinv5.com',
    password: 'client123',
    role: 'client',
    name: 'John Smith',
    coachId: 'coach-001', // Will be updated with actual coach ID
    isActive: true
  }
];

export async function POST() {
  const db = getDb();
  try {
    const createdUsers = [];

    for (const userData of sampleUsers) {
      // Note: In a real application, you would use Firebase Auth to create users
      // For now, we'll just create the user profiles in Firestore
      const userProfile: any = {
        email: userData.email,
        role: userData.role,
        name: userData.name,
        isActive: userData.isActive,
        createdAt: new Date(),
        lastLogin: new Date()
      };

      // Only add coachId if it exists
      if (userData.coachId) {
        userProfile.coachId = userData.coachId;
      }

      // Only add clientIds for coaches
      if (userData.role === 'coach') {
        userProfile.clientIds = [];
      }

      // Add to users collection
      const userRef = await db.collection('users').add(userProfile);
      
      createdUsers.push({
        id: userRef.id,
        ...userProfile,
        password: userData.password // Include password for testing
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Sample users created successfully',
      users: createdUsers
    });
  } catch (error) {
    console.error('Error creating sample users:', error);
    return NextResponse.json({
      success: false,
      message: 'Error creating sample users',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
