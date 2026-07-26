// Audit Service - Log all file operations
import { db } from '../firebase/config';
import {
    collection,
    addDoc,
    serverTimestamp,
    query,
    orderBy,
    limit,
    getDocs,
} from 'firebase/firestore';

export interface AuditEvent {
    action: 'upload_file' | 'delete_file' | 'update_file' | 'replace_file' | 'download_file' | 'view_file' | 'operation_failed';
    userId: string;
    userName: string;
    userRole?: string;
    resourceType: 'file';
    resourceId: string;
    resourceName?: string;
    details?: Record<string, unknown>;
    timestamp?: unknown;
}

export const logAuditEvent = async (event: AuditEvent): Promise<void> => {
    try {
        const auditCollection = collection(db, 'auditLogs');
        await addDoc(auditCollection, {
            ...event,
            timestamp: serverTimestamp(),
        });
    } catch (error) {
        console.error('Failed to log audit event:', error);
    }
};

export const getAuditLogs = async (
    limitCount: number = 100
): Promise<AuditEvent[]> => {
    try {
        const auditCollection = collection(db, 'auditLogs');
        const q = query(auditCollection, orderBy('timestamp', 'desc'), limit(limitCount));
        const snapshot = await getDocs(q);

        const logs: AuditEvent[] = [];
        snapshot.forEach((doc) => {
            logs.push(doc.data() as AuditEvent);
        });

        return logs;
    } catch (error) {
        console.error('Failed to fetch audit logs:', error);
        return [];
    }
};

export default {
    logAuditEvent,
    getAuditLogs,
};