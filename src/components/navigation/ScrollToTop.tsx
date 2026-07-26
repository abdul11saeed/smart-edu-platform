import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
    const { pathname, search } = useLocation();

    useEffect(() => {
        // Scroll to top on route change or search parameter change
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }, [pathname, search]);

    return null;
};

export default ScrollToTop;
