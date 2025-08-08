import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const formId = params.id;
    const body = await request.json();
    const { isActive, updatedAt } = body;

    // Validate the form exists
    const db = getDb();
    const formDoc = await db.collection('forms').doc(formId).get();
    if (!formDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'Form not found' },
        { status: 404 }
      );
    }

    // Update the form
    const updateData: any = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (updatedAt) updateData.updatedAt = new Date(updatedAt);

    await db.collection('forms').doc(formId).update(updateData);

    return NextResponse.json({
      success: true,
      message: 'Form updated successfully'
    });
  } catch (error) {
    console.error('Error updating form:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update form' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const formId = params.id;

    // Get the form document
    const db = getDb();
    const formDoc = await db.collection('forms').doc(formId).get();
    
    if (!formDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'Form not found' },
        { status: 404 }
      );
    }

    const formData = formDoc.data();
    const form = {
      id: formDoc.id,
      ...formData,
      createdAt: formData?.createdAt?.toDate?.() || formData?.createdAt,
      updatedAt: formData?.updatedAt?.toDate?.() || formData?.updatedAt
    };

    return NextResponse.json({
      success: true,
      form
    });
  } catch (error) {
    console.error('Error fetching form:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch form' },
      { status: 500 }
    );
  }
} 