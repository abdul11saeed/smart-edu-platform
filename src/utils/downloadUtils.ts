/**
 * Cross-platform file download utility.
 *
 * Uses blob download for cross-origin URLs (e.g., Firebase Storage) to ensure
 * the native download dialog appears on all browsers including Android Chrome.
 *
 * Key points:
 * - Direct <a href> with download attribute does NOT work for cross-origin URLs.
 * - target="_blank" opens in a new tab instead of downloading (especially bad on Android).
 * - Blob approach: fetch → blob → object URL → programmatic click → cleanup.
 * - Mobile Android browsers need a slight delay before triggering the click.
 * - iOS Safari ignores the blob `download` attribute, so for iOS we open the
 *   (same-origin proxied) attachment URL and let Safari handle the save natively.
 * - Real download progress is reported via onProgress by streaming the response
 *   body when the server provides a Content-Length header.
 */

export interface DownloadOptions {
    filename: string;
    onStart?: () => void;
    /** Called with (percent 0-100, loadedBytes, totalBytes). totalBytes is 0 when unknown. */
    onProgress?: (percent: number, loaded: number, total: number) => void;
    onComplete?: () => void;
    onError?: (error: Error) => void;
}

const isMobile = (): boolean => /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);

// iPadOS reports as MacIntel but is touch-capable → treat as iOS.
const isIOS = (): boolean =>
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints! > 1);

const triggerBlobDownload = (blob: Blob, filename: string, onComplete?: () => void): void => {
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);

    const cleanup = () => {
        URL.revokeObjectURL(blobUrl);
        if (a.parentNode) document.body.removeChild(a);
        onComplete?.();
    };

    if (isMobile()) {
        // Android Chrome (and iOS when reached) need the element to be in the DOM and a
        // small delay before the programmatic click to reliably open the download sheet.
        requestAnimationFrame(() => {
            setTimeout(() => {
                a.click();
                setTimeout(cleanup, 100);
            }, 60);
        });
    } else {
        a.click();
        setTimeout(cleanup, 100);
    }
};

// Streams the response body while reporting download progress. Falls back to a plain
// blob() when there is no readable stream or no Content-Length (indeterminate).
const readStreamWithProgress = async (
    response: Response,
    onProgress?: (percent: number, loaded: number, total: number) => void
): Promise<Blob> => {
    const total = Number(response.headers.get('content-length')) || 0;
    const reader = response.body?.getReader();

    if (!reader || !total) {
        // Unknown size → report indeterminate (percent 0, total 0).
        onProgress?.(0, 0, 0);
        return response.blob();
    }

    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
            chunks.push(value);
            received += value.length;
            const percent = Math.min(100, Math.round((received / total) * 100));
            onProgress?.(percent, received, total);
        }
    }
    return new Blob(chunks as unknown as BlobPart[], { type: response.headers.get('content-type') || undefined });
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || '/api';

// Returns true if the URL points to a different origin than the current page.
// Cross-origin requests relying on `fetch` require CORS headers; Firebase Storage
// buckets in this project are not CORS-configured, so they must go through the proxy.
const isCrossOrigin = (url: string): boolean => {
    try {
        return new URL(url).origin !== window.location.origin;
    } catch {
        return false;
    }
};

// Opens a URL in a new tab. Navigation requests are NOT subject to CORS, so this is a
// safe fallback for cross-origin files that cannot be fetched directly by the browser.
const openInNewTab = (url: string): void => {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};

export const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '—';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const value = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
    // Always use English numerals for the numeric part
    return `${value.toLocaleString('en-US')} ${sizes[i]}`;
};

export const downloadFile = async (url: string, options: DownloadOptions): Promise<boolean> => {
    const { filename, onStart, onProgress, onComplete, onError } = options;

    if (!url || url === '#' || url === '#local-file') {
        alert('الرابط غير متوفر حالياً');
        return false;
    }

    onStart?.();

    try {
        // Data URLs are same-document → fetch directly into a blob.
        if (url.startsWith('data:')) {
            const response = await fetch(url);
            const blob = await response.blob();
            triggerBlobDownload(blob, filename, onComplete);
            return true;
        }

        // Cross-origin cloud URLs (Firebase Storage) fail in the browser because the bucket is
        // not CORS-configured and returns `Content-Disposition: inline`. Route the download
        // through our same-origin backend proxy, which streams the file back as an attachment.
        if (isCrossOrigin(url)) {
            const proxyUrl = `${API_BASE}/files/download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(filename || 'download')}`;

            // iOS Safari does not honor the blob `download` attribute and would only preview the
            // file. Opening the proxied (attachment-disposition) URL lets Safari save it natively.
            if (isIOS()) {
                openInNewTab(proxyUrl);
                onComplete?.();
                return true;
            }

            const response = await fetch(proxyUrl);
            if (!response.ok) {
                throw new Error(`Download proxy responded ${response.status}`);
            }
            // Guard against an SPA fallback (HTML) when the backend is unreachable.
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('text/html')) {
                throw new Error('Download endpoint unavailable');
            }
            const blob = await readStreamWithProgress(response, onProgress);
            triggerBlobDownload(blob, filename, onComplete);
            return true;
        }

        // Same-origin URLs → open natively on iOS, otherwise fetch and stream with progress.
        if (isIOS()) {
            openInNewTab(url);
            onComplete?.();
            return true;
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const blob = await readStreamWithProgress(response, onProgress);
        triggerBlobDownload(blob, filename, onComplete);
        return true;
    } catch (error) {
        const err = error instanceof Error ? error : new Error('فشل تحميل الملف');
        console.warn('Download failed, falling back to opening file:', err);
        onError?.(err);

        // Fallback: open the original URL in a new tab (not CORS-restricted). The file can be
        // viewed / saved from there. This avoids noisy browser CORS console errors.
        try {
            openInNewTab(url);
        } catch (fallbackError) {
            console.error('Fallback download failed:', fallbackError);
        }

        return false;
    }
};
