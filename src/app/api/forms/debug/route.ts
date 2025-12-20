import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const formsRef = db.collection('forms');
    
    // Get all forms without any filtering
    const formsSnapshot = await formsRef.get();
    
    const forms = formsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
      };
    });

    console.log(`Debug: Found ${forms.length} total forms in database`);
    forms.forEach(form => {
      console.log(`- Form: ${form.title} (ID: ${form.id}, Coach: ${form.coachId})`);
    });
    
    return NextResponse.json({
      success: true,
      totalForms: forms.length,
      forms
    });
    
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { success: false, message: 'Debug failed', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
