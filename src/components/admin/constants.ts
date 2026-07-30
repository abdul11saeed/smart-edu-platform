import { UserRole } from '../../types';

export const ROLE_CONFIG: Record<UserRole, { label: string; badgeClass: string }> = {
    student: { label: 'profile.student', badgeClass: 'bg-blue-100 text-blue-800' },
    admin: { label: 'profile.admin', badgeClass: 'bg-purple-100 text-purple-800' },
};

export const MODAL_LABELS = {
    university: 'admin.addUniversity',
    college: 'admin.addCollege',
    major: 'admin.addMajor',
    course: 'admin.addCourse',
    users: 'admin.manageUsers',
} as const;

export const MODAL_PLACEHOLDERS = {
    university: 'admin.newUniversityName',
    college: 'admin.newCollegeName',
    major: 'admin.newMajorName',
    course: 'admin.newCourseName',
} as const;

export const MODAL_LABEL_ARABIC = {
    university: 'admin.universityName',
    college: 'admin.collegeName',
    major: 'admin.selectMajor',
    course: 'admin.selectCourse',
    selectUniversity: 'admin.selectUniversity',
    selectCollege: 'admin.selectCollege',
    selectMajor: 'admin.selectMajor',
    selectUniversityForCollege: 'admin.selectParentUniversity',
} as const;
