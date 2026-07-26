import { useAppStore } from '../../stores/appStore';
import { University } from '../../types';
import { useState, useEffect, useRef } from 'react';
import { Building2, Building, GraduationCap, BookOpen } from 'lucide-react';

interface HierarchicalSelectorProps {
    universities: University[];
    fileCounts?: Record<string, number>;
    courseNames?: Record<string, string>;
    courseId?: string;
}

const HierarchicalSelector = ({ universities, fileCounts = {}, courseNames = {}, courseId }: HierarchicalSelectorProps) => {
    const {
        selectedUniversity,
        selectedCollege,
        selectedMajor,
        selectedCourse,
        setSelectedUniversity,
        setSelectedCollege,
        setSelectedMajor,
        setSelectedCourse,
    } = useAppStore();

    const [selectedLevel, setSelectedLevel] = useState('5');
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedUni = universities.find(u => u.id === selectedUniversity);
    const selectedCol = selectedUni?.colleges.find(c => c.id === selectedCollege);
    const selectedMaj = selectedCol?.majors.find(m => m.id === selectedMajor);

    // For accessibility, add aria-label to select elements
    

    // Auto-select course when courseId is provided
    useEffect(() => {
        if (courseId && universities.length > 0 && selectedMaj) {
            const foundCourse = selectedMaj.courses.find(course => course.id === courseId);
            if (foundCourse) {
                // Check if selectedCourse (which is a string ID) already matches
                // selectedCourse is stored as a string ID in appStore, not as a Course object
                if (typeof selectedCourse === 'string') {
                    if (selectedCourse !== courseId) {
                        setSelectedCourse(courseId);
                    }
                } else {
                    // This case should never happen based on appStore types, but added for safety
                    setSelectedCourse(courseId);
                }
            }
        }
    }, [courseId, selectedMaj, selectedCourse, setSelectedCourse]);

    // Auto-select course when courseId is provided
    useEffect(() => {
        if (courseId && universities.length > 0 && selectedMajor && selectedMaj) {
            const foundCourse = selectedMaj.courses.find(course => course.id === courseId);
            if (foundCourse) {
                // Check if selectedCourse (which is a string ID) already matches
                if (selectedCourse !== courseId) {
                    setSelectedCourse(courseId);
                }
            }
        }
    }, [courseId, selectedMaj, selectedCourse, setSelectedCourse]);

    useEffect(() => {
        if (selectedUniversity && !selectedCollege && selectedUni?.colleges.length) {
            setSelectedCollege(selectedUni.colleges[0].id);
        }
    }, [selectedUniversity, selectedUni, setSelectedCollege]);

    useEffect(() => {
        if (selectedCollege && !selectedMajor && selectedCol?.majors.length) {
            setSelectedMajor(selectedCol.majors[0].id);
        }
    }, [selectedCollege, selectedCol, setSelectedMajor]);

    useEffect(() => {
        if (selectedMajor && !selectedCourse && selectedMaj?.courses.length) {
            setSelectedCourse(selectedMaj.courses[0].id);
        }
    }, [selectedMajor, selectedMaj, setSelectedCourse]);

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

    const handleUniversityChange = (value: string) => {
        setSelectedUniversity(value || null);
        setSelectedCollege(null);
        setSelectedMajor(null);
        setSelectedCourse(null);
        setSelectedLevel('5');
    };

    const handleCollegeChange = (value: string) => {
        setSelectedCollege(value || null);
        setSelectedMajor(null);
        setSelectedCourse(null);
    };

    const handleMajorChange = (value: string) => {
        setSelectedMajor(value || null);
        setSelectedCourse(null);
    };

    const handleLevelChange = (value: string) => {
        setSelectedLevel(value);
        setSelectedCourse(null);
    };

    const handleCourseChange = (value: string) => {
        setSelectedCourse(value || null);
    };

    return (
        <div ref={dropdownRef} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-6 hierarchical-selector">
            <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center text-gray-800">
                <Building2 className="h-4 w-4 sm:h-5 sm:w-5 ml-1 sm:ml-2 text-primary-600" />
                اختر مسارك الأكاديمي
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 overflow-hidden">
                <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2 flex items-center">
                        <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1 sm:ml-1 text-black" />
                        الجامعة
                    </label>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setOpenDropdown(openDropdown === 'university' ? null : 'university')}
                            className="w-full p-2 sm:p-3 border-2 border-black rounded-lg bg-white transition-all text-xs sm:text-sm text-black font-bold focus:ring-2 focus:ring-primary-500 focus:border-black flex items-center justify-between"
                        >
                            <span className="truncate">{selectedUni?.name || 'اختر الجامعة'}</span>
                            <svg className="w-3.5 h-3.5 flex-shrink-0 ml-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                        {openDropdown === 'university' && (
                            <ul className="absolute z-20 w-full max-w-[100vw] bg-white border-2 border-black rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto" style={{ left: '0', right: '0' }}>
                                {universities.map((uni) => (
                                    <li key={uni.id} onClick={() => { handleUniversityChange(uni.id); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-xs sm:text-sm text-right truncate font-bold" style={{ color: 'black' }}>
                                        {uni.name}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {selectedUniversity && (
                    <div className="animate-fadeIn">
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                            <Building className="h-4 w-4 ml-1 text-secondary-600" />
                            الكلية
                        </label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setOpenDropdown(openDropdown === 'college' ? null : 'college')}
                                className="w-full p-2 sm:p-3 border-2 border-secondary-300 rounded-lg bg-white transition-all text-xs sm:text-gray-900 font-medium focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 flex items-center justify-between"
                            >
                                <span className="truncate">{selectedCol?.name || 'اختر الكلية'}</span>
                                <svg className="w-3.5 h-3.5 flex-shrink-0 ml-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {openDropdown === 'college' && (
                                <ul className="absolute z-20 w-full max-w-[100vw] bg-white border-2 border-secondary-300 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto" style={{ left: '0', right: '0' }}>
                                    {selectedUni?.colleges.map((col) => (
                                        <li key={col.id} onClick={() => { handleCollegeChange(col.id); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-xs sm:text-sm text-right truncate">
                                            {col.name}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}

                {selectedCollege && (
                    <div className="animate-fadeIn">
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                            <GraduationCap className="h-4 w-4 ml-1 text-accent-600" />
                            التخصص
                        </label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setOpenDropdown(openDropdown === 'major' ? null : 'major')}
                                className="w-full p-2 sm:p-3 border-2 border-accent-300 rounded-lg bg-white transition-all text-xs sm:text-gray-900 font-medium focus:ring-2 focus:ring-accent-500 focus:border-accent-500 flex items-center justify-between"
                            >
                                <span className="truncate">{selectedMaj?.name || 'اختر التخصص'}</span>
                                <svg className="w-3.5 h-3.5 flex-shrink-0 ml-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {openDropdown === 'major' && (
                                <ul className="absolute z-20 w-full max-w-[100vw] bg-white border-2 border-accent-300 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto" style={{ left: '0', right: '0' }}>
                                    {selectedCol?.majors.map((maj) => (
                                        <li key={maj.id} onClick={() => { handleMajorChange(maj.id); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-xs sm:text-sm text-right truncate">
                                            {maj.name}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}

                {selectedMajor && (
                    <div className="animate-fadeIn">
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                            <GraduationCap className="h-4 w-4 ml-1 text-purple-600" />
                            المستوى
                        </label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setOpenDropdown(openDropdown === 'level' ? null : 'level')}
                                className="w-full p-2 sm:p-3 border-2 border-purple-300 rounded-lg bg-white transition-all text-xs sm:text-gray-900 font-medium focus:ring-2 focus:ring-purple-500 focus:border-purple-500 flex items-center justify-between"
                            >
                                <span>{selectedLevel ? `المستوى ${selectedLevel}` : 'اختر المستوى'}</span>
                                <svg className="w-3.5 h-3.5 flex-shrink-0 ml-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {openDropdown === 'level' && (
                                <ul className="absolute z-20 w-full max-w-[100vw] bg-white border-2 border-purple-300 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto" style={{ left: '0', right: '0' }}>
                                    <li onClick={() => { handleLevelChange('1'); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-xs sm:text-sm text-right">المستوى الأول</li>
                                    <li onClick={() => { handleLevelChange('2'); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-xs sm:text-sm text-right">المستوى الثاني</li>
                                    <li onClick={() => { handleLevelChange('3'); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-xs sm:text-sm text-right">المستوى الثالث</li>
                                    <li onClick={() => { handleLevelChange('4'); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-xs sm:text-sm text-right">المستوى الرابع</li>
                                    <li onClick={() => { handleLevelChange('5'); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-xs sm:text-sm text-right">المستوى الخامس</li>
                                </ul>
                            )}
                        </div>
                    </div>
                )}

                {selectedMajor && (
                    <div className="animate-fadeIn">
                        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                            <BookOpen className="h-4 w-4 ml-1 text-primary-600" />
                            المادة
                        </label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setOpenDropdown(openDropdown === 'course' ? null : 'course')}
                                className="w-full p-2 sm:p-3 border-2 border-primary-300 rounded-lg bg-white transition-all text-xs sm:text-gray-900 font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 flex items-center justify-between"
                            >
                                <span className="truncate">{courseNames[selectedCourse || ''] || selectedMaj?.courses.find(c => c.id === selectedCourse)?.name || 'اختر المادة'}</span>
                                <svg className="w-3.5 h-3.5 flex-shrink-0 ml-1 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {openDropdown === 'course' && (
                                <ul className="absolute z-20 w-full max-w-[100vw] bg-white border-2 border-primary-300 rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto" style={{ left: '0', right: '0' }}>
                                    {selectedMaj?.courses.map((course) => (
                                        <li key={course.id} onClick={() => { handleCourseChange(course.id); setOpenDropdown(null); }} className="px-3 py-2 cursor-pointer hover:bg-gray-100 text-xs sm:text-sm text-right truncate">
                                            {courseNames[course.id] || course.name} {fileCounts[course.id] ? `(${fileCounts[course.id]} ملف)` : ''}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HierarchicalSelector;
