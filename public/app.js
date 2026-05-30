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

      // Prepare the signed PDF for download (save to Files, AirDrop, email…).
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

      confirmDetail.textContent = data.fileName ? data.fileName : '';
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
