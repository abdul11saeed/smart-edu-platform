/**
 * Check if a given pathname is a chat page or discussions page.
 * Used by both the layout shell (footer visibility) and the app shell
 * (floating action buttons visibility) so they stay in sync.
 * Both chat and discussions pages hide the footer and FABs.
 */
const FULLSCREEN_PATHS = ['/chat', '/chat/private', '/ai-chat', '/discussions'] as const;

export const isChatPage = (pathname: string): boolean =>
    FULLSCREEN_PATHS.some(
        (path) => pathname === path || pathname.startsWith(path + '/'),
    );
