export interface University {
    id: string;
    name: string;
    colleges: College[];
}

export interface College {
    id: string;
    name: string;
    majors: Major[];
}

export interface Major {
    id: string;
    name: string;
    courses: Course[];
}

export interface Course {
    id: string;
    name: string;
    files: File[];
    exams: Exam[];
}

export interface Professor {
    id: string;
    name: string;
}

// File interface - Unified structure matching Firestore courseFiles collection schema
export interface File {
    // Primary identifier
    id: string;
    name: string;

    // Basic file info from Firestore schema
    fileId?: string;
    storagePath?: string;
    downloadURL?: string;
    url?: string;
    originalFileName?: string;
    displayName?: string;
    extension?: string;
    fileExtension?: string;
    mimeType?: string;
    size?: number;
    checksum?: string;
    localTextPreview?: string;
    localDataUrl?: string;

    // Ownership
    owner?: {
        uid: string;
        name?: string;
        email?: string;
        role?: string;
    };
    uploadedBy?: string;
    uploadedByName?: string;
    uploadedByEmail?: string;
    professorId?: string;
    professorName?: string;

    // Runtime-only nested references used by UI state
    university?: {
        id: string;
        name: string;
    };
    college?: {
        id: string;
        name: string;
    };
    major?: {
        id: string;
        name: string;
    };
    course?: {
        id: string;
        name: string;
    };

    // Timestamps
    uploadedAt?: string;
    updatedAt?: string;
    createdAt?: string;

    // Academic hierarchy (flat fields as per requirements)
    universityId?: string;
    collegeId?: string;
    majorId?: string;
    courseId?: string;
    semester?: number;
    term?: string;
    level?: string;
    academicYear?: string;

    // Metadata
    description?: string;
    tags?: string[];

    // Statistics
    downloadsCount?: number;
    viewsCount?: number;

    // Status
    status?: 'active' | 'inactive';
    isDeleted?: boolean;
    lastModifiedBy?: string;

    // Relationship integrity tracking
    relationshipStatus?: 'verified' | 'pending_validation' | 'invalid';
    userVerified?: boolean;
    courseVerified?: boolean;
    academicContextComplete?: boolean;

    // Additional fields for display
    type?: 'pdf' | 'doc' | 'ppt' | 'other';
    storageMode?: 'local' | 'firebase';
    courseName?: string;
    universityName?: string;
    collegeName?: string;
    majorName?: string;
}

export interface Exam {
    id: string;
    name: string;
    professorId: string;
    year: number;
    url: string;
}

// Unified User Role type - only two roles are supported platform-wide
export type UserRole = 'student' | 'admin';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    photoURL?: string;
    bio?: string;
    createdAt?: number;
    lastLogin?: number;
    universityId?: string;
    collegeId?: string;
    majorId?: string;
    semester?: number;
    isDeleted?: boolean;
    isBanned?: boolean;
    bannedAt?: number;
    banExpiresAt?: number;
    roleBeforeBan?: UserRole;
    isPermanentAdmin?: boolean;
}

export interface AIQuestion {
    id: string;
    question: string;
    options?: string[];
    answer: string;
    type: 'true-false' | 'multiple-choice';
}

export interface Comment {
    id: string;
    authorId: string;
    authorName: string;
    authorRole: UserRole;
    content: string;
    createdAt: string;
}

export interface Discussion {
    id: string;
    courseId: string;
    authorId: string;
    authorName: string;
    authorRole: UserRole;
    title: string;
    content: string;
    createdAt: string;
    comments: Comment[];
    likes: number;
    likedBy?: string[];
}

// ============================================
// RECOMMENDATION SYSTEM TYPES
// ============================================

export type ContentType = 'article' | 'news' | 'course' | 'research' | 'pdf' | 'video' | 'workshop' | 'conference' | 'scholarship' | 'competition' | 'training';
export type ContentCategory = 'recommended' | 'tech' | 'ai' | 'medical' | 'engineering' | 'free_courses' | 'news' | 'research' | 'scholarships' | 'training' | 'competitions' | 'popular' | 'saved';
export type BadgeType = 'urgent' | 'ending_soon' | 'new' | 'popular' | 'recommended' | 'free_course' | 'trending';

export interface RecommendationContent {
    id: string;
    title: string;
    summary: string;
    description?: string;
    imageUrl?: string;
    sourceUrl: string;
    contentType: ContentType;
    category: ContentCategory;
    source: string;
    author?: string;
    publishedAt?: number;
    createdAt: number;
    updatedAt: number;
    keywords: string[];
    tags: string[];
    language: string;
    isActive: boolean;
    isUrgent?: boolean;
    isFree?: boolean;
    isRecommended?: boolean;
    registrationDeadline?: number;
    expiresAt?: number;
    viewsCount: number;
    likesCount: number;
    sharesCount: number;
    recommendationScore?: number;
    badge?: BadgeType;
    universityId?: string;
    collegeId?: string;
    majorId?: string;
    courseId?: string;
}

// Recommendation item with the optional per-user interaction state (saved/liked)
// returned by the backend for authenticated requests. Shared by the carousel and
// category section components to avoid redefining the same shape in each file.
export interface RecommendationItemWithStatus extends RecommendationContent {
    isSaved?: boolean;
    isLiked?: boolean;
}

export interface StudentInterest {
    userId: string;
    interests: Record<string, number>;
    totalPoints: number;
    lastUpdated: number;
}

export interface StudentActivity {
    id: string;
    userId: string;
    activityType: string;
    points: number;
    metadata: Record<string, any>;
    timestamp: number;
    createdAt: number;
}

export interface SavedRecommendation {
    id: string;
    userId: string;
    contentId: string;
    savedAt: number;
    createdAt: number;
}

export interface LikedRecommendation {
    id: string;
    userId: string;
    contentId: string;
    likedAt: number;
    createdAt: number;
}

export interface HiddenRecommendation {
    id: string;
    userId: string;
    contentId: string;
    reason: string;
    hiddenAt: number;
    createdAt: number;
}

export interface RecommendationStats {
    totalPoints: number;
    savedCount: number;
    topInterests: Array<{ name: string; count: number }>;
}