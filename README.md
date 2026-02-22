# Church Questions App

A simple, mobile-first web app where people can submit questions, view the live feed, and upvote what they most want answered.

Built for live church Q&A moments (sermon series, panel nights, youth events, town halls).

**Repo:** https://github.com/razbradley1/simple-church-qanda

## What it does

- Public page for question submission
- Live public feed with upvotes
- Admin page for moderation
  - Hide / Unhide questions
  - Delete questions
  - Clear all
- Shared backend storage so submissions from many phones show up on one moderator screen

---

## Quick Deploy (Vercel)

### 1) Prerequisites

- A GitHub account
- A Vercel account (free works)
- A running NocoDB instance you control
- A NocoDB API token scoped to only this app/base
- This repo in your GitHub account

### 2) Create your NocoDB table

Create a table named `questions` with these columns:

- `id` (ID / primary key)
- `qid` (SingleLineText) — public question ID
- `text` (LongText)
- `votes` (Number)
- `hidden` (Checkbox)

> Note: System columns like CreatedAt/UpdatedAt are fine and used for sorting.

### 3) Import to Vercel

1. Go to [https://vercel.com/new](https://vercel.com/new)
2. Import `simple-church-qanda` (or your forked copy)
3. Keep defaults (no special framework settings needed)
4. Add these Environment Variables in Vercel Project Settings:
   - `NOCO_URL` → `https://your-nocodb-domain.com`
   - `NOCO_BASE_ID` → your base/project ID
   - `NOCO_TABLE_ID` → your questions table ID
   - `NOCO_TOKEN` → your NocoDB API token
5. Click **Deploy**

That’s it — you’ll get a live URL in about a minute.

---

## Your two links

After deploy, you’ll have:

- **Public submit page:** `https://your-app.vercel.app/`
- **Admin page:** `https://your-app.vercel.app/admin.html`

Use the public page as a QR code for the congregation.
Keep the admin page open on a laptop for moderation.

---

## Suggested Sunday Workflow

1. Put a QR code on screen linking to the public page.
2. Tell people to submit and upvote.
3. Moderator watches `admin.html` and hides junk/off-topic questions.
4. Speaker answers top-voted live questions.

---

## Customizing text/branding

- `index.html` → page title and wording
- `styles.css` → colors, typography, spacing
- `admin.html` → admin title text

---

## Important notes

- This is a lightweight app intended for practical use, not enterprise compliance.
- `admin.html` is currently public if someone guesses the URL.
  - Recommended next step: add admin auth (password or SSO).
- Votes are one-per-question per browser/device (local browser lock).
- Never commit NocoDB credentials into git.
  - Keep `NOCO_TOKEN` only in Vercel environment variables.
  - If a token was ever shared in chat/logs, rotate it.

---

## Updating later

1. Edit files locally
2. Commit + push to `main`
3. Vercel auto-deploys from GitHub

---

## Support / Next upgrades

If you want this production-hardened for larger churches, add:

- Admin login
- Profanity/spam filtering
- IP/device rate limiting
- Export to CSV
- Session mode (separate question sets per service)
