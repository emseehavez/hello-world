# Listening Lab — Media Release App

A simple, mobile-first web app for collecting signed media releases for
**Listening Lab**. Participants open it on a phone or tablet, read the release,
type their name, sign with a finger, and submit. Each signed release is saved
as its own PDF in a folder on your computer.

There are two ways to run it:

- **A) Put it online** so it opens in any phone browser via a link — no computer
  needed. Each signed release comes back as a **downloadable PDF**. See
  [Deploy online (from your phone)](#deploy-online-from-your-phone).
- **B) Run it locally** on your own Mac/PC, where each release also auto-saves
  as a PDF into your Documents folder. See [Install and run](#install-and-run).

---

## Deploy online (from your phone)

This uses [Render](https://render.com)'s free tier and can be done entirely from
an iPhone — no computer required. The code already includes a `render.yaml` that
configures everything.

1. The app's code is on GitHub at `emseehavez/hello-world` (branch
   `claude/listening-lab-release-app-s0Qhd`). Make sure it's pushed there.
2. In Safari, go to **render.com** and sign up (free) — signing in with GitHub
   is easiest.
3. Tap **New** → **Web Service** → connect your GitHub and pick the
   `hello-world` repository.
4. Choose the branch `claude/listening-lab-release-app-s0Qhd` (or `main` if
   you've merged it). Render reads `render.yaml`, so the build command
   (`npm install`) and start command (`npm start`) are filled in for you. Make
   sure the **Free** plan is selected.
5. Tap **Create / Deploy** and wait a couple of minutes. Render gives you a
   public link like `https://listening-lab-media-release.onrender.com`.
6. Open that link on any phone or tablet to collect signatures.

**Getting the signed PDFs:** when deployed online, the app shows a **Download
signed PDF** button on the thank-you screen after each signature. On an iPhone
that opens the PDF so you can **Save to Files**, **AirDrop**, or **email** it to
yourself. (Online hosts don't keep files permanently, so always grab the PDF via
that button.)

> Note: on Render's free plan the app "sleeps" after ~15 minutes of no use, so
> the very first visit after a quiet spell can take ~30–50 seconds to wake up.
> Open the link a minute before you need it at an event.

---

## What you need (to run locally)

- [Node.js](https://nodejs.org/) version 18 or newer (this installs `npm` too).
  To check what you have, run `node -v` in a terminal.

## Install and run

From this project folder, run these two commands:

```bash
npm install
npm start
```

When it starts, the terminal prints a local URL, for example:

```
  Listening Lab — Media Release app is running.
  Open this on your phone or tablet:  http://localhost:3000
  Signed PDFs are saved to:           /Users/you/Documents/Signed Media Releases
```

Open that URL in a browser. To stop the app, press `Ctrl + C` in the terminal.

## Using it on a phone or tablet (same Wi-Fi)

`localhost` only works on the computer running the app. To use a phone or
tablet on the **same Wi-Fi network**:

1. Find your computer's local IP address.
   - **macOS:** System Settings → Wi-Fi → Details → look for the IP (e.g. `192.168.1.42`).
   - **Windows:** run `ipconfig` and look for the "IPv4 Address".
2. On the phone/tablet, open `http://<that-ip>:3000` (e.g. `http://192.168.1.42:3000`).

The computer running the app must stay on and awake.

## Automatic upload to Google Drive

When configured, every signed release is uploaded **automatically** to a Google
Drive folder — no download step. The thank-you screen just says
"Saved to the Listening Lab Google Drive folder."

This needs a one-time setup in your own Google account (Google requires your
permission before any app can write to your Drive). All of it can be done from a
phone, but it's fiddly — take it slowly.

**A. Create Google OAuth credentials**

1. Go to **console.cloud.google.com** and create a project (any name).
2. Search for and **enable** the **Google Drive API**.
3. Go to **APIs & Services → OAuth consent screen**. Choose **External**, fill in
   the app name and your email, and **add your own Google address as a Test
   user**. To avoid the login expiring weekly, later set the publishing status to
   **In production** (you'll see an "unverified app" warning — that's fine for
   personal use; tap **Advanced → continue**).
4. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Under **Authorized redirect URIs**, add your app's address followed by
     `/oauth2callback`, e.g. `https://your-app.onrender.com/oauth2callback`.
   - Create it, then copy the **Client ID** and **Client secret**.

**B. Put the credentials into the app (Render → Environment)**

In your Render service, open **Environment** and add:

| Key | Value |
| --- | --- |
| `GOOGLE_CLIENT_ID` | the Client ID from step A4 |
| `GOOGLE_CLIENT_SECRET` | the Client secret from step A4 |
| `GDRIVE_FOLDER_ID` | `1YjuH6TGdtpZ0MIZChItaBRLKOMaY8RFE` (already the default) |

Save — Render redeploys automatically.

**C. Authorize once to get the refresh token**

1. Visit `https://your-app.onrender.com/setup/google` in a browser.
2. Sign in with **the Google account that owns the Drive folder** and approve.
3. The page shows a **refresh token**. Copy it.
4. Back in Render → Environment, add one more variable:
   `GOOGLE_REFRESH_TOKEN` = the token you copied. Save (it redeploys).

That's it. From now on, every submission lands in your Drive folder
automatically. (Until this is finished, the app falls back to offering a
download so it's always usable.)

> The destination folder is set with `GDRIVE_FOLDER_ID`. Make sure you authorize
> with the Google account that can write to that folder.

## Where the signed PDFs go

If Google Drive isn't configured yet, the thank-you screen falls back to a
**Download signed PDF** button so you can save/AirDrop/email the release from any
device.

When running **locally**, every submission is *also* saved automatically as a
PDF in:

```
<your home folder>/Documents/Signed Media Releases
```

The folder is created automatically the first time someone submits. (When
running on a cloud host this local copy is skipped — use the download button.) Files are
named like:

```
MediaRelease_Jane_Doe_2026-05-30_1432.pdf
```

That is `MediaRelease_<Name>_<YYYY-MM-DD>_<HHMM>.pdf`. The name is cleaned up to
be filesystem-safe, and existing files are **never overwritten** — if a name
would collide, a number is added (e.g. `..._1432_2.pdf`).

## How it works (for the curious)

- The **date is captured automatically** when someone taps Submit — it is not a
  field anyone fills in — and it is stamped on the PDF as the signing date.
- The app checks that a name **and** a non-empty signature are present before
  submitting, and shows a friendly inline message if either is missing.
- After a successful submit, a confirmation screen appears with a button to
  start a fresh release for the next person.
- The optional **Parent / Guardian** section only needs to be filled in when an
  adult is signing for a minor. If a guardian name and signature are provided,
  they are included on the PDF.

## Tech used

- **Express** — small local web server (`server.js`).
- **signature_pad** — finger-drawn signatures on an HTML canvas.
- **pdf-lib** — generates each release PDF on the server.
- Plain HTML/CSS/JS front end in the `public/` folder (no framework).

## Project layout

```
.
├── server.js          # Express server: serves the page, builds & saves PDFs
├── package.json       # dependencies and the "npm start" script
├── public/
│   ├── index.html     # the form + confirmation screens
│   ├── styles.css     # mobile-first styling, dark teal header
│   └── app.js         # signature pads, validation, submit handling
└── README.md
```
