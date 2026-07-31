/**
 * Check if a given pathname is a chat page.
 * Used by both the layout shell (header visibility) and the app shell
 * (floating action buttons visibility) so they stay in sync.
 */
const CHAT_PATHS = ['/chat', '/chat/private', '/ai-chat'] as const;

export const isChatPage = (pathname: string): boolean =>
    CHAT_PATHS.some(
        (path) => pathname === path || pathname.startsWith(path + '/'),
    );
