import { UserRole } from '../../types';

export const ROLE_CONFIG: Record<UserRole, { label: string; badgeClass: string }> = {
    student: { label: 'طالب', badgeClass: 'bg-blue-100 text-blue-800' },
    admin: { label: 'مدير', badgeClass: 'bg-purple-100 text-purple-800' },
};

export const MODAL_LABELS = {
    university: 'إضافة جامعة',
    college: 'إضافة كلية',
    major: 'إضافة تخصص',
    course: 'إضافة مسار',
    users: 'إدارة المستخدمين',
} as const;

export const MODAL_PLACEHOLDERS = {
    university: 'اسم الجامعة الجديدة',
    college: 'اسم الكلية الجديدة',
    major: 'اسم التخصص الجديد',
    course: 'اسم المسار الجديد',
} as const;

export const MODAL_LABEL_ARABIC = {
    university: 'اسم الجامعة',
    college: 'اسم الكلية',
    major: 'اختر التخصص',
    course: 'اختر المسار',
    selectUniversity: 'اختر الجامعة...',
    selectCollege: 'اختر الكلية...',
    selectMajor: 'اختر التخصص...',
    selectUniversityForCollege: 'اختر الجامعة الأم...',
} as const;
