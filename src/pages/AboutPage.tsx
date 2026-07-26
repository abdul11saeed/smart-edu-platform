import { useEffect } from 'react';

const AboutPage = () => {
    // SEO meta tags
    useEffect(() => {
        document.title = 'عن المنصة - منصة البرامج الاكاديميه للجامعات اليمنيه التعليمية';
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute('content', 'منصة البرامج الاكاديميه للجامعات اليمنيه التعليمية - منصة تعليمية ذكية مصممة للطلاب الجامعيين في اليمن، تهدف إلى تسهيل الوصول إلى التعليم عالي الجودة من خلال تقنيات الذكاء الاصطناعي.');
        return () => {
            document.title = 'منصة البرامج الاكاديميه للجامعات اليمنيه التعليمية';
        };
    }, []);

    return (
        <div className="max-w-4xl mx-auto">
            <div className="bg-white/80 dark:bg-[#0F172A]/80 backdrop-blur-xl rounded-2xl shadow-lg shadow-[#1E40AF]/5 border border-slate-200/80 dark:border-blue-400/20 p-6 lg:p-8">
                <h1 className="text-2xl font-bold bg-gradient-to-l from-[#1E40AF] to-[#0F172A] dark:from-blue-300 dark:to-blue-100 bg-clip-text text-transparent mb-4">عن المنصة</h1>
                <p className="text-slate-600 dark:text-blue-200/70 leading-relaxed mb-4">
                    منصة البرامج الاكاديميه للجامعات اليمنيه هي منصة تعليمية ذكية مصممة خصيصاً للطلاب الجامعيين في اليمن، تهدف إلى تسهيل الوصول إلى التعليم عالي الجودة من خلال تقنيات الذكاء الاصطناعي.
                </p>
                <p className="text-slate-600 dark:text-blue-200/70 leading-relaxed mb-4">
                    نجمع بين الموارد التعليمية المنظمة والذكاء الاصطناعي المتقدم لمساعدتك على الفهم، التلخيص، وصولاً إلى التفوق الأكاديمي.
                </p>
                <p className="text-slate-600 dark:text-blue-200/70 leading-relaxed">
                    نؤمن بأن التعليم حق للجميع، ونعمل على تطوير المنصة بشكل مستمر لدعم مسيرتك التعليمية.
                </p>
            </div>
        </div>
    );
};

export default AboutPage;