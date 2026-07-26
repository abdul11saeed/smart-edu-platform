// Firebase Authentication Service - Auth only
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile,
    sendPasswordResetEmail,
    fetchSignInMethodsForEmail,
    onAuthStateChanged,
    User as FirebaseUser,
    UserCredential
} from 'firebase/auth';
import { auth, googleProvider, database, db, storage } from '../firebase/config';
import { ref, set, get, update } from 'firebase/database';
import { doc, setDoc, getDoc, collection, getDocs, query, limit } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { User, UserRole } from '../types';
import { trackUserRegistration } from '../utils/analyticsTracker';

// Predefined admin email - this is the main owner account
export const ADMIN_EMAIL = 'alhmyrybdalhfyz39@gmail.com';

// Shared email validation regex (used by the login & register forms)
export const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

// Check if email is the main admin
const isMainAdmin = (email: string): boolean => {
    return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
};

// Resolve the user's role: the main admin email always wins, otherwise the
// role already stored in the database (or the default) is used.
const resolveRole = (email: string, dbRole: UserRole): UserRole => {
    return isMainAdmin(email) ? 'admin' : dbRole;
};

// Build a user-facing message for a banned account, including the remaining
// ban duration, e.g. "لقد تم حظرك من الموقع لمدة 5 أيام. راجع مدير الموقع."
const buildBanMessage = (user: User): string => {
    const expiresAt = user.banExpiresAt || 0;
    if (expiresAt === 0) {
        return 'لقد تم حظرك من الموقع نهائياً. راجع مدير الموقع.';
    }
    const remaining = expiresAt - Date.now();
    const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
    if (days > 1) {
        return `لقد تم حظرك من الموقع لمدة ${days} يوماً. راجع مدير الموقع.`;
    }
    if (days === 1) {
        return 'لقد تم حظرك من الموقع لمدة يوم واحد. راجع مدير الموقع.';
    }
    const hours = Math.max(1, Math.ceil(remaining / (60 * 60 * 1000)));
    return `لقد تم حظرك من الموقع لمدة ${hours} ساعة. راجع مدير الموقع.`;
};

// Get user role from Realtime Database
const getUserRole = async (userId: string): Promise<UserRole> => {
    try {
        const userRef = ref(database, `users/${userId}/role`);
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
            return snapshot.val() as UserRole;
        }

        return 'student'; // Default role
    } catch (error) {
        // Permission denied can mean:
        // 1. User is banned (security rule blocks reading)
        // 2. Rules are misconfigured
        // 3. User doesn't exist
        // We cannot distinguish these cases reliably from client-side,
        // so we throw a generic error and let the caller handle it.
        console.error('Error getting user role:', error);
        throw new Error('AUTH_PERMISSION_ERROR');
    }
};

// Get full user data from Realtime Database
export const getUserFromRealtimeDB = async (userId: string): Promise<User | null> => {
    try {
        const userRef = ref(database, `users/${userId}`);
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
            const data = snapshot.val();
            return {
                id: data.id,
                name: data.name,
                email: data.email,
                role: data.role || 'student',
                photoURL: data.photoURL || undefined,
                bio: data.bio || undefined,
                createdAt: data.createdAt,
                lastLogin: data.lastLogin,
                isDeleted: data.isDeleted,
                isBanned: data.isBanned,
                bannedAt: data.bannedAt,
                banExpiresAt: data.banExpiresAt,
                roleBeforeBan: data.roleBeforeBan
            };
        }

        return null;
    } catch (error) {
        // Permission denied can mean:
        // 1. User is banned (security rule blocks reading)
        // 2. Rules are misconfigured
        // We throw a generic error and let the caller check Firestore
        // for the ban status, which has more permissive read rules.
        console.error('Error getting user from Realtime DB:', error);
        throw new Error('AUTH_PERMISSION_ERROR');
    }
};

// Create or update user in Realtime Database AND Firestore (for rule checks)
const createOrUpdateUserInDB = async (
    firebaseUser: FirebaseUser,
    role: UserRole
): Promise<User> => {
    try {
        const userRef = ref(database, `users/${firebaseUser.uid}`);
        const snapshot = await get(userRef);
        const isMainAdminUser = isMainAdmin(firebaseUser.email || '');

        const userData = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'مستخدم',
            email: firebaseUser.email || '',
            role: role,
            lastLogin: Date.now(),
            updatedAt: Date.now(),
            // Mark the main owner account as permanent admin so Firestore rules
            // can protect it without hardcoding an email address.
            ...(isMainAdminUser ? { isPermanentAdmin: true } : {})
        };

        if (snapshot.exists()) {
            // Update existing user (preserve any existing photoURL and isPermanentAdmin)
            const existingData = snapshot.val();
            await update(userRef, {
                ...userData,
                createdAt: existingData.createdAt || Date.now(),
                // Preserve isPermanentAdmin if it was already set
                ...(existingData.isPermanentAdmin ? { isPermanentAdmin: true } : {})
            });
        } else {
            // Create new user
            await set(userRef, {
                ...userData,
                // Backfill profile picture from the auth provider (e.g. Google)
                photoURL: firebaseUser.photoURL || null,
                createdAt: Date.now()
            });
        }

        // Also sync to Firestore for security rules. Retry because a transient
        // failure here previously left users missing from the Firestore `users`
        // collection, which made the analytics user count diverge from the
        // dashboard. The write is idempotent (merge), so retrying is safe.
        const firestoreUserRef = doc(db, 'users', firebaseUser.uid);
        const existingFirestoreData = snapshot.exists() ? (snapshot.val() as Record<string, any>) : {};
        const firestoreUserPayload: Record<string, any> = {
            id: firebaseUser.uid,
            name: userData.name,
            email: userData.email,
            role: role,
            createdAt: existingFirestoreData.createdAt || Date.now(),
            updatedAt: Date.now(),
            // Set isPermanentAdmin for the main owner account
            ...(isMainAdminUser ? { isPermanentAdmin: true } : {}),
            // Preserve isPermanentAdmin if it was already set
            ...(existingFirestoreData.isPermanentAdmin && !isMainAdminUser ? { isPermanentAdmin: true } : {})
        };
        // Only seed the photoURL for brand-new users; existing users keep theirs.
        if (!snapshot.exists()) {
            firestoreUserPayload.photoURL = firebaseUser.photoURL || null;
        }
        let firestoreSynced = false;
        for (let attempt = 0; attempt < 3 && !firestoreSynced; attempt++) {
            try {
                await setDoc(firestoreUserRef, firestoreUserPayload, { merge: true });
                firestoreSynced = true;
            } catch (firestoreError) {
                console.warn(`Failed to sync user to Firestore (attempt ${attempt + 1}):`, firestoreError);
            }
        }

        return userData;
    } catch (error) {
        console.error('Error creating/updating user in DB:', error);
        throw error;
    }
};

// ===== Auth Resilience: Session Cache + Timeout + Retry =====
// localStorage key for persisting user data across network failures
const AUTH_CACHE_KEY = 'eduai_auth_cache';
const AUTH_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Max attempts for fetching user data from Realtime DB / Firestore
const AUTH_MAX_RETRIES = 3;
const AUTH_TIMEOUT_MS = 10000; // 10 seconds max wait
const AUTH_RETRY_BASE_DELAY = 1000; // 1 second initial retry delay

// Read cached user from localStorage
const getCachedUser = (): { user: User; timestamp: number } | null => {
    try {
        const raw = localStorage.getItem(AUTH_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (Date.now() - parsed.timestamp > AUTH_CACHE_TTL) {
            localStorage.removeItem(AUTH_CACHE_KEY);
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
};

// Write user cache to localStorage
const setCachedUser = (user: User) => {
    try {
        localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({ user, timestamp: Date.now() }));
    } catch {
        // ignore quota errors silently
    }
};

// Remove cached user (e.g. on logout)
const removeCachedUser = () => {
    try {
        localStorage.removeItem(AUTH_CACHE_KEY);
    } catch {
        // ignore
    }
};

// Wrap a promise with a timeout; rejects with 'AUTH_TIMEOUT' on expiry
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error('AUTH_TIMEOUT')), ms)
        ),
    ]);
};

// Fetch user data with retry logic; throws on final failure
const fetchUserWithRetry = async (
    firebaseUser: FirebaseUser,
    retries = AUTH_MAX_RETRIES
): Promise<User> => {
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            let user = await getUserFromRealtimeDB(firebaseUser.uid);

            if (!user) {
                const role = await getUserRole(firebaseUser.uid);
                const finalRole = resolveRole(firebaseUser.email || '', role);
                user = await createOrUpdateUserInDB(firebaseUser, finalRole);
            }

            // Ban check FIRST: if the account is banned, show ban message even if isDeleted is set
            if (user.isBanned && Date.now() < (user.banExpiresAt || 0)) {
                throw new Error('ACCOUNT_BANNED');
            }

            // Deletion check: if the account is marked as deleted, reject the session
            if (user.isDeleted) {
                throw new Error('ACCOUNT_DELETED');
            }

            // Auto-unban if ban expired
            if (user.isBanned && Date.now() >= (user.banExpiresAt || 0)) {
                await update(ref(database, `users/${firebaseUser.uid}`), {
                    isBanned: false,
                    role: 'student',
                    updatedAt: Date.now()
                });
                try {
                    await setDoc(doc(db, 'users', firebaseUser.uid), { isBanned: false, role: 'student', updatedAt: Date.now() }, { merge: true });
                } catch (e) {
                    console.warn('Failed to auto-unban user in Firestore:', e);
                }
                user = { ...user, isBanned: false, role: 'student' };
            }

            // Freeze owner role as permanent admin regardless of what is stored in DB
            if (isMainAdmin(firebaseUser.email || '')) {
                user = { ...user, role: 'admin' };
                await update(ref(database, `users/${firebaseUser.uid}`), { role: 'admin' });
                try {
                    await setDoc(doc(db, 'users', firebaseUser.uid), { role: 'admin', updatedAt: Date.now() }, { merge: true });
                } catch (e) {
                    console.warn('Failed to update Firestore user role:', e);
                }
            }

            return user;
        } catch (error: any) {
            const isTimeout = error.message === 'AUTH_TIMEOUT';
            const isPermissionError = error.message === 'AUTH_PERMISSION_ERROR';
            const isAuthError = error.message === 'ACCOUNT_BANNED' || error.message === 'ACCOUNT_DELETED';
            
            if (isTimeout || isAuthError || attempt === retries - 1) {
                throw error; // Last attempt, timeout, or auth error -> bubble up
            }
            
            // For permission errors, we still retry because it might be a transient
            // Firebase rules propagation delay. But we don't retry indefinitely.
            if (isPermissionError && attempt >= 1) {
                throw error; // Only retry permission errors once
            }
            
            // Exponential backoff: 1s, 2s before retrying
            const delay = AUTH_RETRY_BASE_DELAY * Math.pow(2, attempt);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw new Error('AUTH_FAILED');
};

// Email/Password Registration
export const registerWithEmail = async (
    email: string,
    password: string,
    name: string,
    role: UserRole = 'student'
): Promise<User> => {
    try {
        const userCredential: UserCredential = await createUserWithEmailAndPassword(auth, email, password);

        // Update profile with display name
        await updateProfile(userCredential.user, {
            displayName: name
        });

        // Check if it's the main admin email
        const finalRole = resolveRole(email, role);

        // Save user to Realtime Database
        const user = await createOrUpdateUserInDB(userCredential.user, finalRole);

        // Track analytics event - new user registration
        await trackUserRegistration(user.id, user.name).catch(err =>
            console.warn('Analytics tracking skipped:', err)
        );

        return user;
    } catch (error: any) {
        console.error('Registration error:', error);
        throw new Error(getAuthErrorMessage(error.code));
    }
};

// Email/Password Login
export const loginWithEmail = async (email: string, password: string): Promise<User> => {
    try {
        const userCredential: UserCredential = await signInWithEmailAndPassword(auth, email, password);

        // Get role from Realtime Database
        const role = await getUserRole(userCredential.user.uid);

        // Check if it's the main admin email
        const finalRole = resolveRole(email, role);

        // Update user in Realtime Database and return user data
        await createOrUpdateUserInDB(userCredential.user, finalRole);

        // Enforce ban/deletion using the authoritative Realtime DB data BEFORE
        // completing the login so banned users see a clear, actionable message.
        const user = await getUserFromRealtimeDB(userCredential.user.uid);
        if (!user) {
            throw new Error('فشل تسجيل الدخول، يرجى المحاولة لاحقاً');
        }
        // Ban check BEFORE deletion check so banned users see the correct ban message
        if (user.isBanned && Date.now() < (user.banExpiresAt || 0)) {
            throw new Error(buildBanMessage(user));
        }
        if (user.isDeleted) {
            throw new Error('تم حظر هذا الحساب. راجع مدير الموقع.');
        }
        // Auto-unban if the ban has already expired.
        if (user.isBanned && Date.now() >= (user.banExpiresAt || 0)) {
            try {
                await unbanUser(user.id);
            } catch (e) {
                console.warn('Failed to auto-unban expired ban on login:', e);
            }
            user.isBanned = false;
        }

        return user;
    } catch (error: any) {
        console.error('Login error:', error);
        // Preserve custom ban/deletion/auth permission messages that carry no Firebase error code.
        if (error?.message && !error?.code) {
            throw error;
        }
        throw new Error(getAuthErrorMessage(error.code));
    }
};

// Google Sign In
export const loginWithGoogle = async (): Promise<User> => {
    try {
        const result: UserCredential = await signInWithPopup(auth, googleProvider);

        // Get role from Realtime Database
        const role = await getUserRole(result.user.uid);

        // Check if it's the main admin email
        const finalRole = resolveRole(result.user.email || '', role);

        // Update user in Realtime Database and return user data
        await createOrUpdateUserInDB(result.user, finalRole);

        // Enforce ban/deletion using the authoritative Realtime DB data BEFORE
        // completing the login so banned users see a clear, actionable message.
        const user = await getUserFromRealtimeDB(result.user.uid);
        if (!user) {
            throw new Error('فشل تسجيل الدخول، يرجى المحاولة لاحقاً');
        }
        // Ban check BEFORE deletion check so banned users see the correct ban message
        if (user.isBanned && Date.now() < (user.banExpiresAt || 0)) {
            throw new Error(buildBanMessage(user));
        }
        if (user.isDeleted) {
            throw new Error('تم حظر هذا الحساب. راجع مدير الموقع.');
        }
        // Auto-unban if the ban has already expired.
        if (user.isBanned && Date.now() >= (user.banExpiresAt || 0)) {
            try {
                await unbanUser(user.id);
            } catch (e) {
                console.warn('Failed to auto-unban expired ban on login:', e);
            }
            user.isBanned = false;
        }

        return user;
    } catch (error: any) {
        console.error('Google login error:', error);
        // Preserve custom ban/deletion messages that carry no Firebase error code.
        if (error?.message && !error?.code) {
            throw error;
        }
        throw new Error(getAuthErrorMessage(error.code));
    }
};

// Sign Out
export const logout = async (): Promise<void> => {
    try {
        await signOut(auth);
    } catch (error: any) {
        console.error('Logout error:', error);
        throw new Error(getAuthErrorMessage(error.code));
    }
};

export const getCurrentUser = () => auth.currentUser;

// Password Reset
export const resetPassword = async (email: string): Promise<void> => {
    try {
        // Check if email is valid format
        if (!email || !email.includes('@')) {
            throw new Error('البريد الإلكتروني غير صالح');
        }

        // Determine the sign-in providers for this email.
        // NOTE: When "Email Enumeration Protection" is enabled in the Firebase
        // console (the default for most modern projects), fetchSignInMethodsForEmail
        // returns an EMPTY array for BOTH existing and non-existing emails (or throws
        // auth/email-verification-required). We must never treat an empty result as
        // "account does not exist", otherwise legitimately registered users (e.g.
        // Google-only accounts) would wrongly see "لا يوجد حساب مسجل".
        let signInMethods: string[] = [];
        let enumerationProtected = false;

        try {
            signInMethods = await fetchSignInMethodsForEmail(auth, email);
        } catch (e: any) {
            if (e?.code === 'auth/email-verification-required') {
                // Email enumeration protection is enabled - we cannot know the
                // available providers, so proceed to send the reset email.
                enumerationProtected = true;
            } else if (e?.code) {
                // Other Firebase Auth errors (network, invalid-email, etc.) bubble up.
                throw e;
            } else {
                console.warn('Unexpected error fetching sign-in methods:', e);
            }
        }

        // Only when enumeration protection is OFF and we actually know the account
        // exists with a federated provider (e.g. Google) do we inform the user.
        if (!enumerationProtected && signInMethods.length > 0 && !signInMethods.includes('password')) {
            throw new Error('هذا الحساب مسجل بتسجيل الدخول بواسطة جوجل. يرجى استخدام جوجل لتسجيل الدخول، ثم الانتقال إلى ملفك الشخصي لتعيين كلمة مرور لكي تتمكن من استخدام إعادة تعيين كلمة المرور.');
        }

        // Send the password reset email via Firebase. Firebase intentionally does
        // not throw for non-existent emails (for security reasons), so we always
        // report success here. This also safely covers Google-only accounts.
        await sendPasswordResetEmail(auth, email);

        console.log('Password reset email sent successfully to:', email);
    } catch (error: any) {
        console.error('Password reset error:', error);

        // If it's already our custom error (no Firebase error code), pass it through
        if (!error.code) {
            throw error;
        }

        // Handle specific Firebase Auth errors
        if (error.code === 'auth/invalid-email') {
            throw new Error('البريد الإلكتروني غير صالح');
        }
        if (error.code === 'auth/email-verification-required') {
            // Should have been handled above, but be safe.
            throw new Error('تعذر التحقق من البريد الإلكتروني، يرجى المحاولة مرة أخرى');
        }
        if (error.code === 'auth/user-not-found') {
            // Firebase doesn't actually throw this error for security reasons,
            // but we keep it for completeness.
            throw new Error('لا يوجد حساب مرتبط بهذا البريد الإلكتروني');
        }
        if (error.code === 'auth/too-many-requests') {
            throw new Error('تم حظر الحساب مؤقتاً، يرجى المحاولة لاحقاً');
        }
        if (error.code === 'auth/network-request-failed') {
            throw new Error('فشل الاتصال بالإنترنت');
        }

        throw new Error(getAuthErrorMessage(error.code));
    }
};

// Auth State Observer - This is the key to Single Source of Truth for Auth
// Firebase Auth → Realtime DB → Zustand → UI
// Includes timeout, retry, and offline cache fallback
export const onAuthChange = (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
            // When the device is offline, skip the network fetch entirely and use
            // the cached session immediately to avoid flooding the console with
            // failed requests and an unnecessary timeout wait.
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
                const cached = getCachedUser();
                if (cached) {
                    console.warn('Offline - using cached session');
                    callback(cached.user);
                    return;
                }
            }

            try {
                // Try to fetch fresh user data with timeout and retries
                let user = await withTimeout(
                    fetchUserWithRetry(firebaseUser),
                    AUTH_TIMEOUT_MS
                );

                // Cache the fresh data on success
                setCachedUser(user);
                callback(user);
            } catch (error) {
                // If network failed, try cached user data as fallback.
                // A timeout/network failure is expected when offline, so log it as
                // a warning instead of an error to keep the console clean.
                const cached = getCachedUser();
                if (cached) {
                    console.warn('Network unavailable - using cached session');
                    callback(cached.user);
                } else {
                    console.error('Auth state change error:', error);
                    // No cache available -> treat as logged out
                    callback(null);
                }
            }
        } else {
            // Firebase Auth reports no user -> clear cache and notify
            removeCachedUser();
            callback(null);
        }
    });
};

// Get error message in Arabic
const getAuthErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
        case 'auth/email-already-in-use':
            return 'البريد الإلكتروني مسجل بالفعل';
        case 'auth/invalid-email':
            return 'البريد الإلكتروني غير صالح';
        case 'auth/operation-not-allowed':
            return 'العملية غير مسموحة';
        case 'auth/weak-password':
            return 'كلمة المرور ضعيفة جداً';
        case 'auth/user-disabled':
            return 'الحساب معطل';
        case 'auth/user-not-found':
            return 'المستخدم غير موجود';
        case 'auth/wrong-password':
            return 'كلمة المرور غير صحيحة';
        case 'auth/invalid-credential':
            return 'بيانات الاعتماد غير صالحة';
        case 'auth/popup-closed-by-user':
            return 'تم إغلاق نافذة جوجل';
        case 'auth/account-exists-with-different-credential':
            return 'يوجد حساب بنفس البريد الإلكتروني';
        case 'auth/network-request-failed':
            return 'فشل الاتصال بالإنترنت';
        default:
            return 'حدث خطأ في المصادقة';
    }
};

/**
 * Get all users from Firestore (for admin dashboard Modal list).
 * Using Firestore because Realtime Database rules don't allow reading all users at once.
 * Added maxResults parameter for scalability (default: 1000, max: 5000)
 */
export const getAllUsers = async (maxResults: number = 1000): Promise<User[]> => {
    const safeLimit = Math.min(Math.max(1, maxResults), 5000);
    try {
        const usersRef = collection(db, 'users');
        const q = safeLimit < 5000 ? query(usersRef, limit(safeLimit)) : usersRef;
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const users: User[] = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data() as {
                    name?: string;
                    displayName?: string;
                    email?: string;
                    role?: UserRole;
                    isDeleted?: boolean;
                    isBanned?: boolean;
                    bannedAt?: number;
                    banExpiresAt?: number
                };
                users.push({
                    id: docSnap.id,
                    name: data.name || data.displayName || 'مستخدم',
                    email: data.email || '',
                    role: data.role || 'student',
                    isDeleted: data.isDeleted,
                    isBanned: data.isBanned,
                    bannedAt: data.bannedAt,
                    banExpiresAt: data.banExpiresAt
                });
            });
            return users;
        }

        return [];
    } catch (error) {
        console.error('Error getting all users from Firestore:', error);
        return [];
    }
};

/**
 * Get only the users count from Firestore (for admin dashboard stats).
 * This avoids building the full users array in memory.
 */
export const getUsersCount = async (): Promise<number> => {
    try {
        const usersRef = collection(db, 'users');
        const snapshot = await getDocs(usersRef);
        return snapshot.size;
    } catch (error) {
        console.warn('Error getting users count:', error);
        return 0;
    }
};

// Update user role (for admin users).
// SECURITY: This client-side guard is defense-in-depth only. The authoritative
// enforcement MUST live in Firebase Realtime DB + Firestore security rules so a
// malicious client cannot change any role. Additionally, a user can never change
// their own role (prevents self-lockout / privilege escalation).
export const updateUserRole = async (userId: string, role: UserRole): Promise<void> => {
    try {
        const currentUid = auth.currentUser?.uid;
        if (!currentUid) {
            throw new Error('يجب تسجيل الدخول لتغيير الصلاحيات');
        }
        // Prevent a user from changing their own role (self-lockout / escalation)
        if (currentUid === userId) {
            throw new Error('لا يمكنك تغيير صلاحيتك الخاصة');
        }
        // Prevent demoting the main owner account (check isPermanentAdmin flag)
        let targetUser;
        try {
            targetUser = await getUserFromRealtimeDB(userId);
        } catch (e) {
            // If we can't read the user from Realtime DB, check Firestore as fallback
            const firestoreDoc = await getDoc(doc(db, 'users', userId));
            if (firestoreDoc.exists()) {
                targetUser = firestoreDoc.data() as User;
            }
        }
        if (targetUser?.isPermanentAdmin && role === 'student') {
            throw new Error('لا يمكن إلغاء صلاحيات حساب المالك الأساسي');
        }
        await update(ref(database, `users/${userId}`), {
            role,
            updatedAt: Date.now()
        });
        // Also update Firestore
        try {
            await setDoc(doc(db, 'users', userId), { role, updatedAt: Date.now() }, { merge: true });
        } catch (e) {
            console.warn('Failed to update Firestore user role:', e);
        }
    } catch (error) {
        console.error('Error updating user role:', error);
        throw error;
    }
};

// Ban a user for a specific duration (0 = permanent)
export const banUser = async (userId: string, banExpiresAt: number): Promise<void> => {
    try {
        const now = Date.now();
        // Capture the user's current role so it can be restored on unban.
        let current;
        try {
            current = await getUserFromRealtimeDB(userId);
        } catch (e) {
            // Fallback to Firestore if Realtime DB is inaccessible
            const firestoreDoc = await getDoc(doc(db, 'users', userId));
            current = firestoreDoc.exists() ? (firestoreDoc.data() as User) : null;
        }
        const previousRole: UserRole = current?.role || 'student';
        // Mark as banned in Firestore
        await setDoc(doc(db, 'users', userId), {
            isBanned: true,
            bannedAt: now,
            banExpiresAt: banExpiresAt,
            role: 'student',
            roleBeforeBan: previousRole,
            updatedAt: now
        }, { merge: true });

        // Mark as banned in Realtime Database
        await update(ref(database, `users/${userId}`), {
            isBanned: true,
            bannedAt: now,
            banExpiresAt: banExpiresAt,
            role: 'student',
            roleBeforeBan: previousRole,
            updatedAt: now
        });
    } catch (error) {
        console.error('Error banning user:', error);
        throw error;
    }
};

// Unban a user (remove ban flags)
export const unbanUser = async (userId: string): Promise<void> => {
    try {
        const now = Date.now();
        // Restore the role the user had before the ban (fallback to student) so
        // that admins/teachers are not permanently demoted to student on unban.
        let current;
        try {
            current = await getUserFromRealtimeDB(userId);
        } catch (e) {
            // Fallback to Firestore if Realtime DB is inaccessible
            const firestoreDoc = await getDoc(doc(db, 'users', userId));
            current = firestoreDoc.exists() ? (firestoreDoc.data() as User) : null;
        }
        const restoredRole: UserRole = current?.roleBeforeBan || current?.role || 'student';
        // Clear ban flags in Firestore
        await setDoc(doc(db, 'users', userId), {
            isBanned: false,
            bannedAt: null,
            banExpiresAt: null,
            role: restoredRole,
            updatedAt: now
        }, { merge: true });

        // Clear ban flags in Realtime Database
        await update(ref(database, `users/${userId}`), {
            isBanned: false,
            bannedAt: null,
            banExpiresAt: null,
            role: restoredRole,
            updatedAt: now
        });
    } catch (error) {
        console.error('Error unbanning user:', error);
        throw error;
    }
};

// Upload a profile picture to Firebase Storage and persist its download URL on
// the user record (Realtime DB + Firestore mirror). Reuses the same storage
// upload pattern as courseFilesService. The previous picture (if any) is
// removed from Storage to avoid orphaned blobs.
export const uploadProfilePicture = async (file: File, uid: string): Promise<string> => {
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    if (!file.type.startsWith('image/')) {
        throw new Error('يرجى اختيار ملف صورة صالح');
    }
    if (file.size > MAX_SIZE) {
        throw new Error('يجب ألا يتجاوز حجم الصورة 2 ميجابايت');
    }

    // Remove the previously uploaded picture (best-effort) to avoid orphans.
    try {
        let current;
        try {
            current = await getUserFromRealtimeDB(uid);
        } catch (e) {
            // Fallback to Firestore if Realtime DB is inaccessible
            const firestoreDoc = await getDoc(doc(db, 'users', uid));
            current = firestoreDoc.exists() ? (firestoreDoc.data() as User) : null;
        }
        if (current?.photoURL) {
            await deleteObject(storageRef(storage, current.photoURL));
        }
    } catch {
        // Ignore cleanup failures - the upload must still proceed.
    }

    const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const storagePath = `profilePics/${uid}/${fileId}.${extension}`;
    const storageReference = storageRef(storage, storagePath);

    try {
        await uploadBytesResumable(storageReference, file);
        const downloadURL = await getDownloadURL(storageReference);

        // Persist on both databases (mirror) so the header and profile stay in sync.
        await update(ref(database, `users/${uid}`), {
            photoURL: downloadURL,
            updatedAt: Date.now()
        });
        try {
            await setDoc(doc(db, 'users', uid), { photoURL: downloadURL, updatedAt: Date.now() }, { merge: true });
        } catch (e) {
            console.warn('Failed to sync profile picture to Firestore:', e);
        }

        return downloadURL;
    } catch (error) {
        try { await deleteObject(storageReference); } catch { }
        throw error instanceof Error ? error : new Error('فشل رفع صورة الملف الشخصي');
    }
};

// Update editable profile fields (display name and bio) on both databases.
// Reuses the same dual-write (Realtime DB + Firestore mirror) pattern used
// elsewhere in this service.
export const updateUserProfile = async (
    userId: string,
    updates: { name?: string; bio?: string }
): Promise<void> => {
    if (!userId) throw new Error('يجب تسجيل الدخول لتحديث الملف الشخصي');
    const payload: Record<string, any> = { updatedAt: Date.now() };
    if (typeof updates.name === 'string') {
        payload.name = updates.name.trim() || 'مستخدم';
    }
    if (typeof updates.bio === 'string') {
        payload.bio = updates.bio;
    }
    await update(ref(database, `users/${userId}`), payload);
    try {
        await setDoc(doc(db, 'users', userId), payload, { merge: true });
    } catch (e) {
        console.warn('Failed to sync profile update to Firestore:', e);
    }
};
