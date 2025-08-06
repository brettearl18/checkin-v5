import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const formData = await request.json();

    // Generate a unique client ID
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Calculate BMI if height and weight are provided
    let bmi = null;
    if (formData.height && formData.weight) {
      const heightInMeters = parseFloat(formData.height) / 100;
      const weightInKg = parseFloat(formData.weight);
      bmi = weightInKg / (heightInMeters * heightInMeters);
    }

    // Helper function to remove undefined values
    const removeUndefined = (obj: any) => {
      const cleaned = {};
      Object.keys(obj).forEach(key => {
        if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
          cleaned[key] = obj[key];
        }
      });
      return cleaned;
    };

    // Create the client profile from form data
    const clientProfile = removeUndefined({
      id: clientId,
      
      // Personal Information
      name: `${formData.firstName} ${formData.lastName}`,
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      dateOfBirth: formData.dateOfBirth,
      gender: formData.gender,
      
      // Contact & Address
      address: formData.address,
      city: formData.city,
      state: formData.state,
      zipCode: formData.zipCode,
      emergencyContact: formData.emergencyContact,
      emergencyPhone: formData.emergencyPhone,
      
      // Health Information
      height: formData.height ? parseFloat(formData.height) : null,
      weight: formData.weight ? parseFloat(formData.weight) : null,
      bmi: bmi,
      
      // Goals
      primaryGoal: formData.primaryGoal,
      secondaryGoals: formData.secondaryGoals,
      
      // Health Details
      medicalConditions: formData.medicalConditions,
      medications: formData.medications,
      allergies: formData.allergies,
      injuries: formData.injuries,
      
      // Lifestyle
      lifestyle: removeUndefined({
        activityLevel: formData.activityLevel,
        sleepHours: formData.sleepHours,
        stressLevel: formData.stressLevel,
        dietaryRestrictions: formData.dietaryRestrictions,
        preferredContactMethod: formData.preferredContactMethod,
        timeZone: formData.timeZone
      }),
      
      // Coaching Preferences
      coaching: removeUndefined({
        style: formData.coachingStyle,
        sessionFrequency: formData.sessionFrequency,
        sessionDuration: formData.sessionDuration,
        preferredTime: formData.preferredTime,
        startDate: new Date().toISOString().split('T')[0],
        status: 'pending'
      }),
      
      // Notes
      notes: formData.notes ? [{
        id: `note-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        content: formData.notes,
        type: 'initial-assessment'
      }] : [],
      
      // Timestamps
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active'
    });

    // Add to Firestore
    await db.collection('clients').doc(clientId).set(clientProfile);

    return NextResponse.json({
      success: true,
      message: 'Client created successfully!',
      clientId: clientId,
      client: clientProfile
    });

  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create client',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const db = getDb();
    
    // Get all clients
    const clientsSnapshot = await db.collection('clients').get();
    const clients = clientsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      success: true,
      clients: clients
    });

  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch clients',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 