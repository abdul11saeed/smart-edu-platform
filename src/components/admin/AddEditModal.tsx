import React from 'react';
import { X } from 'lucide-react';
import Modal from '../ui/Modal';
import { MODAL_LABELS, MODAL_PLACEHOLDERS, MODAL_LABEL_ARABIC } from './constants';

interface AddEditModalProps {
    activeModal: 'university' | 'college' | 'major' | 'course' | 'users' | null;
    newItemName: string;
    selectedUniversityId: string;
    selectedUniversityForCollege: string;
    selectedCollegeId: string;
    selectedMajorId: string;
    universities: any[];
    isAddingItem: boolean;
    onClose: () => void;
    onNameChange: (value: string) => void;
    onUniversityIdChange: (value: string) => void;
    onUniversityForCollegeChange: (value: string) => void;
    onCollegeChange: (value: string) => void;
    onMajorChange: (value: string) => void;
    onAddItem: () => void;
}

const AddEditModal: React.FC<AddEditModalProps> = ({
    activeModal,
    newItemName,
    selectedUniversityId,
    selectedUniversityForCollege,
    selectedCollegeId,
    selectedMajorId,
    universities,
    isAddingItem,
    onClose,
    onNameChange,
    onUniversityIdChange,
    onUniversityForCollegeChange,
    onCollegeChange,
    onMajorChange,
    onAddItem,
}) => {
    if (!activeModal) return null;

    const isUsersModal = activeModal === 'users';

    return (
        <Modal
            isOpen={true}
            size={isUsersModal ? 'xl' : 'md'}
            onClose={onClose}
        >
            <div className="p-3 sm:p-4 lg:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
                    <h3 className="text-lg font-semibold">
                        {isUsersModal ? MODAL_LABELS.users : MODAL_LABELS[activeModal as keyof typeof MODAL_LABELS]}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                        title="إغلاق"
                    >
                        <X className="h-5 w-5 sm:h-6 sm:w-6" />
                    </button>
                </div>

                {isUsersModal ? null : (
                    <div className="w-full space-y-3 sm:space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1 sm:mb-2">
                                {MODAL_LABEL_ARABIC[activeModal as keyof typeof MODAL_LABEL_ARABIC]}
                            </label>
                            <input
                                type="text"
                                value={newItemName}
                                onChange={(e) => onNameChange(e.target.value)}
                                placeholder={MODAL_PLACEHOLDERS[activeModal as keyof typeof MODAL_PLACEHOLDERS]}
                                className="w-full p-2 sm:p-2.5 border border-neutral-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>

                        {/* University Selection for Major */}
                        {activeModal === 'major' && (
                            <UniversityChainSelect
                                universities={universities}
                                selectedUniversityId={selectedUniversityId}
                                selectedCollegeId={selectedCollegeId}
                                onUniversityChange={onUniversityIdChange}
                                onCollegeChange={onCollegeChange}
                            />
                        )}

                        {/* Course Addition - needs both college and major selection */}
                        {activeModal === 'course' && (
                            <CourseChainSelect
                                universities={universities}
                                selectedUniversityId={selectedUniversityId}
                                selectedCollegeId={selectedCollegeId}
                                selectedMajorId={selectedMajorId}
                                onUniversityChange={onUniversityIdChange}
                                onCollegeChange={onCollegeChange}
                                onMajorChange={onMajorChange}
                            />
                        )}

                        {/* College selection */}
                        {activeModal === 'college' && (
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1 sm:mb-2">
                                    اختر الجامعة الأم لكلية جديدة
                                </label>
                                <select
                                    value={selectedUniversityForCollege}
                                    onChange={(e) => onUniversityForCollegeChange(e.target.value)}
                                    title="اختر الجامعة الأم"
                                    className="w-full p-2 sm:p-2.5 border border-neutral-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                                >
                                    <option value="">اختر الجامعة الأم...</option>
                                    {universities.map((uni) => (
                                        <option key={uni.id} value={uni.id}>{uni.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <button
                            onClick={onAddItem}
                            disabled={isAddingItem}
                            className="btn-ripple w-full bg-gradient-to-l from-[#1E40AF] to-[#0F172A] dark:from-blue-600 dark:to-blue-800 text-white py-2.5 px-4 rounded-xl hover:shadow-lg hover:shadow-[#1E40AF]/25 hover:from-[#0F172A] hover:to-[#1E40AF] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {isAddingItem ? 'جاري الإضافة...' : 'إضافة'}
                        </button>
                    </div>
                )}
            </div>
        </Modal>
    );
};

interface UniversityChainSelectProps {
    universities: any[];
    selectedUniversityId: string;
    selectedCollegeId: string;
    onUniversityChange: (value: string) => void;
    onCollegeChange: (value: string) => void;
}

const UniversityChainSelect: React.FC<UniversityChainSelectProps> = ({
    universities,
    selectedUniversityId,
    selectedCollegeId,
    onUniversityChange,
    onCollegeChange,
}) => {
    const selectedUni = universities.find(u => u.id === selectedUniversityId);

    return (
        <div className="space-y-2 sm:space-y-3">
            <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1 sm:mb-2">اختر الجامعة أولاً</label>
                <select
                    value={selectedUniversityId}
                    onChange={(e) => {
                        onUniversityChange(e.target.value);
                        onCollegeChange('');
                    }}
                    className="w-full p-2 sm:p-2.5 border border-neutral-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                >
                    <option value="">اختر الجامعة...</option>
                    {universities.map((uni) => (
                        <option key={uni.id} value={uni.id}>{uni.name}</option>
                    ))}
                </select>
            </div>

            {selectedUni && (
                <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1 sm:mb-2">اختر الكلية</label>
                    <select
                        value={selectedCollegeId}
                        onChange={(e) => onCollegeChange(e.target.value)}
                        className="w-full p-2 sm:p-2.5 border border-neutral-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    >
                        <option value="">اختر الكلية...</option>
                        {selectedUni.colleges?.map((col: any) => (
                            <option key={col.id} value={col.id}>{col.name}</option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );
};

interface CourseChainSelectProps {
    universities: any[];
    selectedUniversityId: string;
    selectedCollegeId: string;
    selectedMajorId: string;
    onUniversityChange: (value: string) => void;
    onCollegeChange: (value: string) => void;
    onMajorChange: (value: string) => void;
}

const CourseChainSelect: React.FC<CourseChainSelectProps> = ({
    universities,
    selectedUniversityId,
    selectedCollegeId,
    selectedMajorId,
    onUniversityChange,
    onCollegeChange,
    onMajorChange,
}) => {
    const selectedUni = universities.find(u => u.id === selectedUniversityId);
    const selectedCol = selectedUni?.colleges?.find((c: any) => c.id === selectedCollegeId);

    return (
        <div className="space-y-2 sm:space-y-3">
            <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1 sm:mb-2">اختر الجامعة أولاً</label>
                <select
                    value={selectedUniversityId}
                    onChange={(e) => {
                        onUniversityChange(e.target.value);
                        onCollegeChange('');
                        onMajorChange('');
                    }}
                    className="w-full p-2 sm:p-2.5 border border-neutral-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                >
                    <option value="">اختر الجامعة...</option>
                    {universities.map((uni) => (
                        <option key={uni.id} value={uni.id}>{uni.name}</option>
                    ))}
                </select>
            </div>

            {selectedUni && (
                <>
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1 sm:mb-2">اختر الكلية</label>
                        <select
                            value={selectedCollegeId}
                            onChange={(e) => {
                                onCollegeChange(e.target.value);
                                onMajorChange('');
                            }}
                            className="w-full p-2 sm:p-2.5 border border-neutral-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                        >
                            <option value="">اختر الكلية...</option>
                            {selectedUni.colleges?.map((col: any) => (
                                <option key={col.id} value={col.id}>{col.name}</option>
                            ))}
                        </select>
                    </div>

                    {selectedCollegeId && (
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1 sm:mb-2">اختر التخصص</label>
                            <select
                                value={selectedMajorId}
                                onChange={(e) => onMajorChange(e.target.value)}
                                className="w-full p-2 sm:p-2.5 border border-neutral-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                            >
                                <option value="">اختر التخصص...</option>
                                {selectedCol?.majors?.map((maj: any) => (
                                    <option key={maj.id} value={maj.id}>{maj.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default AddEditModal;
