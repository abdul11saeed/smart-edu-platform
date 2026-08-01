// Firebase Data Service - Catalog only (universities, colleges, majors, courses)
import { db } from '../firebase/config';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    writeBatch,
} from 'firebase/firestore';
import { University, College, Major, Course, Exam } from '../types';
import { normalizeArabic } from '../utils/searchNormalizer';

// Firestore collections
const UNIVERSITIES_COLLECTION = 'universities';
const TERMS_COLLECTION = 'terms';

function normalizeColleges(uniData: any): College[] {
    if (Array.isArray(uniData.colleges)) return uniData.colleges;
    if (uniData.colleges && typeof uniData.colleges === 'object') {
        return Object.values(uniData.colleges).map((col: any) => {
            if (Array.isArray(col.majors)) return { ...col, majors: col.majors } as College;
            if (col.majors && typeof col.majors === 'object') {
                const majors = Object.values(col.majors).map((maj: any) => {
                    if (Array.isArray(maj.courses)) return { ...maj, courses: maj.courses } as Major;
                    if (maj.courses && typeof maj.courses === 'object') {
                        return { ...maj, courses: Object.values(maj.courses) } as Major;
                    }
                    return { ...maj, courses: [] } as Major;
                });
                return { ...col, majors } as College;
            }
            return { ...col, majors: [] } as College;
        });
    }
    return [];
}

export const getUniversities = async (): Promise<University[]> => {
    try {
        const universitiesRef = collection(db, UNIVERSITIES_COLLECTION);
        const snapshot = await getDocs(universitiesRef);

        if (!snapshot.empty) {
            const universities: University[] = [];
            snapshot.forEach((docSnap) => {
                const uniData = docSnap.data() as University;
                const colleges = normalizeColleges(uniData);
                universities.push({ ...uniData, colleges } as University);
            });
            return universities;
        }
        return [];
    } catch (error: any) {
        console.error('Error fetching universities:', error);
        return [];
    }
};

export const subscribeToUniversities = (
    callback: (universities: University[]) => void
): (() => void) => {
    const universitiesRef = collection(db, UNIVERSITIES_COLLECTION);

    const timeoutId = setTimeout(() => {
        callback([]);
    }, 10000);

    const unsubscribe = onSnapshot(universitiesRef, (snapshot) => {
        clearTimeout(timeoutId);
        if (!snapshot.empty) {
            const universities: University[] = [];
            snapshot.forEach((docSnap) => {
                const uniData = docSnap.data() as University;
                const colleges = normalizeColleges(uniData);
                universities.push({ ...uniData, colleges } as University);
            });
            callback(universities);
        } else {
            callback([]);
        }
    }, (error: any) => {
        clearTimeout(timeoutId);
        console.warn('Firebase subscribe error:', error);
        callback([]);
    });

    return () => {
        clearTimeout(timeoutId);
        unsubscribe();
    };
};

export const addUniversity = async (name: string): Promise<University> => {
    const universityId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const newUniversity: University = {
        id: universityId,
        name,
        colleges: []
    };

    try {
        // Check for duplicate university name before adding
        const universitiesRef = collection(db, UNIVERSITIES_COLLECTION);
        const snapshot = await getDocs(universitiesRef);
        const normalizedInput = name.toLowerCase().trim();
        const duplicate = snapshot.docs.find(docSnap => {
            const data = docSnap.data() as University;
            return (data.name || '').toLowerCase().trim() === normalizedInput;
        });

        if (duplicate) {
            throw new Error('الجامعة موجودة مسبقاً، يرجى اختيارها من القائمة');
        }

        const uniDocRef = doc(db, UNIVERSITIES_COLLECTION, universityId);
        await setDoc(uniDocRef, newUniversity);
        return newUniversity;
    } catch (error: any) {
        console.error('Error adding university:', error);
        throw error;
    }
};

export const addCollege = async (universityId: string, name: string): Promise<College> => {
    const collegeId = `${Date.now()}`;
    const newCollege: College = {
        id: collegeId,
        name,
        majors: []
    };

    try {
        const uniDocRef = doc(db, UNIVERSITIES_COLLECTION, universityId);
        const uniDoc = await getDoc(uniDocRef);

        if (uniDoc.exists()) {
            const uniData = uniDoc.data() as University;
            const existingColleges = uniData.colleges || [];
            const duplicate = existingColleges.find(
                (c) => c.name.toLowerCase().trim() === name.toLowerCase().trim()
            );
            if (duplicate) {
                throw new Error('الكلية موجودة مسبقاً في هذه الجامعة، يرجى اختيارها من القائمة');
            }
            const updatedColleges = [...existingColleges, newCollege];
            await updateDoc(uniDocRef, { colleges: updatedColleges });
        }

        return newCollege;
    } catch (error: any) {
        console.error('Error adding college:', error);
        throw error;
    }
};

export const addMajor = async (universityId: string, collegeId: string, name: string): Promise<Major> => {
    const majorId = `${Date.now()}`;
    const newMajor: Major = {
        id: majorId,
        name,
        courses: []
    };

    try {
        const uniDocRef = doc(db, UNIVERSITIES_COLLECTION, universityId);
        const uniDoc = await getDoc(uniDocRef);

        if (uniDoc.exists()) {
            const uniData = uniDoc.data() as University;
            const colleges = uniData.colleges || [];
            const collegeIndex = colleges.findIndex(c => c.id === collegeId);

            if (collegeIndex >= 0) {
                const updatedColleges = [...colleges];
                const collegeMajors = updatedColleges[collegeIndex].majors || [];
                const duplicate = collegeMajors.find(
                    (m) => m.name.toLowerCase().trim() === name.toLowerCase().trim()
                );
                if (duplicate) {
                    throw new Error('التخصص موجود مسبقاً في هذه الكلية، يرجى اختياره من القائمة');
                }
                updatedColleges[collegeIndex] = {
                    ...updatedColleges[collegeIndex],
                    majors: [...collegeMajors, newMajor]
                };
                await updateDoc(uniDocRef, { colleges: updatedColleges });
            }
        }

        return newMajor;
    } catch (error: any) {
        console.error('Error adding major:', error);
        throw error;
    }
};

export const addCourse = async (
    universityId: string,
    collegeId: string,
    majorId: string,
    name: string,
): Promise<Course> => {
    const courseId = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const newCourse: Course = {
        id: courseId,
        name,
        files: [],
        exams: []
    };

    try {
        const uniDocRef = doc(db, UNIVERSITIES_COLLECTION, universityId);
        const uniDoc = await getDoc(uniDocRef);

        if (uniDoc.exists()) {
            const uniData = uniDoc.data() as University;
            const colleges = [...(uniData.colleges || [])];
            const collegeIndex = colleges.findIndex(c => c.id === collegeId);

            if (collegeIndex >= 0) {
                const majors = [...(colleges[collegeIndex].majors || [])];
                const majorIndex = majors.findIndex(m => m.id === majorId);

                if (majorIndex >= 0) {
                    const courses = [...(majors[majorIndex].courses || [])];
                    const duplicate = courses.find(
                        (c) => c.name.toLowerCase().trim() === name.toLowerCase().trim()
                    );
                    if (duplicate) {
                        throw new Error('المقرر موجود مسبقاً في هذا التخصص، يرجى اختياره من القائمة');
                    }
                    majors[majorIndex] = {
                        ...majors[majorIndex],
                        courses: [...courses, newCourse]
                    };
                    colleges[collegeIndex] = {
                        ...colleges[collegeIndex],
                        majors
                    };
                    await updateDoc(uniDocRef, { colleges });
                }
            }
        }

        return newCourse;
    } catch (error: any) {
        console.error('Error adding course:', error);
        throw error;
    }
};

// ============================================
// DELETE OPERATIONS (catalog items)
// Catalog is stored as a single university document with nested
// colleges -> majors -> courses arrays, so sub-item deletes update
// that single document. University deletion removes the document.
// ============================================

export const deleteUniversity = async (universityId: string): Promise<void> => {
    try {
        const uniDocRef = doc(db, UNIVERSITIES_COLLECTION, universityId);
        await deleteDoc(uniDocRef);
    } catch (error: any) {
        console.error('Error deleting university:', error);
        throw error;
    }
};

export const deleteCollege = async (universityId: string, collegeId: string): Promise<void> => {
    try {
        const uniDocRef = doc(db, UNIVERSITIES_COLLECTION, universityId);
        const uniDoc = await getDoc(uniDocRef);
        if (!uniDoc.exists()) return;
        const uniData = uniDoc.data() as University;
        const colleges = Array.isArray(uniData.colleges) ? uniData.colleges : [];
        const updatedColleges = colleges.filter((c) => c.id !== collegeId);
        await updateDoc(uniDocRef, { colleges: updatedColleges });
    } catch (error: any) {
        console.error('Error deleting college:', error);
        throw error;
    }
};

export const deleteMajor = async (
    universityId: string,
    collegeId: string,
    majorId: string,
): Promise<void> => {
    try {
        const uniDocRef = doc(db, UNIVERSITIES_COLLECTION, universityId);
        const uniDoc = await getDoc(uniDocRef);
        if (!uniDoc.exists()) return;
        const uniData = uniDoc.data() as University;
        const colleges = [...(uniData.colleges || [])];
        const collegeIndex = colleges.findIndex((c) => c.id === collegeId);
        if (collegeIndex >= 0) {
            const updatedColleges = [...colleges];
            updatedColleges[collegeIndex] = {
                ...updatedColleges[collegeIndex],
                majors: (updatedColleges[collegeIndex].majors || []).filter((m) => m.id !== majorId),
            };
            await updateDoc(uniDocRef, { colleges: updatedColleges });
        }
    } catch (error: any) {
        console.error('Error deleting major:', error);
        throw error;
    }
};

export const deleteCourse = async (
    universityId: string,
    collegeId: string,
    majorId: string,
    courseId: string,
): Promise<void> => {
    try {
        const uniDocRef = doc(db, UNIVERSITIES_COLLECTION, universityId);
        const uniDoc = await getDoc(uniDocRef);
        if (!uniDoc.exists()) return;
        const uniData = uniDoc.data() as University;
        const colleges = [...(uniData.colleges || [])];
        const collegeIndex = colleges.findIndex((c) => c.id === collegeId);
        if (collegeIndex >= 0) {
            const majors = [...(colleges[collegeIndex].majors || [])];
            const majorIndex = majors.findIndex((m) => m.id === majorId);
            if (majorIndex >= 0) {
                const courses = (majors[majorIndex].courses || []).filter((c) => c.id !== courseId);
                majors[majorIndex] = { ...majors[majorIndex], courses };
                colleges[collegeIndex] = { ...colleges[collegeIndex], majors };
                await updateDoc(uniDocRef, { colleges });
            }
        }
    } catch (error: any) {
        console.error('Error deleting course:', error);
        throw error;
    }
};

// ============================================
// UPDATE (rename) OPERATIONS (catalog items)
// ============================================

export const updateUniversityName = async (universityId: string, name: string): Promise<void> => {
    try {
        const universitiesRef = collection(db, UNIVERSITIES_COLLECTION);
        const snapshot = await getDocs(universitiesRef);
        const normalizedInput = name.toLowerCase().trim();
        const duplicate = snapshot.docs.find(docSnap => {
            const data = docSnap.data() as University;
            return docSnap.id !== universityId && (data.name || '').toLowerCase().trim() === normalizedInput;
        });

        if (duplicate) {
            throw new Error('الجامعة موجودة مسبقاً، يرجى استخدام اسم آخر');
        }

        const uniDocRef = doc(db, UNIVERSITIES_COLLECTION, universityId);
        await updateDoc(uniDocRef, { name });
    } catch (error: any) {
        console.error('Error updating university name:', error);
        throw error;
    }
};

export const updateCollegeName = async (
    universityId: string,
    collegeId: string,
    name: string,
): Promise<void> => {
    try {
        const uniDocRef = doc(db, UNIVERSITIES_COLLECTION, universityId);
        const uniDoc = await getDoc(uniDocRef);
        if (!uniDoc.exists()) return;
        const uniData = uniDoc.data() as University;
        const colleges = [...(uniData.colleges || [])];
        const collegeIndex = colleges.findIndex((c) => c.id === collegeId);
        if (collegeIndex >= 0) {
            const normalizedInput = name.toLowerCase().trim();
            const duplicate = colleges.find(
                (c) => c.id !== collegeId && (c.name || '').toLowerCase().trim() === normalizedInput
            );
            if (duplicate) {
                throw new Error('الكلية موجودة مسبقاً في هذه الجامعة، يرجى استخدام اسم آخر');
            }
            colleges[collegeIndex] = { ...colleges[collegeIndex], name };
            await updateDoc(uniDocRef, { colleges });
        }
    } catch (error: any) {
        console.error('Error updating college name:', error);
        throw error;
    }
};

export const updateMajorName = async (
    universityId: string,
    collegeId: string,
    majorId: string,
    name: string,
): Promise<void> => {
    try {
        const uniDocRef = doc(db, UNIVERSITIES_COLLECTION, universityId);
        const uniDoc = await getDoc(uniDocRef);
        if (!uniDoc.exists()) return;
        const uniData = uniDoc.data() as University;
        const colleges = [...(uniData.colleges || [])];
        const collegeIndex = colleges.findIndex((c) => c.id === collegeId);
        if (collegeIndex >= 0) {
            const majors = [...(colleges[collegeIndex].majors || [])];
            const majorIndex = majors.findIndex((m) => m.id === majorId);
            if (majorIndex >= 0) {
                const normalizedInput = name.toLowerCase().trim();
                const duplicate = majors.find(
                    (m) => m.id !== majorId && (m.name || '').toLowerCase().trim() === normalizedInput
                );
                if (duplicate) {
                    throw new Error('التخصص موجود مسبقاً في هذه الكلية، يرجى استخدام اسم آخر');
                }
                majors[majorIndex] = { ...majors[majorIndex], name };
                colleges[collegeIndex] = { ...colleges[collegeIndex], majors };
                await updateDoc(uniDocRef, { colleges });
            }
        }
    } catch (error: any) {
        console.error('Error updating major name:', error);
        throw error;
    }
};

export const updateCourseName = async (
    universityId: string,
    collegeId: string,
    majorId: string,
    courseId: string,
    name: string,
): Promise<void> => {
    try {
        const uniDocRef = doc(db, UNIVERSITIES_COLLECTION, universityId);
        const uniDoc = await getDoc(uniDocRef);
        if (!uniDoc.exists()) return;
        const uniData = uniDoc.data() as University;
        const colleges = [...(uniData.colleges || [])];
        const collegeIndex = colleges.findIndex((c) => c.id === collegeId);
        if (collegeIndex >= 0) {
            const majors = [...(colleges[collegeIndex].majors || [])];
            const majorIndex = majors.findIndex((m) => m.id === majorId);
            if (majorIndex >= 0) {
                const courses = [...(majors[majorIndex].courses || [])];
                const courseIndex = courses.findIndex((c) => c.id === courseId);
                if (courseIndex >= 0) {
                    courses[courseIndex] = { ...courses[courseIndex], name };
                    majors[majorIndex] = { ...majors[majorIndex], courses };
                    colleges[collegeIndex] = { ...colleges[collegeIndex], majors };
                    await updateDoc(uniDocRef, { colleges });
                }
            }
        }
    } catch (error: any) {
        console.error('Error updating course name:', error);
        throw error;
    }
};

export const getAllExams = async (): Promise<Exam[]> => {
    try {
        // Exams are stored within courses in the nested structure
        // Return empty array for now as exams are part of the course data
        return [];
    } catch (error) {
        console.error('Error fetching exams:', error);
        return [];
    }
};

export const getCourseById = async (courseId: string): Promise<Course | null> => {
    const universities = await getUniversities();
    for (const uni of universities) {
        const colleges = Array.isArray(uni.colleges) ? uni.colleges : [];
        for (const col of colleges) {
            const majors = Array.isArray(col.majors) ? col.majors : [];
            for (const maj of majors) {
                const courses = Array.isArray(maj.courses) ? maj.courses : [];
                const course = courses.find(c => c.id === courseId);
                if (course) return course;
            }
        }
    }
    return null;
};

export const getCoursePath = async (courseId: string): Promise<{
    university: University | null;
    college: College | null;
    major: Major | null;
    course: Course | null;
}> => {
    const universities = await getUniversities();
    for (const uni of universities) {
        const colleges = Array.isArray(uni.colleges) ? uni.colleges : [];
        for (const col of colleges) {
            const majors = Array.isArray(col.majors) ? col.majors : [];
            for (const maj of majors) {
                const courses = Array.isArray(maj.courses) ? maj.courses : [];
                const course = courses.find(c => c.id === courseId);
                if (course) {
                    return { university: uni, college: col, major: maj, course };
                }
            }
        }
    }
    return { university: null, college: null, major: null, course: null };
};

export const getStatistics = async (
    fileCount: number = 0,
    precomputedUserCount?: number,
    precomputedUniversities?: University[]
): Promise<{
    totalUsers: number;
    totalFiles: number;
    totalUniversities: number;
    totalColleges: number;
    totalMajors: number;
    totalCourses: number;
}> => {
    const universities = precomputedUniversities ?? (await getUniversities());

    let totalUsers = 0;
    if (typeof precomputedUserCount === 'number') {
        // Caller already loaded the users (e.g. AdminDashboard) - reuse the count
        // to avoid a redundant read of the `users` collection on this page.
        totalUsers = precomputedUserCount;
    } else {
        try {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            totalUsers = usersSnapshot.size;
        } catch (error) {
            console.warn('Could not fetch users count:', error);
            totalUsers = 0;
        }
    }

    let totalColleges = 0;
    let totalMajors = 0;
    let totalCourses = 0;

    universities.forEach(uni => {
        const colleges = Array.isArray(uni.colleges) ? uni.colleges : [];
        totalColleges += colleges.length;
        colleges.forEach(col => {
            const majors = Array.isArray(col.majors) ? col.majors : [];
            totalMajors += majors.length;
            majors.forEach(maj => {
                const courses = Array.isArray(maj.courses) ? maj.courses : [];
                totalCourses += courses.length;
            });
        });
    });

    return {
        totalUsers,
        totalFiles: fileCount,
        totalUniversities: universities.length,
        totalColleges,
        totalMajors,
        totalCourses
    };
};

export const updateCourseContent = async (
    universityId: string,
    collegeId: string,
    majorId: string,
    courseId: string,
    exams: Exam[]
): Promise<void> => {
    try {
        const uniDocRef = doc(db, UNIVERSITIES_COLLECTION, universityId);
        const uniDoc = await getDoc(uniDocRef);

        if (!uniDoc.exists()) return;

        const uniData = uniDoc.data() as University;
        const colleges = [...(uniData.colleges || [])];
        const collegeIndex = colleges.findIndex(c => c.id === collegeId);

        if (collegeIndex >= 0) {
            const majors = [...colleges[collegeIndex].majors];
            const majorIndex = majors.findIndex(m => m.id === majorId);

            if (majorIndex >= 0) {
                const courses = [...majors[majorIndex].courses];
                const courseIndex = courses.findIndex(c => c.id === courseId);

                if (courseIndex >= 0) {
                    courses[courseIndex] = {
                        ...courses[courseIndex],
                        exams
                    };
                    majors[majorIndex] = { ...majors[majorIndex], courses };
                    colleges[collegeIndex] = { ...colleges[collegeIndex], majors };
                    await updateDoc(uniDocRef, { colleges });
                }
            }
        }
    } catch (error: any) {
        if (error?.code === 'permission-denied') {
            throw new Error('ليس لديك صلاحية لتحديث المادة.');
        }
        console.error('Error updating course:', error);
        throw error;
    }
};

export const saveUniversities = async (universities: University[]): Promise<void> => {
    try {
        for (const uni of universities) {
            const uniDocRef = doc(db, UNIVERSITIES_COLLECTION, uni.id);
            await setDoc(uniDocRef, uni, { merge: true });
        }
    } catch (error: any) {
        if (error?.code === 'permission-denied') {
            throw new Error('ليس لديك صلاحية لحفظ البيانات.');
        }
        console.error('Error saving universities:', error);
        throw error;
    }
};

export interface Term {
    id: string;
    name: string;
    type: 'first' | 'second';
    year: number;
    isActive: boolean;
    createdAt: number;
}

export const getTerms = async (): Promise<Term[]> => {
    try {
        const termsRef = collection(db, TERMS_COLLECTION);
        const snapshot = await getDocs(query(termsRef));

        if (!snapshot.empty) {
            const terms: Term[] = [];
            snapshot.forEach((docSnap) => {
                terms.push(docSnap.data() as Term);
            });
            return terms.sort((a, b) => b.createdAt - a.createdAt);
        }
        return [];
    } catch (error: any) {
        if (error?.code === 'permission-denied') {
            console.warn('Firebase permission denied for /terms.');
            return [];
        }
        console.error('Error fetching terms:', error);
        return [];
    }
};

export const addTerm = async (type: 'first' | 'second', year: number): Promise<Term> => {
    const termId = `${Date.now()}`;
    const termName = type === 'first' ? 'الترم الأول' : 'الترم الثاني';
    const currentYear = year || new Date().getFullYear();
    const newTerm: Term = {
        id: termId,
        name: `${termName} - ${currentYear}`,
        type,
        year: currentYear,
        isActive: true,
        createdAt: Date.now()
    };

    const termDocRef = doc(db, TERMS_COLLECTION, termId);
    await setDoc(termDocRef, newTerm);
    return newTerm;
};

export const deactivateTerm = async (termId: string): Promise<void> => {
    const termDocRef = doc(db, TERMS_COLLECTION, termId);
    await updateDoc(termDocRef, { isActive: false });
};

// ============================================
// COURSE SEARCH FOR AUTOCOMPLETE
// ============================================

export const searchCourses = async (queryText: string): Promise<Array<{ id: string; name: string; universityName?: string; collegeName?: string; majorName?: string }>> => {
    try {
        const universities = await getUniversities();
        const results: Array<{ id: string; name: string; universityName?: string; collegeName?: string; majorName?: string }> = [];

        const searchLower = normalizeArabic(queryText.toLowerCase().trim());
        if (!searchLower) return [];

        universities.forEach(uni => {
            const colleges = Array.isArray(uni.colleges) ? uni.colleges : [];
            colleges.forEach(col => {
                const majors = Array.isArray(col.majors) ? col.majors : [];
                majors.forEach(maj => {
                    const courses = Array.isArray(maj.courses) ? maj.courses : [];
                    courses.forEach(course => {
                        if (normalizeArabic(course.name.toLowerCase()).includes(searchLower)) {
                            results.push({
                                id: course.id,
                                name: course.name,
                                universityName: uni.name,
                                collegeName: col.name,
                                majorName: maj.name
                            });
                        }
                    });
                });
            });
        });

        return results;
    } catch (error) {
        console.error('Error searching courses:', error);
        return [];
    }
};

// Get all courses for display in admin dashboard
export const getAllCourses = async (): Promise<Array<Course & { universityName?: string; collegeName?: string; majorName?: string }>> => {
    try {
        const universities = await getUniversities();
        const courses: Array<Course & { universityName?: string; collegeName?: string; majorName?: string }> = [];

        universities.forEach(uni => {
            const colleges = Array.isArray(uni.colleges) ? uni.colleges : [];
            colleges.forEach(col => {
                const majors = Array.isArray(col.majors) ? col.majors : [];
                majors.forEach(maj => {
                    const majCourses = Array.isArray(maj.courses) ? maj.courses : [];
                    majCourses.forEach(course => {
                        courses.push({
                            ...course,
                            universityName: uni.name,
                            collegeName: col.name,
                            majorName: maj.name
                        });
                    });
                });
            });
        });

        return courses;
    } catch (error) {
        console.error('Error fetching all courses:', error);
        return [];
    }
};

// ============================================
// RECENT ACTIVITIES (for Admin Dashboard)
// ============================================
// Uses Firestore only to avoid Realtime DB permission issues

export interface Activity {
    id: string;
    type: 'file_upload' | 'user_register' | 'university_add' | 'college_add' | 'major_add' | 'course_add';
    title: string;
    description: string;
    timestamp: number;
    userId?: string;
    userName?: string;
    fileId?: string;
    fileName?: string;
    universityName?: string;
    collegeName?: string;
    majorName?: string;
    courseName?: string;
}

export const getRecentActivities = async (limitCount: number = 10): Promise<Activity[]> => {
    const activities: Activity[] = [];

    try {
        // Get recent file uploads (only non-deleted)
        const filesRef = collection(db, 'courseFiles');
        const filesQuery = query(filesRef, where('isDeleted', '==', false), orderBy('createdAt', 'desc'), limit(limitCount));
        const filesSnapshot = await getDocs(filesQuery);

        filesSnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            activities.push({
                id: `file-${docSnap.id}`,
                type: 'file_upload',
                title: 'تم رفع ملف',
                description: `${data.fileName || data.name || 'ملف'} - ${data.courseName || ''}`,
                timestamp: new Date(data.createdAt || data.uploadedAt || Date.now()).getTime(),
                fileId: docSnap.id,
                fileName: data.fileName || data.name,
                universityName: data.universityName,
                collegeName: data.collegeName,
                majorName: data.majorName,
                courseName: data.courseName
            });
        });
    } catch (error) {
        console.warn('Could not fetch file activities:', error);
    }

    try {
        // Get recent user registrations from Firestore (for admin access)
        const usersRef = collection(db, 'users');
        const usersQuery = query(usersRef, orderBy('createdAt', 'desc'), limit(limitCount));
        const usersSnapshot = await getDocs(usersQuery);

        if (!usersSnapshot.empty) {
            const userEntries: Activity[] = usersSnapshot.docs.map((docSnap) => {
                const data = docSnap.data();
                return {
                    id: `user-${docSnap.id}`,
                    type: 'user_register',
                    title: 'مستخدم جديد سجل',
                    description: data.name || data.displayName || data.email || 'مستخدم',
                    timestamp: data.createdAt || data.lastLogin || Date.now(),
                    userId: docSnap.id,
                    userName: data.name || data.displayName
                };
            });

            // Sort by timestamp and take most recent
            userEntries.sort((a, b) => b.timestamp - a.timestamp);
            activities.push(...userEntries.slice(0, limitCount / 2));
        }
    } catch (error) {
        console.warn('Could not fetch user activities:', error);
    }

    // Sort all activities by timestamp and limit
    return activities
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limitCount);
};

export const deleteRecentActivities = async (): Promise<void> => {
    try {
        const filesRef = collection(db, 'courseFiles');
        const q = query(filesRef, where('isDeleted', '==', false));
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.forEach((docSnap) => {
            batch.update(docSnap.ref, { isDeleted: true });
        });
        await batch.commit();
    } catch (error) {
        console.error('Error deleting recent activities:', error);
        throw error;
    }
};
