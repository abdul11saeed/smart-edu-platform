// Catalog Store - Universities, Colleges, Majors, Courses
import { create } from 'zustand';
import { University } from '../types';
import { getUniversities, subscribeToUniversities } from '../services/dataService';

interface CatalogState {
    universities: University[];
    isLoading: boolean;
    error: string | null;
    fetchUniversities: () => Promise<void>;
    subscribeToUniversities: () => () => void;
    setUniversities: (universities: University[]) => void;
}

export const useCatalogStore = create<CatalogState>((set) => ({
    universities: [],
    isLoading: true,
    error: null,

    fetchUniversities: async () => {
        set({ isLoading: true, error: null });
        try {
            const universities = await getUniversities();
            set({ universities, isLoading: false });
        } catch (error) {
            console.error('Error fetching universities:', error);
            set({ universities: [], error: 'Failed to fetch universities', isLoading: false });
        }
    },

    subscribeToUniversities: () => {
        set({ isLoading: true });

        const timeoutId = setTimeout(() => {
            set((state) => {
                if (state.isLoading) {
                    return { isLoading: false };
                }
                return {};
            });
        }, 10000);

        const unsubscribe = subscribeToUniversities((universities) => {
            clearTimeout(timeoutId);
            set({ universities, isLoading: false });
        });

        return () => {
            clearTimeout(timeoutId);
            unsubscribe();
        };
    },

    setUniversities: (universities) => set({ universities }),
}));
