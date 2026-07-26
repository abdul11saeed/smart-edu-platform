import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useCatalogStore } from '../../stores/catalogStore';
import { University, College, Major, Course, File as AppFile } from '../../types';
import { uploadCourseFile, getFileType } from '../../services/courseFilesService';
import { auth } from '../../firebase/config';
import { addCourse } from '../../services/dataService';

interface FileUploadFormProps {
    onUploadSuccess?: (file: AppFile) => void;
    courseId?: string;
}

export default function FileUploadForm({ onUploadSuccess, courseId: urlCourseId }: FileUploadFormProps) {
    const { currentCourseFiles, setCurrentCourseFiles, currentUser, addUserFile } = useAppStore();
    const { universities, fetchUniversities, isLoading: catalogLoading } = useCatalogStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [initialized, setInitialized] = useState(false);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);
    const [selectedCollege, setSelectedCollege] = useState<College | null>(null);
    const [selectedMajor, setSelectedMajor] = useState<Major | null>(null);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [professorName, setProfessorName] = useState('');
    const [subjectName, setSubjectName] = useState('');
    const [selectedTerm, setSelectedTerm] = useState<'first' | 'second'>('first');
    const [selectedLevel, setSelectedLevel] = useState<string>('');
    const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('');
    const [description, setDescription] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [hideFormAfterSuccess, setHideFormAfterSuccess] = useState(false);
    const [showManualCourseInput, setShowManualCourseInput] = useState(false);
    const [courseDuplicateWarning, setCourseDuplicateWarning] = useState<string | null>(null);
    const [tags, setTags] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    // Load universities on mount
    useEffect(() => {
        if (universities.length === 0) {
            fetchUniversities();
        }
    }, [universities.length, fetchUniversities]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpenDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Auto-select hierarchy when courseId is provided via URL
    useEffect(() => {
        if (urlCourseId && universities.length > 0 && !initialized) {
            let found = false;
            for (const uni of universities) {
                for (const col of uni.colleges) {
                    for (const maj of col.majors) {
                        const course = maj.courses.find((c: Course) => c.id === urlCourseId);
                        if (course) {
                            setSelectedUniversity(uni);
                            setSelectedCollege(col);
                            setSelectedMajor(maj);
                            setSelectedCourse(course);
                            setSubjectName(course.name);
                            setInitialized(true);
                            found = true;
                            return;
                        }
                    }
                }
                if (found) break;
            }
            if (!found) {
                setInitialized(true);
            }
        }
    }, [urlCourseId, universities, initialized]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setUploadMessage(null);
        }
    };

    const handleUniversityChange = (universityId: string) => {
        const university = universities.find((u) => u.id === universityId);
        setSelectedUniversity(university || null);
        setSelectedCollege(null);
        setSelectedMajor(null);
        setSelectedCourse(null);
        setShowManualCourseInput(false);
    };

    const handleCollegeChange = (collegeId: string) => {
        const college = selectedUniversity?.colleges.find((c) => c.id === collegeId);
        setSelectedCollege(college || null);
        setSelectedMajor(null);
        setSelectedCourse(null);
        setShowManualCourseInput(false);
    };

    const handleMajorChange = (majorId: string) => {
        const major = selectedCollege?.majors.find((m) => m.id === majorId);
        setSelectedMajor(major || null);
        setSelectedCourse(null);
        setShowManualCourseInput(false);
    };

    const handleCourseChange = (courseId: string) => {
        // Check if "manual" option is selected to show manual input
        if (courseId === 'manual') {
            setSelectedCourse(null);
            setShowManualCourseInput(true);
            setSubjectName('');
            setCourseDuplicateWarning(null);
            return;
        }

        // Search in current major's courses
        const courseFromMajor = selectedMajor ? (selectedMajor as any).courses?.find((c: Course) => c.id === courseId) : null;

        if (courseFromMajor) {
            setSelectedCourse(courseFromMajor);
            setSubjectName(courseFromMajor.name);
            setShowManualCourseInput(false);
            setCourseDuplicateWarning(null);
        } else {
            setSelectedCourse(null);
            setShowManualCourseInput(true);
            setCourseDuplicateWarning(null);
        }
    };

    const handleSubjectNameChange = (value: string) => {
        setSubjectName(value);
        
        // Check for duplicate course name in real-time when manual input is shown
        if (showManualCourseInput && selectedMajor && value.trim()) {
            const courses = (selectedMajor as any).courses || [];
            const duplicate = courses.find(
                (c: Course) => c.name.toLowerCase().trim() === value.trim().toLowerCase()
            );
            if (duplicate) {
                setCourseDuplicateWarning(`المقرر "${duplicate.name}" موجود مسبقاً في هذا التخصص. يرجى اختياره من القائمة بدلاً من كتابته.`);
            } else {
                setCourseDuplicateWarning(null);
            }
        } else {
            setCourseDuplicateWarning(null);
        }
    };

    const isSupportedFileType = (fileName: string) => {
        const extension = fileName.split('.').pop()?.toLowerCase() || '';
        return ['txt', 'rtf', 'md', 'markdown', 'csv', 'json', 'html', 'htm', 'xml', 'yaml', 'yml'].includes(extension);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Ensure user is authenticated before attempting upload to satisfy storage rules
        if (!auth?.currentUser) {
            setUploadMessage({ type: 'error', text: 'الرجاء تسجيل الدخول قبل رفع الملفات.' });
            return;
        }

        if (!selectedFile) {
            setUploadMessage({ type: 'error', text: 'الرجاء اختيار ملف للرفع' });
            return;
        }

        if (!selectedUniversity) {
            setUploadMessage({ type: 'error', text: 'الرجاء اختيار الجامعة' });
            return;
        }

        if (!selectedCollege) {
            setUploadMessage({ type: 'error', text: 'الرجاء اختيار الكلية' });
            return;
        }

        if (!selectedMajor) {
            setUploadMessage({ type: 'error', text: 'الرجاء اختيار التخصص' });
            return;
        }

        if (!selectedTerm) {
            setUploadMessage({ type: 'error', text: 'الرجاء اختيار الترم' });
            return;
        }

        if (!selectedLevel) {
            setUploadMessage({ type: 'error', text: 'الرجاء اختيار المستوى' });
            return;
        }

        if (!selectedAcademicYear) {
            setUploadMessage({ type: 'error', text: 'الرجاء اختيار العام الدراسي' });
            return;
        }

        if (!professorName.trim()) {
            setUploadMessage({ type: 'error', text: 'الرجاء إدخال اسم الدكتور' });
            return;
        }

        if (!currentUser) {
            setUploadMessage({ type: 'error', text: 'الرجاء تسجيل الدخول لرفع الملفات' });
            return;
        }

        setIsUploading(true);
        setUploadMessage(null);
        setUploadProgress(0);

        try {
            // Determine effective course ID and name
            let effectiveCourseId: string;
            let effectiveCourseName: string;

            // If course comes from URL parameter - use it directly
            if (urlCourseId) {
                effectiveCourseId = urlCourseId;
                effectiveCourseName = subjectName.trim() || 'مقرر محدد';
            }
            // If course selected from dropdown - use it
            else if (selectedCourse) {
                effectiveCourseId = selectedCourse.id;
                effectiveCourseName = selectedCourse.name;
            }
            // If manual course name entered - check for duplicates first
            else if (subjectName.trim()) {
                const courses = (selectedMajor as any).courses || [];
                const duplicate = courses.find(
                    (c: Course) => c.name.toLowerCase().trim() === subjectName.trim().toLowerCase()
                );
                if (duplicate) {
                    setUploadMessage({
                        type: 'error',
                        text: `المقرر "${duplicate.name}" موجود مسبقاً في هذا التخصص. يرجى اختياره من القائمة.`
                    });
                    return;
                }
                
                // Create new course in Firestore
                const newCourse = await addCourse(
                    selectedUniversity.id,
                    selectedCollege.id,
                    selectedMajor.id,
                    subjectName.trim()
                );
                effectiveCourseId = newCourse.id;
                effectiveCourseName = newCourse.name;
            }
            else {
                setUploadMessage({ type: 'error', text: 'يرجى اختيار أو كتابة اسم المقرر' });
                return;
            }

            // Step 1: Upload file to Firebase Storage + save metadata to Firestore
            const uploadResult = await uploadCourseFile(
                selectedFile,
                currentUser.id,
                currentUser.name,
                currentUser.email || '',
                {
                    universityId: selectedUniversity.id,
                    collegeId: selectedCollege.id,
                    majorId: selectedMajor.id,
                    courseId: effectiveCourseId,
                    universityName: selectedUniversity.name,
                    collegeName: selectedCollege.name,
                    majorName: selectedMajor.name,
                    courseName: effectiveCourseName,
                    professorName: professorName.trim(),
                    term: selectedTerm,
                    level: selectedLevel,
                    academicYear: selectedAcademicYear,
                    description: description.trim(),
                    tags: tags.split(',').map(t => t.trim()).filter(Boolean),
                },
                (progress) => {
                    setUploadProgress(progress);
                },
                currentUser.role
            );

            if (!uploadResult.success) {
                throw new Error(uploadResult.error || 'فشل رفع الملف');
            }

            const url = uploadResult.url!;
            const fileId = uploadResult.fileId!;

            // Create file object for the UI (runtime state only)
            const newFile: AppFile = {
                id: fileId,
                name: selectedFile.name,
                professorId: '',
                size: selectedFile.size,
                url: url,
                type: getFileType(selectedFile.name.split('.').pop()?.toLowerCase() || ''),

                // New nested structure
                owner: {
                    uid: currentUser.id,
                    name: currentUser.name,
                    email: currentUser.email || '',
                },
                university: {
                    id: selectedUniversity.id,
                    name: selectedUniversity.name,
                },
                college: {
                    id: selectedCollege.id,
                    name: selectedCollege.name,
                },
                major: {
                    id: selectedMajor.id,
                    name: selectedMajor.name,
                },
                course: {
                    id: effectiveCourseId,
                    name: effectiveCourseName,
                },

                // Legacy fields for backward compatibility
                uploadedBy: currentUser.id,
                createdAt: new Date().toISOString(),
                universityId: selectedUniversity.id,
                universityName: selectedUniversity.name,
                collegeId: selectedCollege.id,
                collegeName: selectedCollege.name,
                majorId: selectedMajor.id,
                majorName: selectedMajor.name,
                courseId: effectiveCourseId,
                courseName: effectiveCourseName,
                professorName: professorName.trim(),
                fileExtension: selectedFile.name.split('.').pop()?.toLowerCase() || '',
                mimeType: selectedFile.type,
                term: selectedTerm,
                level: selectedLevel,
                academicYear: selectedAcademicYear,
                storageMode: 'firebase',
            };

            // Add to current course files and global user files
            setCurrentCourseFiles([...currentCourseFiles, newFile]);
            addUserFile(newFile);

            setUploadMessage({
                type: 'success',
                text: urlCourseId 
                    ? 'تم رفع الملف بنجاح!' 
                    : selectedCourse 
                        ? 'تم رفع الملف بنجاح!' 
                        : 'تم إنشاء المقرر الجديد ورفع الملف بنجاح!'
            });

            setTimeout(() => {
                setHideFormAfterSuccess(true);
            }, 1500);

            // Reset form
            setSelectedFile(null);
            setSelectedUniversity(null);
            setSelectedCollege(null);
            setSelectedMajor(null);
            setSelectedCourse(null);
            setProfessorName('');
            setSubjectName('');
            setSelectedTerm('first');
            setSelectedLevel('');
            setSelectedAcademicYear('');
            setDescription('');
            setTags('');
            setShowManualCourseInput(false);
            setInitialized(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            onUploadSuccess?.(newFile);
        } catch (error) {
            console.error('Upload error:', error);

            // Provide more specific error messages
            let errorMessage = 'حدث خطأ أثناء رفع الملف. يرجى المحاولة مرة أخرى.';

            if (error instanceof Error) {
                const errorMessageText = error.message;

                if (errorMessageText.includes('انتهت مهلة') || errorMessageText.includes('timeout') || errorMessageText.includes('TIMED_OUT')) {
                    errorMessage = 'استغرق العمل وقتاً أطول من المتوقع. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.';
                } else if (errorMessageText.includes('CORS') || errorMessageText.includes('cors')) {
                    errorMessage = 'خطأ في الإعدادات الأمنية للخادم. يرجى التواصل مع مدير النظام.';
                } else if (errorMessageText.includes('network') || errorMessageText.includes('Network')) {
                    errorMessage = 'خطأ في الاتصال بالإنترنت. يرجى التحقق من اتصالك.';
                } else if (errorMessageText.includes('quota') || errorMessageText.includes('Quota')) {
                    errorMessage = 'تم تجاوز الحد المسموح للتخزين. يرجى المحاولة لاحقاً.';
                } else if (errorMessageText.includes('unauthorized') || errorMessageText.includes('permission')) {
                    errorMessage = 'ليس لديك صلاحيات كافية لرفع الملفات.';
                } else if (errorMessageText.includes('فشل رفع الملف')) {
                    errorMessage = 'فشل رفع الملف إلى التخزين. يرجى التحقق من الملف والمحاولة مرة أخرى.';
                } else if (errorMessageText.includes('فشل الحصول على رابط')) {
                    errorMessage = 'تم الرفع ولكن فشل إنشاء رابط التنزيل. يرجى المحاولة مرة أخرى.';
                }
            }

            setUploadMessage({ type: 'error', text: errorMessage });
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    if (catalogLoading && universities.length === 0) {
        return (
            <div className="max-w-2xl mx-auto p-6 bg-white/90 backdrop-blur-md rounded-2xl border border-brown-200/80 shadow-card">
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">جاري تحميل البيانات...</p>
                </div>
            </div>
        );
    }

    if (hideFormAfterSuccess) {
        return (
            <div className="max-w-2xl mx-auto p-6 bg-white/90 backdrop-blur-md rounded-2xl border border-brown-200/80 shadow-card" dir="rtl">
                <div className="text-center py-10">
                    <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-full flex items-center justify-center mb-4 border border-emerald-200">
                        <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">تم بنجاح!</h3>
                    <p className="text-gray-600 mb-6">تم رفع الملف بنجاح إلى Firebase</p>
                    <button
                        onClick={() => setHideFormAfterSuccess(false)}
                        className="btn btn-primary"
                    >
                        رفع ملف آخر
                    </button>
                </div>
            </div>
        );
    }

    // Get available courses from selected major
    const availableCourses: Course[] = selectedMajor 
        ? (selectedMajor as any).courses || []
        : [];

    return (
        <div ref={dropdownRef} className="max-w-2xl mx-auto p-4 sm:p-6 bg-gradient-to-br from-white/95 via-primary-50/20 to-white/95 backdrop-blur-md rounded-2xl border border-primary-100/40 shadow-xl shadow-primary-500/5 file-upload-form form-container-mobile" dir="rtl">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6 bg-gradient-to-l from-primary-700 to-secondary-600 bg-clip-text text-transparent">رفع ملفات الطالب</h2>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                {/* File Selection */}
                <div>
                    <label className="block text-sm font-semibold text-brown-700 mb-2">
                        اختيار الملف
                    </label>
                    <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 sm:h-36 border-2 border-dashed border-primary-300 rounded-2xl cursor-pointer bg-gradient-to-br from-primary-50/50 to-secondary-50/30 hover:from-primary-100/60 hover:to-secondary-100/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/10 hover:border-primary-400 group">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                                    <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </div>
                                {selectedFile ? (
                                    <p className="text-sm font-medium text-primary-700 bg-primary-50 px-3 py-1 rounded-full">{selectedFile.name}</p>
                                ) : (
                                    <>
                                        <p className="text-sm font-medium text-primary-600">اضغط لاختيار الملف</p>
                                        <p className="text-xs text-primary-400 mt-1">PDF, DOC, PPT, TXT, RTF, MD, CSV, JSON</p>
                                    </>
                                )}
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.rtf,.md,.markdown,.csv,.json,.html,.xml,.yaml,.yml"
                                onChange={handleFileSelect}
                            />
                        </label>
                    </div>
                </div>

                {/* Course Selection - Hierarchical from DB */}
                <div className="space-y-4">
                    {/* When courseId is provided via URL, show clear indication */}
                    {urlCourseId && (
                        <div className="text-sm text-primary-700 bg-gradient-to-r from-primary-50 to-secondary-50/50 p-3 rounded-xl border border-primary-200/60">
                            <strong className="text-primary-800">المقرر محدد من الرابط:</strong> {urlCourseId}
                            <p className="mt-1 text-xs text-primary-500">تم اختيار المسار الأكاديمي تلقائياً. يمكنك تغيير اسم المقرر يدوياً أدناه.</p>
                        </div>
                    )}

                    {/* University Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-brown-700 mb-2">
                            الجامعة <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setOpenDropdown(openDropdown === 'university' ? null : 'university')}
                                className="input flex items-center justify-between !border-brown-200 hover:!border-primary-400 hover:shadow-md hover:shadow-primary-500/10"
                            >
                                <span className="truncate">{selectedUniversity?.name || 'اختر الجامعة'}</span>
                                <svg className="w-4 h-4 flex-shrink-0 ml-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {openDropdown === 'university' && (
                                <ul className="absolute z-20 w-full max-w-[100vw] bg-white border border-gray-300 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto" style={{ left: '0', right: '0' }}>
                                    {universities.map((uni) => (
                                        <li key={uni.id} onClick={() => { handleUniversityChange(uni.id); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm text-right truncate">
                                            {uni.name}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* College Selection - always visible, disabled until university selected */}
                    <div>
                        <label className="block text-sm font-semibold text-brown-700 mb-2">
                            الكلية <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <button
                                type="button"
                                disabled={!selectedUniversity}
                                onClick={() => selectedUniversity && setOpenDropdown(openDropdown === 'college' ? null : 'college')}
                                className={`input flex items-center justify-between !border-brown-200 hover:!border-primary-400 hover:shadow-md hover:shadow-primary-500/10 ${!selectedUniversity ? '!bg-brown-100/50 !border-brown-200 !text-brown-400 cursor-not-allowed' : ''}`}
                            >
                                <span className="truncate">{selectedCollege?.name || (selectedUniversity ? 'اختر الكلية' : 'اختر الجامعة أولاً')}</span>
                                <svg className="w-4 h-4 flex-shrink-0 ml-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {openDropdown === 'college' && selectedUniversity && (
                                <ul className="absolute z-20 w-full max-w-[100vw] bg-white border border-gray-300 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto" style={{ left: '0', right: '0' }}>
                                    {selectedUniversity.colleges.map((col) => (
                                        <li key={col.id} onClick={() => { handleCollegeChange(col.id); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm text-right truncate">
                                            {col.name}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Major Selection - always visible, disabled until college selected */}
                    <div>
                        <label className="block text-sm font-semibold text-brown-700 mb-2">
                            التخصص <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <button
                                type="button"
                                disabled={!selectedCollege}
                                onClick={() => selectedCollege && setOpenDropdown(openDropdown === 'major' ? null : 'major')}
                                className={`input flex items-center justify-between !border-brown-200 hover:!border-primary-400 hover:shadow-md hover:shadow-primary-500/10 ${!selectedCollege ? '!bg-brown-100/50 !border-brown-200 !text-brown-400 cursor-not-allowed' : ''}`}
                            >
                                <span className="truncate">{selectedMajor?.name || (selectedCollege ? 'اختر التخصص' : 'اختر الكلية أولاً')}</span>
                                <svg className="w-4 h-4 flex-shrink-0 ml-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {openDropdown === 'major' && selectedCollege && (
                                <ul className="absolute z-20 w-full max-w-[100vw] bg-white border border-gray-300 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto" style={{ left: '0', right: '0' }}>
                                    {selectedCollege.majors.map((maj) => (
                                        <li key={maj.id} onClick={() => { handleMajorChange(maj.id); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm text-right truncate">
                                            {maj.name}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>

                    {/* Course Selection - appears after major is selected */}
                    {selectedMajor && !urlCourseId && (
                        <div>
                            <label className="block text-sm font-semibold text-brown-700 mb-2">
                                المقرر <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setOpenDropdown(openDropdown === 'course' ? null : 'course')}
                                    className="input flex items-center justify-between !border-brown-200 hover:!border-primary-400 hover:shadow-md hover:shadow-primary-500/10"
                                >
                                    <span className="truncate">{selectedCourse ? availableCourses.find(c => c.id === selectedCourse.id)?.name : (availableCourses.length > 0 ? 'اختر المقرر' : 'لا توجد مقررات متاحة')}</span>
                                    <svg className="w-4 h-4 flex-shrink-0 ml-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </button>
                                {openDropdown === 'course' && (
                                    <ul className="absolute z-20 w-full max-w-[100vw] bg-white border border-gray-300 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto" style={{ left: '0', right: '0' }}>
                                        {availableCourses.map((course) => (
                                            <li key={course.id} onClick={() => { handleCourseChange(course.id); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm text-right truncate">
                                                {course.name}
                                            </li>
                                        ))}
                                        <li onClick={() => { handleCourseChange('manual'); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm text-right truncate">
                                            مقرر جديد (اكتب اسم المقرر)
                                        </li>
                                    </ul>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Manual Course Name Input - appears when "manual" option is selected */}
                    {showManualCourseInput && (
                        <div>
                            <label className="block text-sm font-semibold text-brown-700 mb-2">
                                اسم المقرر الجديد <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={subjectName}
                                onChange={(e) => handleSubjectNameChange(e.target.value)}
                                placeholder="أدخل اسم المقرر (مثل: الرياضيات المتقدمة)"
                                className={`input ${courseDuplicateWarning ? 'border-error-500 bg-error-50 focus:ring-error-500/50 focus:border-error-500' : ''}`}
                                required
                            />
                            {courseDuplicateWarning && (
                                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <p className="text-sm text-yellow-700 flex items-center gap-2">
                                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                        </svg>
                                        {courseDuplicateWarning}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Term/Semester Selection */}
                <div>
                    <label className="block text-sm font-semibold text-brown-700 mb-2">
                        الترم <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setOpenDropdown(openDropdown === 'term' ? null : 'term')}
                            className="input flex items-center justify-between !border-brown-200 hover:!border-primary-400 hover:shadow-md hover:shadow-primary-500/10"
                        >
                            <span>{selectedTerm === 'first' ? 'الترم الأول' : selectedTerm === 'second' ? 'الترم الثاني' : 'اختر الترم'}</span>
                            <svg className="w-4 h-4 flex-shrink-0 ml-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        {openDropdown === 'term' && (
                            <ul className="absolute z-20 w-full max-w-[100vw] bg-white border border-gray-300 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto" style={{ left: '0', right: '0' }}>
                                <li onClick={() => { setSelectedTerm('first'); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm text-right">الترم الأول</li>
                                <li onClick={() => { setSelectedTerm('second'); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm text-right">الترم الثاني</li>
                            </ul>
                        )}
                    </div>
                </div>

                {/* Level Selection (1-5) */}
                <div>
                    <label className="block text-sm font-semibold text-brown-700 mb-2">
                        المستوى <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setOpenDropdown(openDropdown === 'level' ? null : 'level')}
                            className="input flex items-center justify-between !border-brown-200 hover:!border-primary-400 hover:shadow-md hover:shadow-primary-500/10"
                        >
                            <span>{selectedLevel ? `المستوى ${selectedLevel}` : 'اختر المستوى'}</span>
                            <svg className="w-4 h-4 flex-shrink-0 ml-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        {openDropdown === 'level' && (
                            <ul className="absolute z-20 w-full max-w-[100vw] bg-white border border-gray-300 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto" style={{ left: '0', right: '0' }}>
                                <li onClick={() => { setSelectedLevel(''); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm text-right">اختر المستوى</li>
                                <li onClick={() => { setSelectedLevel('1'); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm text-right">المستوى الأول</li>
                                <li onClick={() => { setSelectedLevel('2'); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm text-right">المستوى الثاني</li>
                                <li onClick={() => { setSelectedLevel('3'); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm text-right">المستوى الثالث</li>
                                <li onClick={() => { setSelectedLevel('4'); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm text-right">المستوى الرابع</li>
                                <li onClick={() => { setSelectedLevel('5'); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm text-right">المستوى الخامس</li>
                            </ul>
                        )}
                    </div>
                </div>

                {/* Academic Year Selection - Year Input */}
                <div>
                    <label className="block text-sm font-semibold text-brown-700 mb-2">
                        العام الدراسي <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="number"
                        aria-label="اختر العام الدراسي"
                        value={selectedAcademicYear}
                        onChange={(e) => setSelectedAcademicYear(e.target.value)}
                        placeholder="مثال: 2025"
                        className="input"
                        min="2000"
                        max="2099"
                        required
                    />
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-semibold text-brown-700 mb-2">
                        الوصف <span className="text-gray-400">(اختياري)</span>
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="أضف ملاحظات أو تفاصيل إضافية..."
                        className="input resize-none"
                        rows={2}
                    />
                </div>

                {/* Tags */}
                <div>
                    <label className="block text-sm font-semibold text-brown-700 mb-2">
                        الوسوم <span className="text-gray-400">(اختياري)</span>
                    </label>
                    <input
                        type="text"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="محاضرة، تدريبات، امتحان (مفصولة بفاصلة)"
                        className="input"
                    />
                </div>

                {/* Doctor Name - Manual Input */}
                <div>
                    <label className="block text-sm font-semibold text-brown-700 mb-2">
                        اسم الدكتور المدرس للمادة <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={professorName}
                        onChange={(e) => setProfessorName(e.target.value)}
                        placeholder="أدخل اسم الدكتور"
                        className="input"
                        required
                    />
                </div>

                {/* Upload Progress */}
                {isUploading && (
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm font-medium"
                        style={{ color: '#7B4D2A' }}>
                            <span>{uploadProgress >= 100 ? 'جاري حفظ البيانات...' : 'جاري الرفع...'}</span>
                            <span className="text-primary-700">{uploadProgress}%</span>
                        </div>
                        <div className="progress-bar-modern">
                            <div
                                className="progress-bar-modern-fill"
                                style={{ width: `${uploadProgress}%` }}
                            ></div>
                        </div>
                        {uploadProgress >= 100 && (
                            <p className="text-xs text-primary-600 text-center font-medium">
                                تم اكتمال الرفع، جاري حفظ البيانات في قاعدة البيانات...
                            </p>
                        )}
                        {uploadProgress > 0 && uploadProgress < 100 && (
                            <p className="text-xs text-brown-400 text-center">
                                يرجى الانتظار حتى اكتمال الرفع
                            </p>
                        )}
                    </div>
                )}

                {/* Upload Message */}
                {uploadMessage && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 ${uploadMessage.type === 'success'
                        ? 'bg-gradient-to-r from-emerald-50 to-emerald-100/50 text-emerald-800 border border-emerald-200'
                        : 'bg-gradient-to-r from-red-50 to-red-100/50 text-red-800 border border-red-200'
                        }`}>
                        {uploadMessage.type === 'success' ? (
                            <svg className="w-5 h-5 flex-shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5 flex-shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                        <span className="text-sm font-medium">{uploadMessage.text}</span>
                    </div>
                )}

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={isUploading}
                    className="btn btn-primary w-full justify-center"
                >
                    {isUploading ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {uploadProgress >= 100 ? 'جاري حفظ البيانات...' : 'جاري الرفع...'}
                        </>
                    ) : (
                        <span className="flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            رفع الملف
                        </span>
                    )}
                </button>
            </form>
        </div>
    );
}
