import { useCallback } from 'react';
import { recommendationService } from '../services/recommendationService';

interface UseRecommendationActionsOptions {
    userId: string | undefined;
    onInvalidate?: () => void;
}

export function useRecommendationActions({ userId, onInvalidate }: UseRecommendationActionsOptions) {
    const canInteract = !!userId;

    const handleSave = useCallback(async <T extends { id: string; isSaved?: boolean }>(
        contentId: string,
        items: T[],
        setItems: React.Dispatch<React.SetStateAction<T[]>>
    ) => {
        if (!canInteract) return;
        const currentItem = items.find(item => item.id === contentId);
        const isCurrentlySaved = currentItem?.isSaved;

        // Optimistically toggle
        setItems(prev => prev.map(item =>
            item.id === contentId ? { ...item, isSaved: !isCurrentlySaved } : item
        ));

        try {
            if (isCurrentlySaved) {
                await recommendationService.unsaveRecommendation(contentId, userId);
            } else {
                await recommendationService.saveRecommendation(contentId, userId);
            }
        } catch {
            // Revert on failure
            setItems(prev => prev.map(item =>
                item.id === contentId ? { ...item, isSaved: !!isCurrentlySaved } : item
            ));
        } finally {
            onInvalidate?.();
        }
    }, [userId, canInteract, onInvalidate]);

    const handleLike = useCallback(async <T extends { id: string; isLiked?: boolean }>(
        contentId: string,
        items: T[],
        setItems: React.Dispatch<React.SetStateAction<T[]>>
    ) => {
        if (!canInteract) return;
        const currentItem = items.find(item => item.id === contentId);
        const isCurrentlyLiked = currentItem?.isLiked;

        // Optimistically toggle
        setItems(prev => prev.map(item =>
            item.id === contentId ? { ...item, isLiked: !isCurrentlyLiked } : item
        ));

        try {
            const liked = await recommendationService.likeRecommendation(contentId, userId);
            setItems(prev => prev.map(item =>
                item.id === contentId ? { ...item, isLiked: !!liked } : item
            ));
        } catch {
            // Revert on failure
            setItems(prev => prev.map(item =>
                item.id === contentId ? { ...item, isLiked: !!isCurrentlyLiked } : item
            ));
        } finally {
            onInvalidate?.();
        }
    }, [userId, canInteract, onInvalidate]);

    const handleHide = useCallback(async <T extends { id: string }>(
        contentId: string,
        _items: T[],
        setItems: React.Dispatch<React.SetStateAction<T[]>>,
        reloadFn: () => void
    ) => {
        if (!canInteract) return;

        // Optimistically remove
        setItems(prev => prev.filter(item => item.id !== contentId));

        try {
            await recommendationService.hideRecommendation(contentId, userId);
        } catch {
            // Reload on failure to restore
            reloadFn();
        } finally {
            onInvalidate?.();
        }
    }, [userId, canInteract, onInvalidate]);

    return { handleSave, handleLike, handleHide, canInteract };
}
