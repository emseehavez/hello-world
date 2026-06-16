# Listening Lab — Media Release App · HANDOFF PACKAGE

> **Purpose of this file:** a complete, self-contained snapshot of the "Listening
> Lab Media Release" web app so it can be handed to another Claude Code
> conversation (the *Volunteer Conversation Recording Project*) and consolidated
> there. Everything needed to recreate the app is inline below — you do **not**
> need access to the original repo.
>
> **Google Drive is intentionally NOT included.** The destination project
> already has Google Drive set up, so this package leaves a clearly marked spot
> in `server.js` (`/api/submit`) where that existing uploader plugs in. Until
> then, the app returns the finished PDF for download.

---

## 1. Where it currently lives

- **Repo:** `https://github.com/emseehavez/hello-world` (Matt intends to retire this)
- **Host:** was on Render free tier. The destination project is on a different host.
- Treat the code below as the source of truth, not the repo.

---

## 2. What the app does

A mobile-first web app for collecting signed media releases. A participant opens
it on a phone/tablet, reads the release text, types their name, signs on a canvas
with a finger, and submits. On submit the server:

1. Builds a PDF containing the full release text, typed name, signature image,
   and an **auto-captured signing date** (the user never enters a date).
2. Hands the PDF off for storage. **← this is where the volunteer project's
   existing Google Drive upload plugs in** (see the marked block in `server.js`).
3. Until Drive is wired in, returns the PDF so the browser can **download** it.
4. Also writes a local copy to `~/Documents/Signed Media Releases` when running
   on a real computer (best-effort; harmless to remove).

Filenames: `MediaRelease_<Name>_<YYYY-MM-DD>_<HHMM>.pdf`, name sanitized for the
filesystem, never overwritten (collisions get `_2`, `_3`, …).

Other behavior:
- Validates that a name **and** a non-empty signature exist before submitting.
- Optional **Parent/Guardian** section (name + signature) included on the PDF
  only when filled in; the form asks for both pieces if one is started.
- Confirmation screen ("Thank you, your release has been signed") with a button
  to start a fresh release for the next person.
- Clean styling, dark teal (`#0d4f4f`) header.

---

## 3. Tech stack

- **Node + Express** server (`server.js`).
- **signature_pad** (npm) for finger-drawn signatures, served from
  `node_modules` so it works offline.
- **pdf-lib** for PDF generation.
- Plain HTML/CSS/JS front end in `public/` (no framework).

---

## 4. Where to plug in Google Drive

In `server.js`, inside `POST /api/submit`, there's a clearly marked block:

```js
// >>> PLUG IN THE VOLUNTEER PROJECT'S EXISTING GOOGLE DRIVE UPLOAD HERE <<<
//     await yourDrive.upload(Buffer.from(pdfBytes), fileName);
```

At that point you have `pdfBytes` (the finished PDF) and `fileName` (the desired
name). Call the destination project's existing Drive uploader there. Once it's
storing reliably, you can hide the download button in `public/app.js` and just
show the "saved" confirmation.

---

## 5. File tree

```
.
├── server.js          # Express server: form API, PDF build, Drive plug-in point
├── package.json
├── .gitignore
├── public/
│   ├── index.html     # form + confirmation screens
│   ├── styles.css     # mobile-first styling, teal header
│   └── app.js         # signature pads, validation, submit, PDF download
└── README.md          # (run instructions; not reproduced here — see §8)
```

`node_modules/` is installed via `npm install` (not included here).

---

## 6. Run it

```bash
npm install
npm start
# open the printed local URL (default http://localhost:3000)
```

Runs fully without any Google setup — it just offers the PDF as a download until
the project's Drive upload is wired into the marked spot.

---

## 7. Notes for consolidation

- **Suggested shape after merge:** expose the media-release form as a route/page
  within the volunteer project, and call that project's existing Drive uploader
  at the marked block in `/api/submit`. One app, one host, one Google setup.
- The release text in `server.js` (`RELEASE_PARAGRAPHS`) is verbatim/legal —
  keep it exactly as-is unless Matt says otherwise.
- The teal brand color is `#0d4f4f`.

---

# 8. FULL SOURCE

Everything below is the complete source. Recreate the files exactly.

---

## `package.json`

```json
{
  "name": "listening-lab-media-release",
  "version": "1.0.0",
  "description": "Collect signed media releases for Listening Lab and save each one as a PDF.",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "engines": {
    "node": ">=18"
  },
  "license": "MIT",
  "dependencies": {
    "express": "^4.19.2",
    "pdf-lib": "^1.17.1",
    "signature_pad": "^4.2.0"
  }
}
```

---

## `server.js`

```js
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

// Where signed PDFs are saved when running on a real computer.
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

    // Best-effort local copy (works when running on a real computer).
    try {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      const filePath = uniqueFilePath(OUTPUT_DIR, baseName);
      fs.writeFileSync(filePath, pdfBytes);
      fileName = path.basename(filePath);
      console.log(`Saved signed release: ${filePath}`);
    } catch (writeErr) {
      console.warn(`Could not save a local copy: ${writeErr.message}`);
    }

    // ======================================================================
    // >>> PLUG IN THE VOLUNTEER PROJECT'S EXISTING GOOGLE DRIVE UPLOAD HERE <<<
    //
    // `pdfBytes` is the finished PDF and `fileName` is the desired filename.
    // Call your project's existing Drive uploader, e.g.:
    //
    //     await yourDrive.upload(Buffer.from(pdfBytes), fileName);
    //
    // No Drive setup is included in this package on purpose — the destination
    // project already has Google Drive configured. Until that's wired in, the
    // app returns the PDF below so it can be downloaded.
    // ======================================================================

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
  console.log('');
});
```

---

## `public/index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Listening Lab — Media Release</title>
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <!-- FORM SCREEN -->
    <main id="form-screen">
      <header class="site-header">
        <h1>LISTENING LAB</h1>
        <p class="subtitle">Media Release &amp; Consent Form</p>
      </header>

      <section class="content">
        <div id="release-text" class="release-text" aria-label="Release text">
          <!-- Release paragraphs are inserted here by app.js -->
        </div>

        <form id="release-form" novalidate>
          <label class="field-label" for="full-name">Full Name</label>
          <input
            type="text"
            id="full-name"
            name="full-name"
            autocomplete="name"
            placeholder="Type your full name"
          />

          <div class="field-label-row">
            <span class="field-label">Signature</span>
            <button type="button" class="clear-btn" id="clear-signature">Clear</button>
          </div>
          <div class="signature-wrap">
            <canvas id="signature-pad" class="signature-canvas"></canvas>
          </div>

          <!-- Optional parent / guardian section -->
          <details class="guardian-section">
            <summary>Signing for a minor? Add parent / guardian (optional)</summary>

            <label class="field-label" for="guardian-name">Guardian Name</label>
            <input
              type="text"
              id="guardian-name"
              name="guardian-name"
              autocomplete="name"
              placeholder="Parent or guardian full name"
            />

            <div class="field-label-row">
              <span class="field-label">Guardian Signature</span>
              <button type="button" class="clear-btn" id="clear-guardian-signature">Clear</button>
            </div>
            <div class="signature-wrap">
              <canvas id="guardian-signature-pad" class="signature-canvas"></canvas>
            </div>
          </details>

          <p id="error-message" class="error-message" role="alert" hidden></p>

          <button type="submit" id="submit-btn" class="submit-btn">Submit</button>
        </form>
      </section>
    </main>

    <!-- CONFIRMATION SCREEN -->
    <main id="confirmation-screen" hidden>
      <header class="site-header">
        <h1>LISTENING LAB</h1>
        <p class="subtitle">Media Release &amp; Consent Form</p>
      </header>
      <section class="content confirmation">
        <div class="check-circle" aria-hidden="true">&#10003;</div>
        <h2>Thank you, your release has been signed.</h2>
        <p class="confirm-detail" id="confirm-detail"></p>
        <a id="download-btn" class="submit-btn" download hidden>Download signed PDF</a>
        <button type="button" id="new-release-btn" class="submit-btn secondary-btn">Start a new release</button>
      </section>
    </main>

    <script src="/vendor/signature_pad.umd.min.js"></script>
    <script src="app.js"></script>
  </body>
</html>
```

---

## `public/styles.css`

```css
:root {
  --teal: #0d4f4f;
  --teal-dark: #093a3a;
  --bg: #f4f6f6;
  --text: #1d2424;
  --muted: #5c6a6a;
  --border: #cdd6d6;
  --error: #b3261e;
  --white: #ffffff;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
  -webkit-text-size-adjust: 100%;
}

/* Header */
.site-header {
  background: var(--teal);
  color: var(--white);
  padding: 20px 20px 18px;
  text-align: center;
}

.site-header h1 {
  margin: 0;
  font-size: 1.5rem;
  letter-spacing: 2px;
}

.site-header .subtitle {
  margin: 4px 0 0;
  font-size: 0.95rem;
  opacity: 0.9;
}

/* Content */
.content {
  max-width: 640px;
  margin: 0 auto;
  padding: 20px 18px 48px;
}

.release-text p {
  margin: 0 0 14px;
  font-size: 0.95rem;
  color: var(--text);
}

/* Form fields */
.field-label {
  display: block;
  font-weight: 600;
  font-size: 0.95rem;
  margin: 18px 0 6px;
  color: var(--teal-dark);
}

.field-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 18px 0 6px;
}

.field-label-row .field-label {
  margin: 0;
}

input[type="text"] {
  width: 100%;
  padding: 13px 14px;
  font-size: 1rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--white);
  color: var(--text);
}

input[type="text"]:focus {
  outline: none;
  border-color: var(--teal);
  box-shadow: 0 0 0 3px rgba(13, 79, 79, 0.15);
}

/* Signature pad */
.signature-wrap {
  position: relative;
  width: 100%;
  height: 180px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--white);
  overflow: hidden;
  touch-action: none; /* let the canvas capture finger drawing */
}

.signature-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.clear-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--teal-dark);
  padding: 6px 14px;
  font-size: 0.85rem;
  border-radius: 6px;
  cursor: pointer;
}

.clear-btn:active {
  background: #e8eded;
}

/* Guardian section */
.guardian-section {
  margin-top: 24px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--white);
  padding: 4px 14px 14px;
}

.guardian-section summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--teal-dark);
  padding: 12px 0;
  list-style-position: inside;
}

/* Submit + actions */
.submit-btn {
  display: block;
  width: 100%;
  margin-top: 26px;
  padding: 16px;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--white);
  background: var(--teal);
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.submit-btn:active {
  background: var(--teal-dark);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

/* Anchor styled as a button (download link) */
a.submit-btn {
  text-align: center;
  text-decoration: none;
}

/* Secondary action on the confirmation screen */
.secondary-btn {
  background: transparent;
  color: var(--teal);
  border: 1px solid var(--teal);
  margin-top: 12px;
}

.secondary-btn:active {
  background: #e8eded;
}

/* Errors */
.error-message {
  margin: 18px 0 0;
  padding: 12px 14px;
  background: #fbe9e7;
  border: 1px solid var(--error);
  border-radius: 8px;
  color: var(--error);
  font-size: 0.95rem;
}

/* Confirmation screen */
.confirmation {
  text-align: center;
  padding-top: 48px;
}

.check-circle {
  width: 72px;
  height: 72px;
  margin: 0 auto 20px;
  border-radius: 50%;
  background: var(--teal);
  color: var(--white);
  font-size: 2.2rem;
  line-height: 72px;
}

.confirmation h2 {
  font-size: 1.3rem;
  color: var(--teal-dark);
  margin: 0 0 10px;
}

.confirm-detail {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 0 0 8px;
  word-break: break-word;
}
```

---

## `public/app.js`

```js
'use strict';

(function () {
  const formScreen = document.getElementById('form-screen');
  const confirmationScreen = document.getElementById('confirmation-screen');
  const form = document.getElementById('release-form');
  const nameInput = document.getElementById('full-name');
  const guardianNameInput = document.getElementById('guardian-name');
  const errorMessage = document.getElementById('error-message');
  const submitBtn = document.getElementById('submit-btn');
  const confirmDetail = document.getElementById('confirm-detail');
  const downloadBtn = document.getElementById('download-btn');

  // Track the object URL for the current download so we can release it later.
  let downloadUrl = null;

  const sigCanvas = document.getElementById('signature-pad');
  const guardianCanvas = document.getElementById('guardian-signature-pad');

  let signaturePad;
  let guardianPad;

  // Load the release text from the server so it lives in one place.
  fetch('/api/release-text')
    .then((res) => res.json())
    .then((data) => {
      const container = document.getElementById('release-text');
      container.innerHTML = '';
      (data.paragraphs || []).forEach((text) => {
        const p = document.createElement('p');
        p.textContent = text;
        container.appendChild(p);
      });
    })
    .catch(() => {
      document.getElementById('release-text').textContent =
        'Unable to load the release text. Please refresh the page.';
    });

  /**
   * Size a canvas for the device pixel ratio so the drawing is crisp and the
   * pointer position stays aligned. Returns nothing; mutates the canvas.
   */
  function resizeCanvas(canvas, pad) {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    if (pad) {
      pad.clear(); // resizing clears the canvas; reset the pad state too
    }
  }

  function setupPads() {
    signaturePad = new SignaturePad(sigCanvas, { penColor: '#0d2b2b' });
    guardianPad = new SignaturePad(guardianCanvas, { penColor: '#0d2b2b' });
    resizeCanvas(sigCanvas, signaturePad);
    resizeCanvas(guardianCanvas, guardianPad);
  }

  setupPads();

  // Re-fit canvases on rotation / resize.
  window.addEventListener('resize', () => {
    resizeCanvas(sigCanvas, signaturePad);
    resizeCanvas(guardianCanvas, guardianPad);
  });

  document.getElementById('clear-signature').addEventListener('click', () => {
    signaturePad.clear();
  });
  document.getElementById('clear-guardian-signature').addEventListener('click', () => {
    guardianPad.clear();
  });

  // Convert a base64 string into a PDF Blob for downloading.
  function pdfBlobFromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: 'application/pdf' });
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
  }

  function clearError() {
    errorMessage.hidden = true;
    errorMessage.textContent = '';
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError();

    const fullName = nameInput.value.trim();
    if (!fullName) {
      showError('Please type your full name before submitting.');
      nameInput.focus();
      return;
    }
    if (signaturePad.isEmpty()) {
      showError('Please add your signature before submitting.');
      return;
    }

    const guardianName = guardianNameInput.value.trim();
    const guardianHasSignature = !guardianPad.isEmpty();
    // If they started the guardian section, ask for both pieces.
    if ((guardianName && !guardianHasSignature) || (!guardianName && guardianHasSignature)) {
      showError('For the guardian section, please provide both a name and a signature (or leave both blank).');
      return;
    }

    const payload = {
      fullName,
      signature: signaturePad.toDataURL('image/png'),
      guardianName: guardianName || undefined,
      guardianSignature: guardianHasSignature ? guardianPad.toDataURL('image/png') : undefined
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Submission failed.');
      }

      // Offer the signed PDF for download (save to Files, AirDrop, email…).
      // NOTE: once the project's Drive upload is wired in on the server, you can
      // hide this button and just show a "saved" confirmation instead.
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        downloadUrl = null;
      }
      if (data.pdfBase64) {
        const blob = pdfBlobFromBase64(data.pdfBase64);
        downloadUrl = URL.createObjectURL(blob);
        downloadBtn.href = downloadUrl;
        downloadBtn.setAttribute('download', data.fileName || 'MediaRelease.pdf');
        downloadBtn.hidden = false;
      } else {
        downloadBtn.hidden = true;
      }

      confirmDetail.textContent = data.fileName || '';
      formScreen.hidden = true;
      confirmationScreen.hidden = false;
      window.scrollTo(0, 0);
    } catch (err) {
      showError(err.message || 'Something went wrong. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
    }
  });

  // Reset everything for the next person.
  document.getElementById('new-release-btn').addEventListener('click', () => {
    form.reset();
    signaturePad.clear();
    guardianPad.clear();
    clearError();
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      downloadUrl = null;
    }
    downloadBtn.hidden = true;
    confirmationScreen.hidden = true;
    formScreen.hidden = false;
    // Re-fit in case the viewport changed while the confirmation was showing.
    resizeCanvas(sigCanvas, signaturePad);
    resizeCanvas(guardianCanvas, guardianPad);
    window.scrollTo(0, 0);
  });
})();
```

---

## `.gitignore`

```
node_modules/
*.log
.DS_Store
```

*End of handoff package.*
