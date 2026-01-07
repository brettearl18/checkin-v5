import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { requireCoach } from '@/lib/api-auth';

// PUT - Update a notice
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireCoach(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const { id } = await params;
    const body = await request.json();
    const { title, content, imageUrl, linkUrl, linkText } = body;

    const db = getDb();
    const coachId = user.uid;

    // Verify the notice belongs to this coach
    const noticeDoc = await db.collection('notices').doc(id).get();
    if (!noticeDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Notice not found'
      }, { status: 404 });
    }

    const noticeData = noticeDoc.data();
    if (noticeData?.coachId !== coachId) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized to update this notice'
      }, { status: 403 });
    }

    // Update the notice
    await db.collection('notices').doc(id).update({
      title: title || noticeData.title,
      content: content || noticeData.content,
      imageUrl: imageUrl !== undefined ? imageUrl : noticeData.imageUrl,
      linkUrl: linkUrl !== undefined ? linkUrl : noticeData.linkUrl,
      linkText: linkText !== undefined ? linkText : noticeData.linkText,
      updatedAt: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'Notice updated successfully'
    });

  } catch (error) {
    console.error('Error updating notice:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to update notice',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE - Delete a notice
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireCoach(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const { id } = await params;
    const db = getDb();
    const coachId = user.uid;

    // Verify the notice belongs to this coach
    const noticeDoc = await db.collection('notices').doc(id).get();
    if (!noticeDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Notice not found'
      }, { status: 404 });
    }

    const noticeData = noticeDoc.data();
    if (noticeData?.coachId !== coachId) {
      return NextResponse.json({
        success: false,
        message: 'Unauthorized to delete this notice'
      }, { status: 403 });
    }

    // Delete the notice
    await db.collection('notices').doc(id).delete();

    return NextResponse.json({
      success: true,
      message: 'Notice deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting notice:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to delete notice',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

