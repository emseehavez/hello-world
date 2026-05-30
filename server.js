'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const app = express();
const PORT = process.env.PORT || 3000;

// The release text shown on the form and stamped onto the PDF (verbatim).
const RELEASE_PARAGRAPHS = [
  'I, the undersigned, give Listening Lab permission to record, photograph, and capture audio, video, and images of me (the "Media") in connection with Listening Lab\'s programs and activities.',
  'I grant Listening Lab and its partners a perpetual, worldwide, royalty-free, transferable, and irrevocable right to use, reproduce, edit, publish, distribute, and share the Media for any purpose, in any format or medium now known or later developed, including print, digital, social media, and promotional use.',
  'I understand that Listening Lab may share the Media with third-party partners and organizations, who may also use it as described above. I waive any right to inspect or approve the finished use of the Media, and I understand I will not receive payment or compensation of any kind.',
  'I confirm that I am at least 18 years old (or that a parent/guardian is signing on my behalf) and that I am freely granting these rights.'
];

// Where signed PDFs are saved: ~/Documents/Signed Media Releases
const OUTPUT_DIR = path.join(os.homedir(), 'Documents', 'Signed Media Releases');

// Accept larger JSON bodies because signatures are base64-encoded PNG images.
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Serve the signature_pad library from node_modules so the app works offline.
app.use(
  '/vendor/signature_pad.umd.min.js',
  express.static(
    path.join(__dirname, 'node_modules', 'signature_pad', 'dist', 'signature_pad.umd.min.js')
  )
);

// Expose the release text to the front end so it stays in one place.
app.get('/api/release-text', (req, res) => {
  res.json({ paragraphs: RELEASE_PARAGRAPHS });
});

/**
 * Turn an arbitrary name into something safe for a filename.
 * Falls back to "Unnamed" if nothing usable is left.
 */
function sanitizeForFilename(name) {
  const cleaned = String(name)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9 _-]/g, '') // drop anything that isn't safe
    .trim()
    .replace(/\s+/g, '_');
  return cleaned || 'Unnamed';
}

/**
 * Build a filename that never overwrites an existing file. If a file with the
 * same name already exists, append _2, _3, ... until we find a free name.
 */
function uniqueFilePath(dir, baseName) {
  let candidate = path.join(dir, `${baseName}.pdf`);
  let counter = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${baseName}_${counter}.pdf`);
    counter += 1;
  }
  return candidate;
}

// Decode a "data:image/png;base64,...." string into raw PNG bytes.
function dataUrlToPngBytes(dataUrl) {
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl || '');
  if (!match) return null;
  return Buffer.from(match[1], 'base64');
}

/**
 * Draw wrapped text onto a PDF page, advancing a cursor downward. Returns the
 * updated y position.
 */
function drawWrappedText(page, text, options) {
  const { font, size, x, maxWidth, lineHeight, color } = options;
  let { y } = options;
  const words = text.split(/\s+/);
  let line = '';

  const flush = () => {
    if (line) {
      page.drawText(line, { x, y, size, font, color });
      y -= lineHeight;
      line = '';
    }
  };

  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) > maxWidth && line) {
      flush();
      line = word;
    } else {
      line = trial;
    }
  }
  flush();
  return y;
}

/**
 * Generate the release PDF and return its raw bytes.
 */
async function buildPdf({ fullName, signaturePng, guardianName, guardianPng, signedDate }) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const teal = rgb(0x0d / 255, 0x4f / 255, 0x4f / 255);
  const black = rgb(0.1, 0.1, 0.1);

  const pageWidth = 612; // US Letter
  const pageHeight = 792;
  const margin = 54;
  const contentWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const ensureSpace = (needed) => {
    if (y - needed < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  // Header
  page.drawText('LISTENING LAB', { x: margin, y, size: 20, font: fontBold, color: teal });
  y -= 24;
  page.drawText('Media Release & Consent Form', { x: margin, y, size: 13, font, color: teal });
  y -= 28;
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1.5,
    color: teal
  });
  y -= 24;

  // Release body
  for (const paragraph of RELEASE_PARAGRAPHS) {
    ensureSpace(60);
    y = drawWrappedText(page, paragraph, {
      font,
      size: 11,
      x: margin,
      y,
      maxWidth: contentWidth,
      lineHeight: 15,
      color: black
    });
    y -= 10; // gap between paragraphs
  }

  // Signature section
  ensureSpace(160);
  y -= 10;
  page.drawText('Signed Name:', { x: margin, y, size: 11, font: fontBold, color: black });
  page.drawText(fullName, { x: margin + 90, y, size: 11, font, color: black });
  y -= 24;

  page.drawText('Date Signed:', { x: margin, y, size: 11, font: fontBold, color: black });
  page.drawText(signedDate, { x: margin + 90, y, size: 11, font, color: black });
  y -= 24;

  page.drawText('Signature:', { x: margin, y, size: 11, font: fontBold, color: black });
  y -= 8;

  const sigImage = await pdfDoc.embedPng(signaturePng);
  const sigDims = sigImage.scaleToFit(240, 90);
  ensureSpace(sigDims.height + 10);
  page.drawImage(sigImage, {
    x: margin,
    y: y - sigDims.height,
    width: sigDims.width,
    height: sigDims.height
  });
  y -= sigDims.height + 6;
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + 240, y },
    thickness: 0.75,
    color: black
  });
  y -= 24;

  // Optional guardian section
  if (guardianName && guardianPng) {
    ensureSpace(160);
    page.drawText('Parent / Guardian (if signing for a minor)', {
      x: margin,
      y,
      size: 11,
      font: fontBold,
      color: teal
    });
    y -= 22;

    page.drawText('Guardian Name:', { x: margin, y, size: 11, font: fontBold, color: black });
    page.drawText(guardianName, { x: margin + 105, y, size: 11, font, color: black });
    y -= 24;

    page.drawText('Guardian Signature:', { x: margin, y, size: 11, font: fontBold, color: black });
    y -= 8;

    const gImage = await pdfDoc.embedPng(guardianPng);
    const gDims = gImage.scaleToFit(240, 90);
    ensureSpace(gDims.height + 10);
    page.drawImage(gImage, {
      x: margin,
      y: y - gDims.height,
      width: gDims.width,
      height: gDims.height
    });
    y -= gDims.height + 6;
    page.drawLine({
      start: { x: margin, y },
      end: { x: margin + 240, y },
      thickness: 0.75,
      color: black
    });
  }

  return pdfDoc.save();
}

// Handle a submitted release.
app.post('/api/submit', async (req, res) => {
  try {
    const { fullName, signature, guardianName, guardianSignature } = req.body || {};

    const trimmedName = typeof fullName === 'string' ? fullName.trim() : '';
    const signaturePng = dataUrlToPngBytes(signature);

    if (!trimmedName) {
      return res.status(400).json({ error: 'A full name is required.' });
    }
    if (!signaturePng) {
      return res.status(400).json({ error: 'A signature is required.' });
    }

    // Guardian fields are optional but must come as a pair if used.
    const trimmedGuardian = typeof guardianName === 'string' ? guardianName.trim() : '';
    const guardianPng = dataUrlToPngBytes(guardianSignature);
    const hasGuardian = Boolean(trimmedGuardian && guardianPng);

    // Capture the signing date/time on the server at submit time.
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}${pad(now.getMinutes())}`;
    const humanDate = now.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const pdfBytes = await buildPdf({
      fullName: trimmedName,
      signaturePng,
      guardianName: hasGuardian ? trimmedGuardian : '',
      guardianPng: hasGuardian ? guardianPng : null,
      signedDate: humanDate
    });

    const baseName = `MediaRelease_${sanitizeForFilename(trimmedName)}_${dateStr}_${timeStr}`;
    let fileName = `${baseName}.pdf`;

    // Best-effort: also save a copy on the machine running the server. This
    // works when running locally (saves to ~/Documents/Signed Media Releases).
    // On a cloud host the disk is temporary, so the real delivery is the
    // download we return below — don't fail the request if the write fails.
    try {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      const filePath = uniqueFilePath(OUTPUT_DIR, baseName);
      fs.writeFileSync(filePath, pdfBytes);
      fileName = path.basename(filePath);
      console.log(`Saved signed release: ${filePath}`);
    } catch (writeErr) {
      console.warn(`Could not save a local copy (returning download only): ${writeErr.message}`);
    }

    // Always hand the signed PDF back to the browser so the signer/operator
    // can download, AirDrop, or email it — essential when deployed online.
    return res.json({
      ok: true,
      fileName,
      pdfBase64: Buffer.from(pdfBytes).toString('base64')
    });
  } catch (err) {
    console.error('Failed to save release:', err);
    return res.status(500).json({ error: 'Something went wrong saving the release.' });
  }
});

app.listen(PORT, () => {
  console.log('');
  console.log('  Listening Lab — Media Release app is running.');
  console.log(`  Local URL:                          http://localhost:${PORT}`);
  console.log(`  Local copies (when possible) saved: ${OUTPUT_DIR}`);
  console.log('  Each signer can also download their signed PDF from the app.');
  console.log('');
});
