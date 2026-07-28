import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useCatalogStore } from '../../stores/catalogStore';

const Breadcrumbs = () => {
    const {
        selectedUniversity,
        selectedCollege,
        selectedMajor,
        selectedCourse,
    } = useAppStore();

    const { universities } = useCatalogStore();

    const getName = (id: string, type: 'university' | 'college' | 'major' | 'course') => {
        if (type === 'university') {
            return universities.find(u => u.id === id)?.name;
        }
        if (type === 'college' && selectedUniversity) {
            const uni = universities.find(u => u.id === selectedUniversity);
            return uni?.colleges.find(c => c.id === id)?.name;
        }
        if (type === 'major' && selectedUniversity && selectedCollege) {
            const uni = universities.find(u => u.id === selectedUniversity);
            const col = uni?.colleges.find(c => c.id === selectedCollege);
            return col?.majors.find(m => m.id === id)?.name;
        }
        if (type === 'course' && selectedUniversity && selectedCollege && selectedMajor) {
            const uni = universities.find(u => u.id === selectedUniversity);
            const col = uni?.colleges.find(c => c.id === selectedCollege);
            const maj = col?.majors.find(m => m.id === selectedMajor);
            return maj?.courses.find(c => c.id === id)?.name;
        }
        return '';
    };

    const breadcrumbs: Array<{ label: string; path: string; type?: string }> = [];

    if (selectedUniversity) {
        breadcrumbs.push({
            label: getName(selectedUniversity, 'university') || 'جامعة',
            path: '/',
            type: 'university'
        });
    }
    if (selectedCollege) {
        breadcrumbs.push({
            label: getName(selectedCollege, 'college') || 'كلية',
            path: '/',
            type: 'college'
        });
    }
    if (selectedMajor) {
        breadcrumbs.push({
            label: getName(selectedMajor, 'major') || 'تخصص',
            path: '/',
            type: 'major'
        });
    }
    if (selectedCourse) {
        breadcrumbs.push({
            label: getName(selectedCourse, 'course') || 'مادة',
            path: `/course/${selectedCourse}`,
            type: 'course'
        });
    }

    return (
        <nav className="flex items-center space-x-1 text-sm text-gray-600 mb-6 bg-gray-50 py-2 px-4 rounded-lg">
            {breadcrumbs.map((crumb, index) => (
                <div key={index} className="flex items-center">
                    {index > 0 && <ChevronLeft className="h-4 w-4 mx-1 text-gray-400" />}
                    {crumb.path && index < breadcrumbs.length - 1 ? (
                        <Link
                            to={crumb.path}
                            className="flex items-center hover:text-primary-600 transition-colors px-2 py-1 rounded hover:bg-gray-100"
                        >
                            <span>{crumb.label}</span>
                        </Link>
                    ) : (
                        <span className={`flex items-center px-2 py-1 ${index === breadcrumbs.length - 1
                            ? 'text-primary-600 font-medium'
                            : 'text-gray-500'
                            }`}>
                            <span>{crumb.label}</span>
                        </span>
                    )}
                </div>
            ))}
        </nav>
    );
};

export default Breadcrumbs;
