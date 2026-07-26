import { get, push, ref, set } from 'firebase/database';
import { database } from '../firebase/config';

export type ActivityEventType =
    | 'openFile'
    | 'aiToolUsage';

export interface OpenFileEvent {
    type: 'openFile';
    fileId?: string;
    fileName?: string;
    courseId?: string;
    courseName?: string;
    openedAt: number;
}

export interface AiToolUsageEvent {
    type: 'aiToolUsage';
    toolType: 'summarizer' | 'explainer' | 'translator' | 'questions';
    fileId?: string;
    fileName?: string;
    courseId?: string;
    courseName?: string;
    usedAt: number;
}

export type UserActivityEvent = OpenFileEvent | AiToolUsageEvent;

const eventsRefForUser = (userId: string) => ref(database, `user_activity/${userId}/events`);

export const logOpenFile = async (
    userId: string,
    payload: Omit<OpenFileEvent, 'type'>
): Promise<void> => {
    if (!userId) return;

    const newEventRef = push(eventsRefForUser(userId));
    await set(newEventRef, {
        ...payload,
        type: 'openFile',
        openedAt: payload.openedAt ?? Date.now()
    } as OpenFileEvent);
};

export const logAiToolUsage = async (
    userId: string,
    payload: Omit<AiToolUsageEvent, 'type'>
): Promise<void> => {
    if (!userId) return;

    const newEventRef = push(eventsRefForUser(userId));
    await set(newEventRef, {
        ...payload,
        type: 'aiToolUsage',
        usedAt: payload.usedAt ?? Date.now()
    } as AiToolUsageEvent);
};

export const fetchLatestOpenedFiles = async (
    userId: string,
    limit: number = 3
): Promise<OpenFileEvent[]> => {
    if (!userId) return [];

    const snapshot = await get(eventsRefForUser(userId));
    if (!snapshot.exists()) return [];

    const openedEvents: OpenFileEvent[] = [];
    snapshot.forEach((child) => {
        const data = child.val();
        if (!data) return;
        if (data.type === 'openFile') {
            openedEvents.push(data as OpenFileEvent);
        }
    });

    return openedEvents
        .filter((ev) => typeof ev.openedAt === 'number')
        .sort((a, b) => (b.openedAt ?? 0) - (a.openedAt ?? 0))
        .filter((ev) => Boolean(ev.courseId || ev.fileId || ev.fileName))
        .slice(0, limit);
};

