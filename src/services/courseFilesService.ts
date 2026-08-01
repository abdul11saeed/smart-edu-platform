import { storage, db } from '../firebase/config';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { User, File as AppFile, University } from '../types';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    increment,
    limit,
} from 'firebase/firestore';
import { logAuditEvent } from './auditService';
import { extractTextPreview } from './localFileStorage';
import { recommendationService } from './recommendationService';
import { getCurrentUser } from './authService';
import { normalizeArabic } from '../utils/searchNormalizer';

// Resolve the acting user's uid for recommendation-interest tracking.
// Falls back gracefully (returns undefined) for guests / unauthenticated.
const getActorUid = (): string | undefined => {
    try {
        return getCurrentUser()?.uid;
    } catch {
        return undefined;
    }
};

// ============================================
// UNIFIED FILE SYSTEM - Course Files Service
// ============================================

export interface UploadFileMetadata {
    universityId: string;
    collegeId: string;
    majorId: string;
    courseId: string;
    universityName?: string;
    collegeName?: string;
    majorName?: string;
    courseName?: string;
    description?: string;
    tags?: string[];
    uploaderId?: string;
    uploaderName?: string;
    uploaderEmail?: string;
    professorName?: string;
    term?: string;
    level?: string;
    academicYear?: string;
    semester?: number;
}

export interface FileFilters {
    courseId?: string;
    universityId?: string;
    collegeId?: string;
    majorId?: string;
    uploaderId?: string;
    search?: string;
    status?: string;
}

const buildStoragePath = (
    universityId: string,
    collegeId: string,
    majorId: string,
    courseId: string,
    uploaderId: string,
    fileId: string,
    extension: string
): string => `courses/${universityId}/${collegeId}/${majorId}/${courseId}/${uploaderId}/${fileId}.${extension}`;

export const getFileType = (extension: string): 'pdf' | 'doc' | 'ppt' | 'other' => {
    const ext = extension.toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) return 'doc';
    if (['ppt', 'pptx'].includes(ext)) return 'ppt';
    return 'other';
};

export const getUserFromFirestore = async (userId: string): Promise<User | null> => {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        return userDoc.exists() ? (userDoc.data() as User) : null;
    } catch {
        return null;
    }
};

const safeName = (val: unknown): string => {
    if (typeof val === 'string' && val.trim()) return val.trim();
    return '';
};

const normalizeCourseFileRecord = (docSnap: { id: string; data: () => Record<string, any> }): AppFile => {
    const data = docSnap.data() as AppFile & { id?: string };
    const { id: _ignoredId, ...rest } = data;
    return {
        id: docSnap.id,
        ...rest,
        owner: data.owner || (data.uploadedBy ? {
            uid: data.uploadedBy,
            name: safeName(data.uploadedByName) || '',
            email: data.uploadedByEmail || '',
            role: 'student',
        } : undefined),
        courseName: safeName(data.courseName) || safeName(data.course?.name) || '',
        universityName: safeName(data.universityName) || safeName(data.university?.name) || '',
        collegeName: safeName(data.collegeName) || safeName(data.college?.name) || '',
        majorName: safeName(data.majorName) || safeName(data.major?.name) || '',
        relationshipStatus: data.relationshipStatus || (data.userVerified && data.courseVerified ? 'verified' : 'pending_validation'),
        userVerified: data.userVerified ?? !!data.uploadedBy,
        courseVerified: data.courseVerified ?? !!data.courseId,
        academicContextComplete: data.academicContextComplete ?? Boolean(data.universityId && data.collegeId && data.majorId && data.courseId),
    } as AppFile;
};

const validateUploadContext = async (uploaderId: string, metadata: UploadFileMetadata) => {
    if (!uploaderId.trim()) {
        throw new Error('Uploader ID is required');
    }

    const userDoc = await getDoc(doc(db, 'users', uploaderId));
    if (!userDoc.exists()) {
        throw new Error('Uploader account not found');
    }

    // Courses are stored nested inside university documents, not in a separate 'courses' collection.
    // Search for the course in the nested structure.
    let courseExists = false;
    let courseName = metadata.courseName || '';

    if (metadata.courseId && metadata.universityId) {
        try {
            const uniDoc = await getDoc(doc(db, 'universities', metadata.universityId));
            if (uniDoc.exists()) {
                const uniData = uniDoc.data() as University;
                const colleges = Array.isArray(uniData.colleges) ? uniData.colleges : [];
                for (const col of colleges) {
                    const majors = Array.isArray(col.majors) ? col.majors : [];
                    for (const maj of majors) {
                        const courses = Array.isArray(maj.courses) ? maj.courses : [];
                        const found = courses.find((c: any) => c.id === metadata.courseId);
                        if (found) {
                            courseExists = true;
                            courseName = found.name || metadata.courseName || '';
                            break;
                        }
                    }
                    if (courseExists) break;
                }
            }
        } catch (error) {
            console.warn('Could not verify course existence:', error);
        }
    }

    return {
        uploader: userDoc.data() as User,
        courseExists,
        courseName,
    };
};

export const uploadCourseFile = async (
    file: File,
    uploaderId: string,
    uploaderName: string,
    uploaderEmail: string,
    metadata: UploadFileMetadata,
    onProgress?: (progress: number) => void,
    uploaderRole?: string
): Promise<{ success: boolean; fileId?: string; url?: string; error?: string }> => {
    const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const extension = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const storagePath = buildStoragePath(
        metadata.universityId,
        metadata.collegeId,
        metadata.majorId,
        metadata.courseId,
        uploaderId,
        fileId,
        extension
    );
    const storageReference = storageRef(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageReference, file, {
        customMetadata: {
            uploadedBy: uploaderId,
            uploaderName,
            uploaderEmail: uploaderEmail || '',
            universityId: metadata.universityId,
            collegeId: metadata.collegeId,
            majorId: metadata.majorId,
            courseId: metadata.courseId,
            originalFileName: file.name,
        },
    });

    try {
        const { courseExists, courseName } = await validateUploadContext(uploaderId, metadata);

        const downloadURL = await new Promise<string>((resolve, reject) => {
            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                    onProgress?.(progress);
                },
                reject,
                () => getDownloadURL(uploadTask.snapshot.ref).then(resolve).catch(reject)
            );
        });

        const now = new Date().toISOString();
        const fileDoc = {
            id: fileId,
            fileId,
            name: file.name,
            originalFileName: file.name,
            displayName: file.name,
            storagePath,
            downloadURL,
            url: downloadURL,
            size: file.size,
            mimeType: file.type,
            extension,
            fileExtension: extension,
            type: getFileType(extension),
            uploadedBy: uploaderId,
            uploadedByName: uploaderName,
            uploadedByEmail: uploaderEmail,
            owner: { uid: uploaderId, name: uploaderName, email: uploaderEmail, role: uploaderRole || 'student' },
            isDeleted: false,
            uploadedAt: now,
            createdAt: now,
            updatedAt: now,
            status: 'active',
            description: metadata.description || '',
            tags: metadata.tags || [],
            downloadsCount: 0,
            viewsCount: 0,
            lastModifiedBy: uploaderId,
            universityId: metadata.universityId,
            collegeId: metadata.collegeId,
            majorId: metadata.majorId,
            courseId: metadata.courseId,
            universityName: metadata.universityName || '',
            collegeName: metadata.collegeName || '',
            majorName: metadata.majorName || '',
            courseName: metadata.courseName || courseName || metadata.courseId,
            professorName: metadata.professorName || '',
            relationshipStatus: courseExists ? 'verified' : 'pending_validation',
            userVerified: true,
            courseVerified: courseExists,
            academicContextComplete: Boolean(metadata.universityId && metadata.collegeId && metadata.majorId && metadata.courseId),
            term: metadata.term || '',
            level: metadata.level || '',
            academicYear: metadata.academicYear || '',
            semester: metadata.semester || 0,
            storageMode: 'firebase',
        } as AppFile;

        await setDoc(doc(db, 'courseFiles', fileId), fileDoc);
        await logAuditEvent({ action: 'upload_file', userId: uploaderId, userName: uploaderName, resourceType: 'file', resourceId: fileId, details: { fileName: file.name, universityId: metadata.universityId, courseId: metadata.courseId, size: file.size } }).catch(() => undefined);

        // Sync to public collection for guest access with retry logic
        (async () => {
            const maxRetries = 3;
            const retryDelay = 1000;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    await syncFileToPublicCollection(fileId);
                    break; // Success
                } catch (e) {
                    console.warn(`Failed to sync file to public collection (attempt ${attempt}/${maxRetries}):`, e);
                    if (attempt < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
                    }
                }
            }
        })();

        // Extract text preview for AI features (non-blocking background task)
        (async () => {
            try {
                const textPreview = await extractTextPreview(file);
                // Backward-compatible check: both Arabic ([ملف) and English ([File) prefixes
                if (textPreview && !['[ملف', '[File'].some(prefix => textPreview.startsWith(prefix))) {
                    await updateDoc(doc(db, 'courseFiles', fileId), {
                        localTextPreview: textPreview
                    }).catch(e => console.warn('Failed to update text preview:', e));
                }
            } catch (e) {
                console.warn('Failed to extract text preview:', e);
            }
        })();

        // Track file upload for recommendations (non-blocking)
        (async () => {
            try {
                await recommendationService.trackActivity(
                    {
                        activityType: 'upload_file',
                        metadata: {
                            contentType: 'course_file',
                            contentId: fileId,
                            category: metadata.majorId || metadata.courseId || 'general',
                            keywords: [metadata.majorName, metadata.courseName, metadata.universityName, metadata.professorName].filter(Boolean),
                            source: 'course_files',
                        },
                    },
                    uploaderId
                );
            } catch {
                // Non-critical: don't block upload on tracking failure
            }
        })();

        return { success: true, fileId, url: downloadURL };
    } catch (error) {
        try { await deleteObject(storageReference); } catch { }
        return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
    }
};

// Get all files from collection - always filter isDeleted on server side
// Added maxResults parameter for scalability (default: 1000, max: 5000)
export const getAllCourseFiles = async (maxResults: number = 1000): Promise<AppFile[]> => {
    const safeLimit = Math.min(Math.max(1, maxResults), 5000);
    try {
        const q = query(collection(db, 'courseFiles'), where('isDeleted', '==', false), orderBy('createdAt', 'desc'));
        const snapshot = safeLimit < 5000 ? await getDocs(query(q, limit(safeLimit))) : await getDocs(q);
        return snapshot.docs.map((docSnap) => normalizeCourseFileRecord(docSnap));
    } catch (error) {
        console.error('Error getting all course files:', error);
        return [];
    }
};

export const listenToCourseFiles = (filters: FileFilters = {}, callback: (files: AppFile[]) => void) => {
    // Build query - start with basic collection
    let q = query(collection(db, 'courseFiles'));

    // Always filter out deleted files on the server side
    q = query(q, where('isDeleted', '==', false));

    // Apply other filters
    if (filters.courseId) q = query(q, where('courseId', '==', filters.courseId));
    if (filters.universityId) q = query(q, where('universityId', '==', filters.universityId));
    if (filters.collegeId) q = query(q, where('collegeId', '==', filters.collegeId));
    if (filters.majorId) q = query(q, where('majorId', '==', filters.majorId));
    if (filters.uploaderId) q = query(q, where('uploadedBy', '==', filters.uploaderId));

    // Add orderBy
    q = query(q, orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
        let files = snapshot.docs.map((docSnap) => normalizeCourseFileRecord(docSnap));

        // Apply search filter in code (server-side text search not available in Firestore)
        const search = filters.search?.trim().toLowerCase();
        const filtered = search ? files.filter((file) => {
            const haystack = [
                file.name, file.originalFileName, file.displayName, file.courseName,
                file.universityName, file.collegeName, file.majorName,
                file.universityId, file.collegeId, file.majorId, file.courseId,
                file.description, file.tags?.join(' '), file.owner?.name, file.owner?.email,
                file.uploadedByName, file.professorName
            ].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(normalizeArabic(search));
        }) : files;

        callback(filtered);
    }, (error) => {
        console.error('Error in courseFiles listener:', error);
    });
};

export const getTotalFileCount = async (): Promise<number> => {
    try {
        const snapshot = await getDocs(query(collection(db, 'courseFiles'), where('isDeleted', '==', false)));
        return snapshot.size;
    } catch (error) {
        console.warn('Could not get file count:', error);
        return 0;
    }
};

export const getFilesByUploader = async (uploaderId: string): Promise<AppFile[]> => {
    try {
        const q = query(collection(db, 'courseFiles'), where('uploadedBy', '==', uploaderId), where('isDeleted', '==', false), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map((docSnap) => normalizeCourseFileRecord(docSnap));
    } catch (error) {
        console.warn('Could not get files by uploader:', error);
        return [];
    }
};

export const getFilesByFilters = async (filters: FileFilters): Promise<AppFile[]> => {
    try {
        let q = query(collection(db, 'courseFiles'), where('isDeleted', '==', false));

        if (filters.courseId) q = query(q, where('courseId', '==', filters.courseId));
        if (filters.universityId) q = query(q, where('universityId', '==', filters.universityId));
        if (filters.collegeId) q = query(q, where('collegeId', '==', filters.collegeId));
        if (filters.majorId) q = query(q, where('majorId', '==', filters.majorId));
        if (filters.uploaderId) q = query(q, where('uploadedBy', '==', filters.uploaderId));

        q = query(q, orderBy('createdAt', 'desc'));

        const snapshot = await getDocs(q);
        let files = snapshot.docs.map((docSnap) => normalizeCourseFileRecord(docSnap));

        if (filters.search) {
            const search = filters.search.trim().toLowerCase();
            files = files.filter((file) => {
                const haystack = [
                    file.name, file.originalFileName, file.displayName, file.courseName,
                    file.universityName, file.collegeName, file.majorName,
                    file.universityId, file.collegeId, file.majorId, file.courseId,
                    file.description, file.tags?.join(' '), file.owner?.name, file.owner?.email,
                    file.uploadedByName, file.professorName
                ].filter(Boolean).join(' ').toLowerCase();
                return haystack.includes(normalizeArabic(search));
            });
        }

        return files;
    } catch (error) {
        console.warn('Could not get files by filters:', error);
        return [];
    }
};

export const deleteCourseFile = async (fileId: string, currentUserId?: string, role?: string): Promise<void> => {
    const fileDocRef = doc(db, 'courseFiles', fileId);
    const fileDoc = await getDoc(fileDocRef);
    if (!fileDoc.exists()) return;
    const data = fileDoc.data() as AppFile;
    const canDelete = role === 'admin' || data.uploadedBy === currentUserId;
    if (!canDelete) throw new Error('Not authorized to delete this file');

    // 1) Delete the actual file from Storage (best-effort: ignore if it was already removed)
    if (data.storagePath) {
        try {
            await deleteObject(storageRef(storage, data.storagePath));
        } catch (err) {
            console.warn('Could not delete storage object (may already be removed):', err);
        }
    }

    // 2) Audit log the deletion
    await logAuditEvent({ action: 'delete_file', userId: currentUserId || 'unknown', userName: currentUserId || 'unknown', userRole: role || 'student', resourceType: 'file', resourceId: fileId, details: { fileName: data.name } }).catch(() => undefined);

    // 3) Permanently remove the Firestore document
    await deleteDoc(fileDocRef);

    // 4) Remove from public collection with retry
    (async () => {
        const maxRetries = 3;
        const retryDelay = 500;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                await removeFileFromPublicCollection(fileId);
                break;
            } catch (e) {
                console.warn(`Failed to remove file from public collection (attempt ${attempt}/${maxRetries}):`, e);
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
                }
            }
        }
    })();
};

export const downloadCourseFile = async (fileId: string): Promise<string> => {
    const fileDocRef = doc(db, 'courseFiles', fileId);
    const fileDoc = await getDoc(fileDocRef);
    if (!fileDoc.exists()) throw new Error('File not found');
    const data = fileDoc.data() as AppFile;
    if (data.isDeleted) throw new Error('File not found');
    if (data.downloadURL) {
        try {
            await updateDoc(fileDocRef, {
                downloadsCount: increment(1),
                updatedAt: new Date().toISOString()
            });
        } catch {
            // Non-critical: download still works even if counter fails
        }

        // Track download for recommendations (non-blocking). Attribute to the
        // CURRENT user (the one downloading), not the file's uploader.
        const downloadActor = getActorUid();
        if (downloadActor) {
            recommendationService.trackActivity({
                activityType: 'download_file',
                metadata: {
                    contentType: 'course_file',
                    contentId: fileId,
                    category: data.majorId || data.courseId || 'general',
                    keywords: [data.majorName, data.courseName, data.universityName].filter(Boolean),
                    source: 'course_files',
                },
            }, downloadActor).catch(() => {});
        }

        return data.downloadURL;
    }
    throw new Error('File URL not available');
};

export const updateCourseFile = async (fileId: string, updates: Partial<AppFile>, currentUserId?: string, role?: string): Promise<void> => {
    const fileDocRef = doc(db, 'courseFiles', fileId);
    const fileDoc = await getDoc(fileDocRef);
    if (!fileDoc.exists()) throw new Error('File not found');
    const data = fileDoc.data() as AppFile;
    const canEdit = role === 'admin' || data.uploadedBy === currentUserId;
    if (!canEdit) throw new Error('Not authorized to edit this file');
    await updateDoc(fileDocRef, { ...updates, updatedAt: new Date().toISOString(), lastModifiedBy: currentUserId || '' });
};

export const getFileById = async (fileId: string): Promise<AppFile | null> => {
    const fileDoc = await getDoc(doc(db, 'courseFiles', fileId));
    if (!fileDoc.exists()) return null;
    const data = fileDoc.data() as AppFile & { id?: string };
    if (data.isDeleted) return null;
    return normalizeCourseFileRecord(fileDoc as { id: string; data: () => Record<string, any> });
};

export const getFilesByCourse = async (courseId: string): Promise<AppFile[]> => {
    return getFilesByFilters({ courseId });
};

export const getFilesByCollege = async (collegeId: string): Promise<AppFile[]> => {
    return getFilesByFilters({ collegeId });
};

export const getFilesByMajor = async (majorId: string): Promise<AppFile[]> => {
    return getFilesByFilters({ majorId });
};

export const getFilesByUniversity = async (universityId: string): Promise<AppFile[]> => {
    return getFilesByFilters({ universityId });
};

export const incrementViews = async (fileId: string): Promise<void> => {
    try {
        const fileDocRef = doc(db, 'courseFiles', fileId);
        const fileDoc = await getDoc(fileDocRef);
        if (!fileDoc.exists()) return;
        const data = fileDoc.data() as AppFile;
        if (data.isDeleted) return;
        await updateDoc(fileDocRef, {
            viewsCount: (data.viewsCount || 0) + 1,
            updatedAt: new Date().toISOString()
        });

        // Track view for recommendations (non-blocking). Attribute to the
        // CURRENT user (the one viewing), not the file's uploader.
        const viewActor = getActorUid();
        if (viewActor) {
            recommendationService.trackActivity({
                activityType: 'open_file',
                metadata: {
                    contentType: 'course_file',
                    contentId: fileId,
                    category: data.majorId || data.courseId || 'general',
                    keywords: [data.majorName, data.courseName, data.universityName].filter(Boolean),
                    source: 'course_files',
                },
            }, viewActor).catch(() => {});
        }
    } catch {
        // Non-critical: view count may fail silently
    }
};

// ============================================
// PUBLIC COURSE FILES - Read-only access for guests
// ============================================

const normalizePublicCourseFileRecord = (docSnap: { id: string; data: () => Record<string, any> }): AppFile => {
    const data = docSnap.data() as Record<string, any>;
    return {
        id: docSnap.id,
        name: safeName(data.name) || '',
        originalFileName: safeName(data.originalFileName) || '',
        displayName: safeName(data.displayName) || '',
        extension: safeName(data.extension) || '',
        fileExtension: safeName(data.fileExtension) || '',
        size: data.size || 0,
        mimeType: safeName(data.mimeType) || '',
        type: data.type || 'other',
        description: safeName(data.description) || '',
        tags: Array.isArray(data.tags) ? data.tags : [],
        universityId: safeName(data.universityId) || '',
        collegeId: safeName(data.collegeId) || '',
        majorId: safeName(data.majorId) || '',
        courseId: safeName(data.courseId) || '',
        universityName: safeName(data.universityName) || '',
        collegeName: safeName(data.collegeName) || '',
        majorName: safeName(data.majorName) || '',
        courseName: safeName(data.courseName) || '',
        professorName: safeName(data.professorName) || '',
        term: safeName(data.term) || '',
        level: safeName(data.level) || '',
        academicYear: safeName(data.academicYear) || '',
        viewsCount: data.viewsCount || 0,
        downloadsCount: data.downloadsCount || 0,
        createdAt: safeName(data.createdAt) || '',
        uploadedAt: safeName(data.uploadedAt) || '',
        updatedAt: safeName(data.updatedAt) || '',
        isDeleted: data.isDeleted || false,
        uploadedBy: safeName(data.uploadedBy) || '',
            uploadedByName: safeName(data.uploadedByName) || '',
            localTextPreview: typeof data.localTextPreview === 'string' ? data.localTextPreview : '',
            storageMode: data.storageMode || 'firebase',
        } as AppFile;
};

export const listenToPublicCourseFiles = (filters: FileFilters = {}, callback: (files: AppFile[]) => void) => {
    let q = query(collection(db, 'publicCourseFiles'));

    // Always filter out deleted files on the server side
    q = query(q, where('isDeleted', '==', false));

    if (filters.courseId) q = query(q, where('courseId', '==', filters.courseId));
    if (filters.universityId) q = query(q, where('universityId', '==', filters.universityId));
    if (filters.collegeId) q = query(q, where('collegeId', '==', filters.collegeId));
    if (filters.majorId) q = query(q, where('majorId', '==', filters.majorId));
    if (filters.uploaderId) q = query(q, where('uploadedBy', '==', filters.uploaderId));

    q = query(q, orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
        let files = snapshot.docs.map((docSnap) => normalizePublicCourseFileRecord(docSnap));

        const search = filters.search?.trim().toLowerCase();
        const filtered = search ? files.filter((file) => {
            const haystack = [
                file.name, file.originalFileName, file.displayName, file.courseName,
                file.universityName, file.collegeName, file.majorName,
                file.universityId, file.collegeId, file.majorId, file.courseId,
                file.description, file.tags?.join(' '), file.uploadedByName,
                file.professorName
            ].filter(Boolean).join(' ').toLowerCase();
            return haystack.includes(normalizeArabic(search));
        }) : files;

        callback(filtered);
    }, (error) => {
        console.error('Error in publicCourseFiles listener:', error);
    });
};

export const getPublicCourseFiles = async (filters: FileFilters = {}): Promise<AppFile[]> => {
    try {
        let q = query(collection(db, 'publicCourseFiles'), where('isDeleted', '==', false));

        if (filters.courseId) q = query(q, where('courseId', '==', filters.courseId));
        if (filters.universityId) q = query(q, where('universityId', '==', filters.universityId));
        if (filters.collegeId) q = query(q, where('collegeId', '==', filters.collegeId));
        if (filters.majorId) q = query(q, where('majorId', '==', filters.majorId));
        if (filters.uploaderId) q = query(q, where('uploadedBy', '==', filters.uploaderId));

        q = query(q, orderBy('createdAt', 'desc'));

        const snapshot = await getDocs(q);
        let files = snapshot.docs.map((docSnap) => normalizePublicCourseFileRecord(docSnap));

        if (filters.search) {
            const search = filters.search.trim().toLowerCase();
            files = files.filter((file) => {
                const haystack = [
                    file.name, file.originalFileName, file.displayName, file.courseName,
                    file.universityName, file.collegeName, file.majorName,
                    file.universityId, file.collegeId, file.majorId, file.courseId,
                    file.description, file.tags?.join(' '), file.uploadedByName,
                    file.professorName
                ].filter(Boolean).join(' ').toLowerCase();
                return haystack.includes(normalizeArabic(search));
            });
        }

        return files;
    } catch (error) {
        console.warn('Could not get public course files:', error);
        return [];
    }
};

export const syncFileToPublicCollection = async (fileId: string): Promise<void> => {
    try {
        const fileDoc = await getDoc(doc(db, 'courseFiles', fileId));
        if (!fileDoc.exists()) return;
        const data = fileDoc.data() as AppFile;
        if (data.isDeleted) return;

        const publicData = {
            name: data.name || '',
            originalFileName: data.originalFileName || '',
            displayName: data.displayName || '',
            extension: data.extension || '',
            fileExtension: data.fileExtension || '',
            size: data.size || 0,
            mimeType: data.mimeType || '',
            type: data.type || 'other',
            description: data.description || '',
            tags: data.tags || [],
            universityId: data.universityId || '',
            collegeId: data.collegeId || '',
            majorId: data.majorId || '',
            courseId: data.courseId || '',
            universityName: data.universityName || '',
            collegeName: data.collegeName || '',
            majorName: data.majorName || '',
            courseName: data.courseName || '',
            professorName: data.professorName || '',
            term: data.term || '',
            level: data.level || '',
            academicYear: data.academicYear || '',
            viewsCount: data.viewsCount || 0,
            downloadsCount: data.downloadsCount || 0,
            createdAt: data.createdAt || new Date().toISOString(),
            uploadedAt: data.uploadedAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
            isDeleted: data.isDeleted || false,
            uploadedBy: data.uploadedBy || '',
            uploadedByName: data.uploadedByName || '',
            // Non-sensitive text extract so guests can preview file content
            // without downloading (kept short to stay within Firestore doc limits).
            localTextPreview: typeof data.localTextPreview === 'string' ? data.localTextPreview.slice(0, 4000) : '',
            storageMode: data.storageMode || 'firebase',
        };

        await setDoc(doc(db, 'publicCourseFiles', fileId), publicData, { merge: true });
    } catch (error) {
        console.warn('Failed to sync file to public collection:', error);
    }
};

export const removeFileFromPublicCollection = async (fileId: string): Promise<void> => {
    try {
        await deleteDoc(doc(db, 'publicCourseFiles', fileId));
    } catch (error) {
        console.warn('Failed to remove file from public collection:', error);
    }
};
