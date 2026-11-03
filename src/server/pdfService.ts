// Import pdf-parse safely supporting CommonJS and ESM interop
// @ts-ignore
import * as pdfParseModule from 'pdf-parse';
const pdfParse: any = (pdfParseModule as any).default || pdfParseModule;

export interface ParsedDocumentResult {
  text: string;
  pageCount: number;
  pages: { pageNumber: number; text: string }[];
}

export async function parsePdfBuffer(buffer: Buffer): Promise<ParsedDocumentResult> {
  try {
    const data = await pdfParse(buffer);
    const fullText = data.text || '';
    const numPages = data.numpages || 1;

    // Split text into approximate pages if page markers aren't explicit
    const pages: { pageNumber: number; text: string }[] = [];
    
    // Check if form-feed character divides pages
    const splitByFormFeed = fullText.split(/\f/);
    if (splitByFormFeed.length > 1) {
      splitByFormFeed.forEach((pageText: string, idx: number) => {
        if (pageText.trim()) {
          pages.push({
            pageNumber: idx + 1,
            text: pageText.trim(),
          });
        }
      });
    }

    if (pages.length === 0) {
      // Chunk evenly across reported pages or 1500 chars
      const chunkSize = Math.max(800, Math.floor(fullText.length / Math.max(1, numPages)));
      for (let i = 0; i < Math.max(1, numPages); i++) {
        const slice = fullText.slice(i * chunkSize, (i + 1) * chunkSize).trim();
        if (slice) {
          pages.push({
            pageNumber: i + 1,
            text: slice,
          });
        }
      }
    }

    return {
      text: fullText,
      pageCount: Math.max(pages.length, numPages),
      pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: fullText.trim() || 'No readable text content found in document.' }],
    };
  } catch (err) {
    console.error('Error parsing PDF buffer with pdf-parse:', err);
    // Return gracefully parsed representation from raw buffer strings if possible
    const rawString = buffer.toString('utf-8', 0, Math.min(buffer.length, 50000));
    // extract readable ASCII characters
    const cleanAscii = rawString.replace(/[\x00-\x08\x0E-\x1F\x7F-\x9F]/g, ' ').replace(/\s+/g, ' ');
    return {
      text: cleanAscii,
      pageCount: 1,
      pages: [{ pageNumber: 1, text: cleanAscii.slice(0, 4000) }],
    };
  }
}

export function parseTextDocument(content: string): ParsedDocumentResult {
  const pages: { pageNumber: number; text: string }[] = [];
  const lines = content.split('\n');
  const linesPerPage = 45;

  let currentPage = 1;
  let currentChunk: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    currentChunk.push(lines[i]);
    if (currentChunk.length >= linesPerPage || i === lines.length - 1) {
      pages.push({
        pageNumber: currentPage,
        text: currentChunk.join('\n').trim(),
      });
      currentPage++;
      currentChunk = [];
    }
  }

  return {
    text: content,
    pageCount: pages.length || 1,
    pages: pages.length > 0 ? pages : [{ pageNumber: 1, text: content }],
  };
}
