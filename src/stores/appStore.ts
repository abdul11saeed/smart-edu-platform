// Zustand Store - Runtime state only
// Single Source of Truth for runtime UI state
// Auth state comes from authService → Firebase Auth
// File metadata comes from courseFilesService → Cloud Firestore
import { create } from 'zustand';
import { User, File, Course } from '../types';

interface AppState {
    // ===== RUNTIME STATE ONLY =====
    // These are ephemeral and should NOT be persisted to localStorage

    // Auth state - comes from Firebase Auth via authService
    currentUser: User | null;
    isLoading: boolean;

    // Network connectivity state
    isOffline: boolean;

    // Theme state
    isDarkMode: boolean;

    // Course navigation state
    activeCourseId: string | null;
    activeCourse: Course | null;
    currentCourseFiles: File[];

    // Workspace tabs state
    activeTab: string;

    // AI Chat panel state
    isAIChatOpen: boolean;

    aiChatInitialFile: { id: string; name: string; content?: string; readable?: boolean } | null;

    // AI Chat open mode: 'default' for floating button, 'resume-if-recent' for file-card Ask AI
    aiChatOpenMode: 'default' | 'resume-if-recent';

    // Sidebar state
    sidebarOpen: boolean;

    // Upload modal state
    isUploadModalOpen: boolean;

    // All user files (global view)
    allUserFiles: File[];

    // Hierarchical selection state
    selectedUniversity: string | null;
    selectedCollege: string | null;
    selectedMajor: string | null;
    selectedCourse: string | null;

    // ===== ACTIONS =====

    // Auth actions
    setCurrentUser: (user: User | null) => void;
    setIsLoading: (loading: boolean) => void;

    // Course actions
    setActiveCourseId: (id: string | null) => void;
    setActiveCourse: (course: Course | null) => void;
    setCurrentCourseFiles: (files: File[]) => void;
    addCourseFile: (file: File) => void;
    removeCourseFile: (fileId: string) => void;

    // Tab actions
    setActiveTab: (tab: string) => void;

    // AI Chat actions
    setIsAIChatOpen: (open: boolean) => void;
    toggleAIChat: () => void;

    setAiChatInitialFile: (file: { id: string; name: string; content?: string; readable?: boolean } | null) => void;

    // AI Chat open mode
    setAiChatOpenMode: (mode: 'default' | 'resume-if-recent') => void;

    // Sidebar actions
    setSidebarOpen: (open: boolean) => void;
    toggleSidebar: () => void;

    // Upload modal actions
    setIsUploadModalOpen: (open: boolean) => void;

    // User files actions
    setAllUserFiles: (files: File[]) => void;
    addUserFile: (file: File) => void;

    // Selection actions
    setSelectedUniversity: (id: string | null) => void;
    setSelectedCollege: (id: string | null) => void;
    setSelectedMajor: (id: string | null) => void;
    setSelectedCourse: (id: string | null) => void;

    // Theme actions
    toggleDarkMode: () => void;
    setIsDarkMode: (isDark: boolean) => void;

    // Network actions
    setIsOffline: (offline: boolean) => void;

    // Clear all state (for logout)
    reset: () => void;
}

const getInitialState = () => {
    // Read persisted preferences from localStorage
    const storedDarkMode = localStorage.getItem('eduai_dark_mode');
    const isDarkMode = storedDarkMode === 'true';
    return {
        currentUser: null,
        isLoading: true,
        isDarkMode,
        isOffline: false,
        activeCourseId: null,
        activeCourse: null,
        currentCourseFiles: [],
        activeTab: 'files',
        isAIChatOpen: false,
        aiChatInitialFile: null,
        aiChatOpenMode: 'default' as 'default' | 'resume-if-recent',
        sidebarOpen: false,
        isUploadModalOpen: false,
        selectedUniversity: null,
        selectedCollege: null,
        selectedMajor: null,
        selectedCourse: null,
        allUserFiles: [],
    };
};

const initialState = getInitialState();

export const useAppStore = create<AppState>((set) => ({
    // Initial state
    ...initialState,

    // Auth actions
    setCurrentUser: (user) => set({ currentUser: user, isLoading: false }),
    setIsLoading: (loading) => set({ isLoading: loading }),

    // Course actions
    setActiveCourseId: (id) => set({ activeCourseId: id }),
    setActiveCourse: (course) => set({ activeCourse: course }),
    setCurrentCourseFiles: (files) => set({ currentCourseFiles: files }),
    addCourseFile: (file) => set((state) => ({
        currentCourseFiles: [...state.currentCourseFiles, file]
    })),
    removeCourseFile: (fileId) => set((state) => ({
        currentCourseFiles: state.currentCourseFiles.filter(f => f.id !== fileId)
    })),

    // Tab actions
    setActiveTab: (tab) => set({ activeTab: tab }),

    // AI Chat actions
    setIsAIChatOpen: (open) => set({ isAIChatOpen: open }),
    toggleAIChat: () => set((state) => ({ isAIChatOpen: !state.isAIChatOpen })),

    setAiChatInitialFile: (file: { id: string; name: string; content?: string; readable?: boolean } | null) => set({ aiChatInitialFile: file }),

    setAiChatOpenMode: (mode) => set({ aiChatOpenMode: mode }),

    // Sidebar actions
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

    // Upload modal actions
    setIsUploadModalOpen: (open) => set({ isUploadModalOpen: open }),

    // Selection actions
    setSelectedUniversity: (id) => set({
        selectedUniversity: id,
        selectedCollege: null,
        selectedMajor: null,
        selectedCourse: null
    }),
    setSelectedCollege: (id) => set({
        selectedCollege: id,
        selectedMajor: null,
        selectedCourse: null
    }),
    setSelectedMajor: (id) => set({
        selectedMajor: id,
        selectedCourse: null
    }),
    setSelectedCourse: (id) => set({ selectedCourse: id }),

    // Theme actions (persist to localStorage)
    toggleDarkMode: () => set((state) => {
        const newValue = !state.isDarkMode;
        localStorage.setItem('eduai_dark_mode', newValue.toString());
        return { isDarkMode: newValue };
    }),
    setIsDarkMode: (isDark: boolean) => {
        localStorage.setItem('eduai_dark_mode', isDark.toString());
        set({ isDarkMode: isDark });
    },

    // Network actions
    setIsOffline: (offline: boolean) => {
        set({ isOffline: offline });
    },


    // User files actions
    setAllUserFiles: (files: File[]) => set({ allUserFiles: files }),
    addUserFile: (file: File) => set((state) => ({
        allUserFiles: [...state.allUserFiles, file]
    })),

    // Reset to initial state
    // NOTE: auth is now resolved (logged out / no session), so isLoading must be
    // false. Leaving it true would permanently trap logged-out users on the
    // "جاري التحقق من الجلسة" spinner instead of showing the login screen.
    reset: () => set({ ...initialState, isLoading: false, aiChatOpenMode: 'default' }),
}));
