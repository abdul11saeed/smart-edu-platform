import { useEffect } from 'react';

const TermsPage = () => {
    // SEO meta tags
    useEffect(() => {
        document.title = 'الشروط والأحكام - منصة البرامج الاكاديميه للجامعات اليمنيه التعليمية';
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute('content', 'منصة البرامج الاكاديميه للجامعات اليمنيه التعليمية - الشروط والأحكام لاستخدام المنصة التعليمية.');
        return () => {
            document.title = 'منصة البرامج الاكاديميه للجامعات اليمنيه التعليمية';
        };
    }, []);

    return (
        <div className="max-w-4xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 lg:p-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">الشروط والأحكام</h1>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                    باستخدامك لمنصة البرامج الاكاديميه للجامعات اليمنيه، فإنك توافق على الالتزام بالشروط التالية.
                </p>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-2">1. قبول الشروط</h2>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                    يجب أن تكون مصرحاً لك باستخدام المنصة، وتتحمل مسؤولية الحفاظ على سرية بيانات حسابك.
                </p>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-2">2. الاستخدام المقبول</h2>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                    يُمنع استخدام المنصة لأي غرض غير تعليمي، أو إساءة استخدام الخدمات المتاحة.
                </p>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-2">3. الخصوصية</h2>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    نحترم خصوصيتك ولا نشارك بياناتك الشخصية مع أطراف ثالثة دون موافقتك، ما عدا ما هو مطلوب بموجب القانون.
                </p>
            </div>
        </div>
    );
};

export default TermsPage;