import FileUploadForm from '../ui/FileUploadForm';

const UploadTab = ({ courseId }: { courseId: string }) => {
    const handleUploadSuccess = () => {
        // FileUploadForm already updates currentCourseFiles,
        // no need to duplicate the update here
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="glass-card-modern p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-600 to-secondary-500 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold bg-gradient-to-l from-primary-700 to-secondary-600 bg-clip-text text-transparent">رفع ملفات جديدة</h2>
                </div>
                <p className="text-sm text-brown-500 mb-6">
                    ارفع ملفاتك ومذكراتك لمقررتك. سيتم مشاركتها مع زملائك في المقرر.
                </p>
                <FileUploadForm
                    courseId={courseId}
                    onUploadSuccess={handleUploadSuccess}
                />
            </div>
        </div>
    );
};

export default UploadTab;
