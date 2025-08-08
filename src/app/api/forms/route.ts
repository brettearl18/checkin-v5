import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');

    if (!coachId) {
      return NextResponse.json({ success: false, message: 'coachId is required' }, { status: 400 });
    }

    const db = getDb();
    const formsRef = db.collection('forms');
    
    // Try with index first, fallback to simple query if index doesn't exist
    let formsSnapshot;
    try {
      formsSnapshot = await formsRef
        .where('coachId', '==', coachId)
        .orderBy('createdAt', 'desc')
        .get();
    } catch (indexError: any) {
      console.log('Index error, falling back to simple query:', indexError.message);
      // Fallback: get all forms without ordering and filter client-side
      formsSnapshot = await formsRef.where('coachId', '==', coachId).get();
    }

    const forms = formsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
      };
    });

    // If we used fallback, filter by coachId client-side
    if (forms.length > 0 && forms.some(form => form.coachId !== coachId)) {
      const filteredForms = forms.filter(form => form.coachId === coachId);
      console.log(`Filtered ${forms.length} forms to ${filteredForms.length} for coachId: ${coachId}`);
      return NextResponse.json({ success: true, forms: filteredForms });
    }

    console.log(`Found ${forms.length} forms for coachId: ${coachId}`);
    return NextResponse.json({ success: true, forms });

  } catch (error) {
    console.error('Error fetching forms:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch forms', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.json();
    
    // Validate required fields
    if (!formData.title || !formData.coachId) {
      return NextResponse.json(
        { success: false, message: 'Title and coachId are required' },
        { status: 400 }
      );
    }

    const db = getDb();
    
    // Create form object
    const form = {
      ...formData,
      isActive: formData.isActive || false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Save to Firestore
    const docRef = await db.collection('forms').add(form);
    
    console.log('Form created successfully:', docRef.id);
    
    return NextResponse.json({
      success: true,
      message: 'Form created successfully',
      formId: docRef.id,
      form: { ...form, id: docRef.id }
    });
    
  } catch (error) {
    console.error('Error creating form:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create form', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 