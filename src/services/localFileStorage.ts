import { File as AppFile } from '../types';

const MAX_TEXT_PREVIEW_CHARS = 250000;

let pdfjsLib: any = null;
let pdfjsReady: Promise<void> | null = null;

const ensurePdfJs = async () => {
  if (pdfjsLib) return;
  if (pdfjsReady) return pdfjsReady;
  pdfjsReady = import('pdfjs-dist').then(mod => {
    pdfjsLib = mod;
    if (pdfjsLib.GlobalWorkerOptions && pdfjsLib.version) {
      const base = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}`;
      // Use a local/bundled worker when available, otherwise the matching CDN build.
      pdfjsLib.GlobalWorkerOptions.workerSrc = `${base}/pdf.worker.min.mjs`;
      // Expose cMaps so Arabic (and other non-Latin) glyphs extract correctly.
      pdfjsLib.__cMapUrl = `${base}/cmaps/`;
      pdfjsLib.__standardFontDataUrl = `${base}/standard_fonts/`;
    }
  }).catch(() => {
    pdfjsReady = null;
  });
  return pdfjsReady;
};

// Text extraction for AI features (kept for extracting text from uploaded files)
export const extractTextPreview = async (file: File): Promise<string> => {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  if (extension === 'pdf') {
    try {
      await ensurePdfJs();
      if (!pdfjsLib) {
        return '[ملف PDF - لا يمكن استخراج النص تلقائياً]';
      }
      const data = new Uint8Array(await file.arrayBuffer());
      const loadOptions: any = { data };
      // cMaps improve Arabic / non-Latin glyph extraction.
      if (pdfjsLib.__cMapUrl) {
        loadOptions.cMapUrl = pdfjsLib.__cMapUrl;
        loadOptions.cMapPacked = true;
      }
      if (pdfjsLib.__standardFontDataUrl) {
        loadOptions.standardFontDataUrl = pdfjsLib.__standardFontDataUrl;
      }
      const pdf = await pdfjsLib.getDocument(loadOptions).promise;
      const pages = await Promise.all(Array.from({ length: pdf.numPages }, async (_, i) => {
        const page = await pdf.getPage(i + 1);
        const content = await page.getTextContent();
        return content.items.map((item: any) => item.str).join(' ');
      }));
      const text = truncateText(normalizeWhitespace(pages.join('\n')));
      return text || '[ملف PDF - لا يمكن استخراج النص تلقائياً]';
    } catch (error) {
      console.warn('PDF text extraction failed:', error);
      return '[ملف PDF - لا يمكن استخراج النص تلقائياً]';
    }
  }

  // DOCX (Office Open XML Word) — text runs live in word/document.xml.
  if (extension === 'docx') {
    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const doc = await zip.file('word/document.xml')?.async('string');
      if (!doc) return '[ملف DOCX - لا يمكن استخراج النص تلقائياً]';
      const runs = doc.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g) || [];
      const text = runs
        .map((m: string) => m.replace(/<w:t[^>]*>/g, '').replace(/<\/w:t>/g, ''))
        .join(' ')
        .replace(/<\/w:p>/g, '\n');
      const normalized = truncateText(normalizeWhitespace(text));
      return normalized || '[ملف DOCX - لا يمكن استخراج النص تلقائياً]';
    } catch (error) {
      console.warn('DOCX text extraction failed:', error);
      return '[ملف DOCX - لا يمكن استخراج النص تلقائياً]';
    }
  }

  // PPTX (Office Open XML PowerPoint) — extracted from slide XML via JSZip.
  if (extension === 'pptx') {
    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(await file.arrayBuffer());
      const slideNames = Object.keys(zip.files).filter((n) => /ppt\/slides\/slide\d+\.xml$/i.test(n));
      const texts: string[] = [];
      for (const name of slideNames) {
        const xml = await zip.file(name)?.async('string');
        if (!xml) continue;
        const matches = xml.match(/<a:t>([\s\S]*?)<\/a:t>/g) || [];
        const slideText = matches
          .map((m: string) => m.replace(/<a:t>/g, '').replace(/<\/a:t>/g, ''))
          .join(' ')
          .trim();
        if (slideText) texts.push(slideText);
      }
      const text = truncateText(normalizeWhitespace(texts.join('\n')));
      return text || '[ملف PPTX - لا يمكن استخراج النص تلقائياً]';
    } catch (error) {
      console.warn('PPTX text extraction failed:', error);
      return '[ملف PPTX - لا يمكن استخراج النص تلقائياً]';
    }
  }

  if (isTextLikeExtension(extension) || file.type.startsWith('text/') || file.type === 'application/json') {
    const text = await readFileAsText(file);
    if (extension === 'html' || extension === 'htm') {
      return truncateText(normalizeWhitespace(stripHtmlTags(text)));
    }
    if (extension === 'rtf') {
      return truncateText(normalizeWhitespace(text.replace(/\\[a-z]+ ?/g, ' ').replace(/[{}]/g, ' ')));
    }
    return truncateText(normalizeWhitespace(text));
  }

  return '[ملف ' + (extension ? extension.toUpperCase() : 'غير معروف') + ' - لا يمكن استخراج النص تلقائياً]';
};

const isTextLikeExtension = (extension: string) => {
  return ['txt', 'rtf', 'md', 'markdown', 'csv', 'json', 'html', 'htm', 'xml', 'yaml', 'yml', 'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'php', 'sql', 'css', 'scss', 'less', 'log'].includes(extension);
};

const stripHtmlTags = (text: string) => {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
};

const normalizeWhitespace = (text: string) => {
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
};

const truncateText = (text: string) => {
  if (text.length <= MAX_TEXT_PREVIEW_CHARS) return text;
  return text.slice(0, MAX_TEXT_PREVIEW_CHARS) + '\n\n[تم اختصار النص]';
};

const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read text file'));
    reader.readAsText(file, 'utf-8');
  });
};

// Placeholder functions (no longer storing locally)
export const getLocalFilesByCourse = (_courseId: string): AppFile[] => [];
export const getReadableLocalFilesByCourse = (_courseId: string): AppFile[] => [];
export const getLocalFileById = (_fileId: string): AppFile | null => null;
export const deleteLocalFile = (_fileId: string) => { };
export const clearLocalFiles = () => { };
export const getAllLocalFiles = (): AppFile[] => [];

// -------------------- Scanned / image-based file support --------------------
// Enables the vision/OCR pipeline to read PDFs and PPTX that contain no
// extractable text layer (scanned documents or image-only slides), plus
// plain images. This functionality was missing, so these helpers are added
// (not duplicating any existing function).

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read blob as data URL'));
    reader.readAsDataURL(blob);
  });

// Render a single PDF page to a PNG data URL (pdfjs-dist v4 uses { canvas, viewport }).
const renderPdfPageToPng = async (page: any, scale = 1.4): Promise<string> => {
  if (!pdfjsLib) throw new Error('pdfjs not ready');
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const renderContext: any = { canvas, viewport };
  const renderTask = page.render(renderContext);
  await renderTask.promise;
  return canvas.toDataURL('image/png');
};

// Render pages of a scanned (image-only) PDF into PNG data URLs.
const extractScannedPdfImages = async (blob: Blob, _name: string, maxPages = 10): Promise<string[]> => {
  try {
    await ensurePdfJs();
    if (!pdfjsLib) return [];
    const data = new Uint8Array(await blob.arrayBuffer());
    const loadOptions: any = { data };
    if (pdfjsLib.__cMapUrl) {
      loadOptions.cMapUrl = pdfjsLib.__cMapUrl;
      loadOptions.cMapPacked = true;
    }
    if (pdfjsLib.__standardFontDataUrl) {
      loadOptions.standardFontDataUrl = pdfjsLib.__standardFontDataUrl;
    }
    const pdf = await pdfjsLib.getDocument(loadOptions).promise;
    const images: string[] = [];
    const pageCount = Math.min(pdf.numPages, maxPages);
    for (let i = 0; i < pageCount; i += 1) {
      try {
        const page = await pdf.getPage(i + 1);
        images.push(await renderPdfPageToPng(page, 1.4));
      } catch (e) {
        console.warn('Failed to render PDF page', i + 1, e);
      }
    }
    return images;
  } catch (e) {
    console.warn('Scanned PDF image extraction failed:', e);
    return [];
  }
};

// Extract embedded media images from a PPTX (image-only slide decks).
const extractPptxImages = async (blob: Blob, _name: string, maxImages = 20): Promise<string[]> => {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const mediaNames = Object.keys(zip.files).filter(
      (n) => /^ppt\/media\//i.test(n) && /\.(png|jpe?g|gif|webp)$/i.test(n)
    );
    const images: string[] = [];
    for (const mediaName of mediaNames.slice(0, maxImages)) {
      const mediaBlob = await zip.file(mediaName)?.async('blob');
      if (mediaBlob) images.push(await blobToDataUrl(mediaBlob));
    }
    return images;
  } catch (e) {
    console.warn('PPTX image extraction failed:', e);
    return [];
  }
};

// Extract image data URLs from a scanned/image-based file (PDF, PPTX, image).
export const extractFileImagesFromFile = async (file: Blob, name = ''): Promise<string[]> => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  try {
    if (ext === 'pdf') return await extractScannedPdfImages(file, name);
    if (ext === 'pptx') return await extractPptxImages(file, name);
    if (/^(jpg|jpeg|png|gif|bmp|webp)$/.test(ext) || (file as any).type?.startsWith?.('image/')) {
      return [await blobToDataUrl(file)];
    }
  } catch (e) {
    console.warn('extractFileImagesFromFile failed:', e);
  }
  return [];
};

export interface ScannedFileAttachment {
  name: string;
  content: string;
  readable: false;
}

/**
 * For image-only documents (scanned PDF / image-only PPTX / plain images),
 * returns vision-ready attachments (PNG data URLs) so summarization,
 * translation and explanation can use the OCR/vision pipeline.
 * Returns null when the file is not image-based or extraction fails.
 * An optional pre-fetched blob avoids a second network download.
 */
export const getScannedFileImageAttachments = async (
  file: { name?: string; downloadURL?: string; url?: string; localDataUrl?: string },
  apiBase: string = (import.meta.env.VITE_API_BASE_URL as string) || '/api',
  preFetchedBlob?: Blob | null
): Promise<ScannedFileAttachment[] | null> => {
  const name = file.name || 'file';
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const isImageBased = ext === 'pdf' || ext === 'pptx' || /^(jpg|jpeg|png|gif|bmp|webp)$/.test(ext);
  if (!isImageBased) return null;

  try {
    let blob: Blob | null = preFetchedBlob || null;
    if (!blob) {
      if (file.localDataUrl && file.localDataUrl.startsWith('data:')) {
        blob = await (await fetch(file.localDataUrl)).blob();
      } else if (file.downloadURL || file.url) {
        const fileUrl: string = file.downloadURL || file.url || '';
        const proxy = `${apiBase}/files/download?url=${encodeURIComponent(fileUrl)}&name=${encodeURIComponent(name)}`;
        const res = await fetch(proxy);
        if (!res.ok) return null;
        blob = await res.blob();
      }
    }
    if (!blob) return null;

    const images = await extractFileImagesFromFile(blob, name);
    if (!images.length) return null;
    return images.map((content, i) => ({
      name: `${name} (صورة ${i + 1})`,
      content,
      readable: false as const,
    }));
  } catch (e) {
    console.warn('getScannedFileImageAttachments failed:', e);
    return null;
  }
};