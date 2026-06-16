'use strict';

// Uploads signed-release PDFs to a Google Drive folder using the operator's own
// Google account (OAuth2 with a long-lived refresh token). We use the user's own
// account — rather than a service account — because service accounts can't write
// into a personal ("My Drive") folder due to storage-quota limits.

const { google } = require('googleapis');
const { Readable } = require('stream');

// The destination folder. Defaults to the Listening Lab folder you shared, but
// can be overridden with an env var.
const FOLDER_ID = process.env.GDRIVE_FOLDER_ID || '1YjuH6TGdtpZ0MIZChItaBRLKOMaY8RFE';

// Full Drive scope so we can place files into your existing folder by its ID.
const SCOPES = ['https://www.googleapis.com/auth/drive'];

function getClientId() {
  return process.env.GOOGLE_CLIENT_ID;
}
function getClientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET;
}

// True once all three credentials are present, i.e. uploads can happen.
function isConfigured() {
  return Boolean(getClientId() && getClientSecret() && process.env.GOOGLE_REFRESH_TOKEN);
}

// True once the app at least has an OAuth client (enough to start the one-time
// authorization that produces the refresh token).
function canStartAuth() {
  return Boolean(getClientId() && getClientSecret());
}

function makeOAuthClient(redirectUri) {
  return new google.auth.OAuth2(getClientId(), getClientSecret(), redirectUri);
}

// Build the Google consent URL the operator visits once to authorize the app.
function getAuthUrl(redirectUri) {
  if (!canStartAuth()) return null;
  const client = makeOAuthClient(redirectUri);
  return client.generateAuthUrl({
    access_type: 'offline', // ask for a refresh token
    prompt: 'consent', // force a refresh token to be returned
    scope: SCOPES
  });
}

// Exchange the one-time code from Google for tokens (including refresh_token).
async function exchangeCode(code, redirectUri) {
  const client = makeOAuthClient(redirectUri);
  const { tokens } = await client.getToken(code);
  return tokens;
}

// Upload a PDF (Buffer) into the destination folder. Returns the created file's
// metadata, including a link to view it.
async function uploadPdf(buffer, fileName) {
  const client = makeOAuthClient();
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  const drive = google.drive({ version: 'v3', auth: client });

  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [FOLDER_ID] },
    media: { mimeType: 'application/pdf', body: Readable.from(buffer) },
    fields: 'id, name, webViewLink'
  });
  return res.data;
}

module.exports = {
  FOLDER_ID,
  isConfigured,
  canStartAuth,
  getAuthUrl,
  exchangeCode,
  uploadPdf
};
