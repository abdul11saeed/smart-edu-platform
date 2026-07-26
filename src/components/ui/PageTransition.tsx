import { ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
    children: ReactNode;
}

const PageTransition = ({ children }: PageTransitionProps) => {
    const location = useLocation();
    const [displayChildren, setDisplayChildren] = useState(children);
    const [transitionState, setTransitionState] = useState<'enter' | 'enter-active' | 'exit' | 'exit-active'>('enter-active');
    const prevPathname = useRef(location.pathname);

    useEffect(() => {
        // Same route, only content updated (e.g. a store-driven re-render):
        // reflect the new children immediately WITHOUT re-triggering the
        // enter/exit animation. Relying on `children` in the dependency array
        // previously caused a visible flicker on every AppShell re-render.
        if (prevPathname.current === location.pathname) {
            setDisplayChildren(children);
            return;
        }

        prevPathname.current = location.pathname;

        // Start exit animation with the previous page still visible.
        setTransitionState('exit');

        // After exit animation completes, swap content and start enter animation
        const timer = setTimeout(() => {
            setDisplayChildren(children);
            setTransitionState('enter');

            // Trigger enter-active after a tiny delay for CSS transition
            requestAnimationFrame(() => {
                setTransitionState('enter-active');
            });
        }, 150); // Half of the transition duration

        return () => clearTimeout(timer);
    }, [location.pathname, children]);

    return (
        <div
            className={`
                transition-all duration-250 ease-in-out
                ${transitionState === 'enter' ? 'opacity-0 translate-y-2' : ''}
                ${transitionState === 'enter-active' ? 'opacity-100 translate-y-0' : ''}
                ${transitionState === 'exit' ? 'opacity-100 translate-y-0' : ''}
                ${transitionState === 'exit-active' ? 'opacity-0 -translate-y-2' : ''}
            `}
        >
            {displayChildren}
        </div>
    );
};

export default PageTransition;
