import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { status, reason } = await request.json();
    
    if (!status || !['active', 'inactive', 'pending', 'at-risk'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: active, inactive, pending, at-risk' },
        { status: 400 }
      );
    }

    const db = getDb();
    
    // Update the client status
    const clientRef = db.collection('clients').doc(id);
    await clientRef.update({
      status,
      statusUpdatedAt: new Date(),
      statusReason: reason || null
    });

    // Get the updated client data
    const clientDoc = await clientRef.get();
    const clientData = clientDoc.data();

    // Calculate new progress metrics based on check-ins
    const checkInsQuery = db.collection('check_in_assignments')
      .where('clientId', '==', id)
      .where('status', '==', 'completed');
    
    const checkInsSnapshot = await checkInsQuery.get();
    const checkIns = checkInsSnapshot.docs.map(doc => doc.data());
    
    let averageScore = 0;
    let completionRate = 0;
    let lastActivity = null;
    
    if (checkIns.length > 0) {
      const totalScore = checkIns.reduce((sum, checkIn) => sum + (checkIn.score || 0), 0);
      averageScore = Math.round(totalScore / checkIns.length);
      
      // Calculate completion rate based on assigned vs completed check-ins
      const assignedQuery = db.collection('check_in_assignments')
        .where('clientId', '==', id);
      const assignedSnapshot = await assignedQuery.get();
      const totalAssigned = assignedSnapshot.size;
      completionRate = totalAssigned > 0 ? Math.round((checkIns.length / totalAssigned) * 100) : 0;
      
      // Get last activity
      const lastCheckIn = checkIns.sort((a, b) => 
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      )[0];
      lastActivity = lastCheckIn?.submittedAt;
    }

    // Update client with calculated metrics
    await clientRef.update({
      progressScore: averageScore,
      completionRate,
      lastCheckIn: lastActivity,
      totalCheckIns: checkIns.length
    });

    return NextResponse.json({
      success: true,
      client: {
        id: clientDoc.id,
        ...clientData,
        progressScore: averageScore,
        completionRate,
        lastCheckIn: lastActivity,
        totalCheckIns: checkIns.length
      }
    });

  } catch (error) {
    console.error('Error updating client status:', error);
    return NextResponse.json(
      { error: 'Failed to update client status' },
      { status: 500 }
    );
  }
} 