/**
 * Audit Log Utility
 * Provides functions to log user actions for audit purposes
 */

import { getDb } from './firebase-server';
import { Timestamp } from 'firebase-admin/firestore';
import { logSafeError } from './logger';

export type AuditActionType =
  | 'login'
  | 'logout'
  | 'check_in_submitted'
  | 'check_in_updated'
  | 'check_in_deleted'
  | 'check_in_cleared'
  | 'measurement_submitted'
  | 'measurement_updated'
  | 'measurement_deleted'
  | 'profile_updated'
  | 'client_created'
  | 'client_updated'
  | 'client_deleted'
  | 'form_created'
  | 'form_updated'
  | 'form_deleted'
  | 'check_in_assigned'
  | 'check_in_assignment_deleted'
  | 'user_created'
  | 'user_updated'
  | 'user_deleted';

export interface AuditLogEntry {
  userId: string;
  userEmail?: string;
  userName?: string;
  userRole: 'admin' | 'coach' | 'client';
  action: AuditActionType;
  resourceType?: string; // e.g., 'check_in', 'measurement', 'client'
  resourceId?: string;
  description: string;
  metadata?: Record<string, any>; // Additional context
  ipAddress?: string;
  userAgent?: string;
  timestamp: Timestamp;
}

/**
 * Log an audit event
 * @param entry The audit log entry to create
 */
export async function logAuditEvent(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
  try {
    const db = getDb();
    const auditEntry: AuditLogEntry = {
      ...entry,
      timestamp: Timestamp.now(),
    };

    await db.collection('audit_logs').add(auditEntry);
  } catch (error) {
    // Don't throw errors - audit logging should never break the main flow
    logSafeError('Error logging audit event', error);
  }
}

/**
 * Log a login event
 */
export async function logLogin(
  userId: string,
  userEmail: string,
  userName: string,
  userRole: 'admin' | 'coach' | 'client',
  metadata?: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  await logAuditEvent({
    userId,
    userEmail,
    userName,
    userRole,
    action: 'login',
    description: `${userName} (${userEmail}) logged in`,
    metadata,
    ipAddress: metadata?.ipAddress,
    userAgent: metadata?.userAgent,
  });
}

/**
 * Log a logout event
 */
export async function logLogout(
  userId: string,
  userEmail: string,
  userName: string,
  userRole: 'admin' | 'coach' | 'client',
  metadata?: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  await logAuditEvent({
    userId,
    userEmail,
    userName,
    userRole,
    action: 'logout',
    description: `${userName} (${userEmail}) logged out`,
    metadata,
    ipAddress: metadata?.ipAddress,
    userAgent: metadata?.userAgent,
  });
}

/**
 * Log a check-in submission
 */
export async function logCheckInSubmitted(
  userId: string,
  userEmail: string,
  userName: string,
  userRole: 'admin' | 'coach' | 'client',
  assignmentId: string,
  formId: string,
  score?: number,
  metadata?: Record<string, any>
): Promise<void> {
  await logAuditEvent({
    userId,
    userEmail,
    userName,
    userRole,
    action: 'check_in_submitted',
    resourceType: 'check_in',
    resourceId: assignmentId,
    description: `${userName} submitted check-in ${assignmentId}${score !== undefined ? ` (Score: ${score})` : ''}`,
    metadata: {
      formId,
      score,
      ...metadata,
    },
  });
}

/**
 * Log a measurement submission
 */
export async function logMeasurementSubmitted(
  userId: string,
  userEmail: string,
  userName: string,
  userRole: 'admin' | 'coach' | 'client',
  measurementId: string,
  clientId: string,
  metadata?: { bodyWeight?: number; isBaseline?: boolean }
): Promise<void> {
  await logAuditEvent({
    userId,
    userEmail,
    userName,
    userRole,
    action: 'measurement_submitted',
    resourceType: 'measurement',
    resourceId: measurementId,
    description: `${userName} submitted measurement${metadata?.isBaseline ? ' (baseline)' : ''}`,
    metadata: {
      clientId,
      ...metadata,
    },
  });
}

/**
 * Log a measurement update
 */
export async function logMeasurementUpdated(
  userId: string,
  userEmail: string,
  userName: string,
  userRole: 'admin' | 'coach' | 'client',
  measurementId: string,
  clientId: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logAuditEvent({
    userId,
    userEmail,
    userName,
    userRole,
    action: 'measurement_updated',
    resourceType: 'measurement',
    resourceId: measurementId,
    description: `${userName} updated measurement ${measurementId}`,
    metadata: {
      clientId,
      ...metadata,
    },
  });
}

/**
 * Log a check-in deletion
 */
export async function logCheckInDeleted(
  userId: string,
  userEmail: string,
  userName: string,
  userRole: 'admin' | 'coach' | 'client',
  assignmentId: string,
  clearData: boolean,
  metadata?: Record<string, any>
): Promise<void> {
  await logAuditEvent({
    userId,
    userEmail,
    userName,
    userRole,
    action: clearData ? 'check_in_cleared' : 'check_in_deleted',
    resourceType: 'check_in',
    resourceId: assignmentId,
    description: `${userName} ${clearData ? 'cleared data from' : 'deleted'} check-in ${assignmentId}`,
    metadata: {
      clearData,
      ...metadata,
    },
  });
}

