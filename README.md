# Listening Lab — Media Release App

A simple, mobile-first web app for collecting signed media releases for
**Listening Lab**. Participants open it on a phone or tablet, read the release,
type their name, sign with a finger, and submit. Each signed release is saved
as its own PDF in a folder on your computer.

## What you need

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

## Where the signed PDFs go

Every submission is saved as a PDF in:

```
<your home folder>/Documents/Signed Media Releases
```

The folder is created automatically the first time someone submits. Files are
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
