import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { getTrafficLightStatus, getDefaultThresholds } from '@/lib/scoring-utils';

// Enable ISR caching for 30 seconds (allows stale-while-revalidate)
export const revalidate = 30;

/** Current week's check-in status for coach visibility */
export type CurrentWeekCheckInStatus = 'completed' | 'due' | 'overdue' | 'none';

interface ClientInventoryMetrics {
  progressScore: number;
  totalCheckIns: number;
  completedCheckIns: number;
  overdueCheckIns: number;
  completionRate: number;
  weeksOnProgram: number;
  lastCheckInDate?: string;
  lastCheckInScore?: number;
  lastCheckInTrafficLight?: 'red' | 'orange' | 'green';
  recentCheckIns: Array<{
    score: number;
    trafficLight: 'red' | 'orange' | 'green';
    completedAt: string;
  }>;
  daysSinceLastCheckIn?: number;
  averageScore: number;
  /** Status of this week's check-in (so coaches can see who has done/due/overdue for current week) */
  currentWeekCheckInStatus?: CurrentWeekCheckInStatus;
}

interface ClientInventoryItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  status: 'active' | 'inactive' | 'pending' | 'paused' | 'completed' | 'archived';
  createdAt: string;
  joinDate?: string;
  metrics: ClientInventoryMetrics;
}

/**
 * Get Monday 00:00 of the week containing the given date (week start).
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setDate(d.getDate() - daysToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Normalize a date to YYYY-MM-DD for comparison.
 */
function toDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Determine current week's check-in status for a client from their assignments.
 * "Current week" = the week containing today (Monday start). We look for an assignment
 * whose due date falls on this week's Monday; if found and completed -> 'completed',
 * else if past due -> 'overdue', else -> 'due'. If no assignment for this week -> 'none'.
 */
function getCurrentWeekCheckInStatus(assignments: any[], now: Date): CurrentWeekCheckInStatus {
  const thisWeekMonday = getWeekStart(now);
  const thisWeekMondayStr = toDateString(thisWeekMonday);

  for (const a of assignments) {
    if (!a.dueDate) continue;
    const due = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
    const dueStr = toDateString(due);
    if (dueStr !== thisWeekMondayStr) continue;

    const isCompleted = a.status === 'completed' || a.responseId || a.completedAt;
    if (isCompleted) return 'completed';
    if (due < now) return 'overdue';
    return 'due';
  }
  return 'none';
}

/**
 * Calculate weeks on program
 */
function calculateWeeksOnProgram(createdAt: any, joinDate?: any): number {
  try {
    let startDate: Date;
    const dateToUse = joinDate || createdAt;
    
    if (typeof dateToUse === 'string') {
      startDate = new Date(dateToUse);
    } else if (dateToUse?.toDate && typeof dateToUse.toDate === 'function') {
      startDate = dateToUse.toDate();
    } else if (dateToUse?.seconds) {
      startDate = new Date(dateToUse.seconds * 1000);
    } else {
      return 0;
    }
    
    if (isNaN(startDate.getTime())) {
      return 0;
    }
    
    const now = new Date();
    const diffTime = now.getTime() - startDate.getTime();
    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
    return Math.max(0, diffWeeks);
  } catch {
    return 0;
  }
}

/**
 * Aggregate client inventory data with all metrics
 */
async function aggregateClientInventory(coachId: string): Promise<ClientInventoryItem[]> {
  const db = getDb();
  const clientsData: ClientInventoryItem[] = [];
  
  // Fetch all clients for this coach (excluding archived by default, unless requested)
  const clientsSnapshot = await db.collection('clients')
    .where('coachId', '==', coachId)
    .get();
  
  const clientIds: string[] = [];
  const clientsMap = new Map<string, any>();
  
  clientsSnapshot.docs.forEach(doc => {
    const clientData = doc.data();
    // Skip archived clients unless explicitly requested
    if (clientData.status === 'archived') {
      return;
    }
    clientIds.push(doc.id);
    clientsMap.set(doc.id, { id: doc.id, ...clientData });
  });
  
  if (clientIds.length === 0) {
    return [];
  }
  
  // Batch fetch all check-in assignments (handle Firestore 10-item limit)
  const allAssignments: any[] = [];
  for (let i = 0; i < clientIds.length; i += 10) {
    const batch = clientIds.slice(i, i + 10);
    try {
      const assignmentsSnapshot = await db.collection('check_in_assignments')
        .where('clientId', 'in', batch)
        .get();
      allAssignments.push(...assignmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error(`Error fetching assignments batch ${i}-${i + 10}:`, error);
    }
  }
  
  // Group assignments by client
  const assignmentsByClient = new Map<string, any[]>();
  allAssignments.forEach(assignment => {
    const clientId = assignment.clientId;
    if (!assignmentsByClient.has(clientId)) {
      assignmentsByClient.set(clientId, []);
    }
    assignmentsByClient.get(clientId)!.push(assignment);
  });
  
  // Fetch all form responses for these clients (using coachId filter for efficiency)
  let allResponses: any[] = [];
  try {
    const responsesSnapshot = await db.collection('formResponses')
      .where('coachId', '==', coachId)
      .where('status', '==', 'completed')
      .get();
    allResponses = responsesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error: any) {
    console.log('Error fetching responses with coachId filter, trying clientId filter:', error.message);
    // Fallback to clientId filter if coachId filter fails (missing index)
    for (let i = 0; i < clientIds.length; i += 10) {
      const batch = clientIds.slice(i, i + 10);
      try {
        const batchSnapshot = await db.collection('formResponses')
          .where('clientId', 'in', batch)
          .where('status', '==', 'completed')
          .get();
        allResponses.push(...batchSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (batchError) {
        console.error(`Error fetching responses batch ${i}-${i + 10}:`, batchError);
      }
    }
  }
  
  // Group responses by client
  const responsesByClient = new Map<string, any[]>();
  allResponses.forEach(response => {
    const clientId = response.clientId;
    if (!responsesByClient.has(clientId)) {
      responsesByClient.set(clientId, []);
    }
    responsesByClient.get(clientId)!.push(response);
  });
  
  // Fetch goals (batch)
  const allGoals: any[] = [];
  for (let i = 0; i < clientIds.length; i += 10) {
    const batch = clientIds.slice(i, i + 10);
    try {
      const goalsSnapshot = await db.collection('goals')
        .where('clientId', 'in', batch)
        .get();
      allGoals.push(...goalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error(`Error fetching goals batch ${i}-${i + 10}:`, error);
    }
  }
  
  // Process each client and calculate metrics
  const now = new Date();
  
  for (const [clientId, client] of clientsMap) {
    const assignments = assignmentsByClient.get(clientId) || [];
    const responses = responsesByClient.get(clientId) || [];
    const clientGoals = allGoals.filter(g => g.clientId === clientId);
    
    // Sort responses by completion date (most recent first)
    responses.sort((a, b) => {
      const dateA = a.submittedAt || a.completedAt;
      const dateB = b.submittedAt || b.completedAt;
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      const timeA = typeof dateA === 'string' ? new Date(dateA).getTime() : (dateA.toDate ? dateA.toDate().getTime() : dateA.getTime());
      const timeB = typeof dateB === 'string' ? new Date(dateB).getTime() : (dateB.toDate ? dateB.toDate().getTime() : dateB.getTime());
      return timeB - timeA;
    });
    
    // Calculate check-in metrics
    const completedAssignments = assignments.filter(a => a.status === 'completed' || a.responseId);
    const totalCheckIns = assignments.length;
    const completedCheckIns = completedAssignments.length;
    const completionRate = totalCheckIns > 0 ? Math.round((completedCheckIns / totalCheckIns) * 100) : 0;
    
    // Calculate overdue check-ins
    const overdueCheckIns = assignments.filter(a => {
      if (a.status === 'completed') return false;
      if (!a.dueDate) return false;
      const dueDate = a.dueDate?.toDate ? a.dueDate.toDate() : new Date(a.dueDate);
      return dueDate < now;
    }).length;
    
    // Calculate scores
    const scores = responses.map(r => r.score || 0).filter(s => s > 0);
    const averageScore = scores.length > 0 
      ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
      : 0;
    
    // Get last 4 completed check-ins for trend
    const recentResponses = responses.slice(0, 4);
    const recentCheckIns = recentResponses.map(response => {
      const score = response.score || 0;
      const thresholds = getDefaultThresholds('lifestyle');
      const trafficLight = getTrafficLightStatus(score, thresholds);
      const completedAt = response.submittedAt || response.completedAt;
      return {
        score,
        trafficLight,
        completedAt: typeof completedAt === 'string' 
          ? completedAt 
          : (completedAt?.toDate ? completedAt.toDate().toISOString() : new Date(completedAt).toISOString())
      };
    });
    
    // Get last check-in details
    const lastResponse = responses[0];
    const lastCheckInDate = lastResponse?.submittedAt || lastResponse?.completedAt;
    const lastCheckInScore = lastResponse?.score;
    let lastCheckInTrafficLight: 'red' | 'orange' | 'green' | undefined;
    if (lastCheckInScore !== undefined) {
      const thresholds = getDefaultThresholds('lifestyle');
      lastCheckInTrafficLight = getTrafficLightStatus(lastCheckInScore, thresholds);
    }
    
    // Calculate days since last check-in
    let daysSinceLastCheckIn: number | undefined;
    if (lastCheckInDate) {
      try {
        const lastDate = typeof lastCheckInDate === 'string' 
          ? new Date(lastCheckInDate) 
          : (lastCheckInDate.toDate ? lastCheckInDate.toDate() : new Date(lastCheckInDate));
        if (!isNaN(lastDate.getTime())) {
          const diffTime = now.getTime() - lastDate.getTime();
          daysSinceLastCheckIn = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        }
      } catch {
        // Ignore date parsing errors
      }
    }
    
    // Calculate weeks on program
    const weeksOnProgram = calculateWeeksOnProgram(client.createdAt, client.joinDate);
    
    // Progress score is the average score
    const progressScore = averageScore;

    // Current week check-in status (for coach table: Done / Due / Overdue this week)
    const currentWeekCheckInStatus = getCurrentWeekCheckInStatus(assignments, now);
    
    clientsData.push({
      id: clientId,
      firstName: client.firstName || '',
      lastName: client.lastName || '',
      email: client.email || '',
      phone: client.phone,
      status: client.status || 'active',
      createdAt: client.createdAt?.toDate ? client.createdAt.toDate().toISOString() : (typeof client.createdAt === 'string' ? client.createdAt : new Date(client.createdAt).toISOString()),
      joinDate: client.joinDate?.toDate ? client.joinDate.toDate().toISOString() : (typeof client.joinDate === 'string' ? client.joinDate : client.joinDate ? new Date(client.joinDate).toISOString() : undefined),
      metrics: {
        progressScore,
        totalCheckIns,
        completedCheckIns,
        overdueCheckIns,
        completionRate,
        weeksOnProgram,
        lastCheckInDate: lastCheckInDate ? (typeof lastCheckInDate === 'string' ? lastCheckInDate : (lastCheckInDate.toDate ? lastCheckInDate.toDate().toISOString() : new Date(lastCheckInDate).toISOString())) : undefined,
        lastCheckInScore,
        lastCheckInTrafficLight,
        recentCheckIns,
        daysSinceLastCheckIn,
        averageScore,
        currentWeekCheckInStatus
      }
    });
  }
  
  return clientsData;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');
    const status = searchParams.get('status') || 'all';
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID is required'
      }, { status: 400 });
    }
    
    // Aggregate all client data
    let clients = await aggregateClientInventory(coachId);
    
    // Filter by status
    if (status !== 'all') {
      if (status === 'needsAttention') {
        // Filter for clients that need attention
        clients = clients.filter(client => {
          const m = client.metrics;
          const hasOverdue = m.overdueCheckIns > 0;
          const lowScore = m.progressScore < 60;
          const noActivity = m.daysSinceLastCheckIn !== undefined && m.daysSinceLastCheckIn > 7;
          const lowCompletion = m.completionRate < 50;
          const isRedOrOrange = m.lastCheckInTrafficLight === 'red' || m.lastCheckInTrafficLight === 'orange';
          return hasOverdue || lowScore || noActivity || lowCompletion || isRedOrOrange;
        });
      } else {
        clients = clients.filter(client => client.status === status);
      }
    }
    
    // Sort clients
    clients.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'name':
          aValue = `${a.firstName} ${a.lastName}`.toLowerCase();
          bValue = `${b.firstName} ${b.lastName}`.toLowerCase();
          break;
        case 'weeks':
          aValue = a.metrics.weeksOnProgram;
          bValue = b.metrics.weeksOnProgram;
          break;
        case 'score':
          aValue = a.metrics.progressScore;
          bValue = b.metrics.progressScore;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'lastCheckIn':
          aValue = a.metrics.lastCheckInDate ? new Date(a.metrics.lastCheckInDate).getTime() : 0;
          bValue = b.metrics.lastCheckInDate ? new Date(b.metrics.lastCheckInDate).getTime() : 0;
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    // Apply pagination
    const total = clients.length;
    const hasMore = offset + limit < total;
    const paginatedClients = clients.slice(offset, offset + limit);
    
    const response = NextResponse.json({
      success: true,
      data: {
        clients: paginatedClients,
        total,
        pagination: {
          limit,
          offset,
          hasMore
        }
      }
    });
    
    // Add caching headers for client-side caching
    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    
    return response;
    
  } catch (error: any) {
    console.error('Error fetching client inventory:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Failed to fetch client inventory',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

