import React from 'react';
import { Edit2, Trash2, Check, X } from 'lucide-react';
import { ContentItem } from './types';

interface ContentManagementTableProps {
    items: ContentItem[];
    editingItem: ContentItem | null;
    editName: string;
    isEditingContent: boolean;
    isDeleting: boolean;
    onStartEdit: (item: ContentItem) => void;
    onCancelEdit: () => void;
    onSaveEdit: () => void;
    onDeleteItem: (id: string) => void;
    onEditNameChange: (value: string) => void;
}

const TYPE_ARABIC_LABEL: Record<string, string> = {
    university: 'جامعة',
    college: 'كلية',
    major: 'تخصص',
    course: 'مسار',
};

const TYPE_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
    university: { bg: 'bg-primary-50', text: 'text-primary-700', badge: 'bg-primary-100 text-primary-800' },
    college: { bg: 'bg-secondary-50', text: 'text-secondary-700', badge: 'bg-secondary-100 text-secondary-800' },
    major: { bg: 'bg-accent-50', text: 'text-accent-700', badge: 'bg-accent-100 text-accent-800' },
    course: { bg: 'bg-sage-50', text: 'text-sage-700', badge: 'bg-sage-100 text-sage-800' },
};

const ContentManagementTable: React.FC<ContentManagementTableProps> = ({
    items,
    editingItem,
    editName,
    isEditingContent,
    isDeleting,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onDeleteItem,
    onEditNameChange,
}) => {
    const isProcessing = isEditingContent || isDeleting;

    return (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-neutral-200/60 shadow-lg shadow-neutral-200/50 p-4 sm:p-6 lg:p-8 mt-6 sm:mt-8 hover:shadow-xl hover:shadow-neutral-300/50 transition-all duration-300">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-neutral-800 flex items-center">
                    <span className="inline-block w-1 h-6 sm:h-8 bg-gradient-to-b from-primary-600 to-secondary-600 rounded-full ml-3"></span>
                    إدارة المحتوى التعليمي
                </h2>
                <span className="text-xs font-medium text-neutral-400 bg-neutral-100 px-2.5 py-1 rounded-full">
                    {items.length} عنصر
                </span>
            </div>
            <div className="overflow-x-auto overflow-y-auto max-h-[60vh] sm:max-h-[70vh] custom-scrollbar rounded-xl">
                <table className="min-w-[320px] w-full divide-y divide-neutral-100 text-sm sm:text-base">
                    <thead>
                        <tr className="bg-gradient-to-l from-neutral-50 to-neutral-100/50">
                            <th className="px-3 sm:px-6 py-3.5 text-right text-xs font-bold text-neutral-600 uppercase tracking-wider rounded-r-lg">النوع</th>
                            <th className="px-3 sm:px-6 py-3.5 text-right text-xs font-bold text-neutral-600 uppercase tracking-wider">الاسم</th>
                            <th className="px-3 sm:px-6 py-3.5 text-right text-xs font-bold text-neutral-600 uppercase tracking-wider">الحالة</th>
                            <th className="px-3 sm:px-6 py-3.5 text-right text-xs font-bold text-neutral-600 uppercase tracking-wider rounded-l-lg">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-neutral-100">
                        {items.map((item, index) => {
                            const typeColors = TYPE_COLORS[item.type] || TYPE_COLORS.university;
                            return (
                                <tr
                                    key={item.id}
                                    className={`hover:bg-gradient-to-l hover:from-primary-50/50 hover:to-secondary-50/30 transition-colors duration-150 ${index % 2 === 0 ? 'bg-white' : 'bg-neutral-50/30'}`}
                                >
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${typeColors.badge}`}>
                                            {TYPE_ARABIC_LABEL[item.type]}
                                        </span>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-neutral-800 font-medium">
                                        {editingItem?.id === item.id ? (
                                            <div className="space-y-3">
                                                <input
                                                    type="text"
                                                    value={editName}
                                                    onChange={(e) => onEditNameChange(e.target.value)}
                                                    className="w-full p-2 border border-primary-200 rounded-lg focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 text-sm bg-white/80 transition-all"
                                                    autoFocus
                                                />
                                            </div>
                                        ) : (
                                            <span className="text-neutral-700">{item.name}</span>
                                        )}
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${item.status === 'active' ? 'bg-success-100 text-success-700' : 'bg-neutral-100 text-neutral-500'}`}>
                                            {item.status === 'active' ? 'نشط' : 'غير نشط'}
                                        </span>
                                    </td>
                                    <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-neutral-500">
                                        {editingItem?.id === item.id ? (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={onSaveEdit}
                                                    disabled={isProcessing}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-l from-success-600 to-success-700 hover:from-success-700 hover:to-success-800 rounded-lg transition-all shadow-sm shadow-success-500/20 disabled:opacity-50"
                                                    title="حفظ"
                                                >
                                                    <Check className="h-3.5 w-3.5" />
                                                    حفظ
                                                </button>
                                                <button
                                                    onClick={onCancelEdit}
                                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                                                    title="إلغاء"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                    إلغاء
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => onStartEdit(item)}
                                                    disabled={isProcessing}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors disabled:opacity-50"
                                                    title="تعديل"
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                    تعديل
                                                </button>
                                                <button
                                                    onClick={() => onDeleteItem(item.id)}
                                                    disabled={isProcessing}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                                                    title="حذف"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    حذف
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ContentManagementTable;
