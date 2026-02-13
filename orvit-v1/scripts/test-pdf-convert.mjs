// Test script to check pdf-to-img and canvas compatibility
import { pdf } from 'pdf-to-img';
import { createCanvas, Image, ImageData } from 'canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

// Set globals
globalThis.Image = Image;
globalThis.ImageData = ImageData;

const testPdfPath = process.argv[2] || 'test.pdf';

console.log('Testing PDF conversion...');
console.log('PDF path:', testPdfPath);
console.log('pdfjs-dist version check...');

try {
  // Test 1: pdf-to-img
  console.log('\n--- Test 1: pdf-to-img ---');
  let count = 0;
  for await (const img of await pdf(testPdfPath, { scale: 1.0 })) {
    count++;
    console.log(`Page ${count}: ${img.length} bytes`);
    if (count >= 3) break; // Only test first 3 pages
  }
  console.log(`pdf-to-img SUCCESS: ${count} pages`);
} catch (err) {
  console.error('pdf-to-img FAILED:', err.message);
}

try {
  // Test 2: pdfjs-dist + canvas
  console.log('\n--- Test 2: pdfjs-dist + canvas ---');

  const fs = await import('fs');
  const buffer = fs.readFileSync(testPdfPath);

  class NodeCanvasFactory {
    create(width, height) {
      const canvas = createCanvas(width, height);
      return { canvas, context: canvas.getContext('2d') };
    }
    reset(cc, w, h) { cc.canvas.width = w; cc.canvas.height = h; }
    destroy(cc) { cc.canvas.width = 0; cc.canvas.height = 0; }
  }

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    canvasFactory: new NodeCanvasFactory(),
    isOffscreenCanvasSupported: false,
  }).promise;

  console.log(`Loaded PDF with ${doc.numPages} pages`);

  for (let i = 1; i <= Math.min(3, doc.numPages); i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    const { canvas, context } = new NodeCanvasFactory().create(viewport.width, viewport.height);

    await page.render({ canvasContext: context, viewport }).promise;
    const pngBuffer = canvas.toBuffer('image/png');
    console.log(`Page ${i}: ${pngBuffer.length} bytes`);
  }

  console.log('pdfjs-dist + canvas SUCCESS');
} catch (err) {
  console.error('pdfjs-dist + canvas FAILED:', err.message);
  console.error(err.stack);
}
