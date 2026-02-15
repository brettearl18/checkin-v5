# Version 2 Check-In System — Build Separate, Migrate Later

This doc describes how to build a new check-in system (v2) without affecting the current app (v1), and how to migrate v1 data into v2 for a smooth cutover.

---

## 1. Keep v1 and v2 Separate While Building

### Option A: New repository (recommended)
- Create a new repo (e.g. `checkin-v6` or `checkin-v2`).
- Build v2 from scratch or by copying v1 and refactoring.
- **Pros:** Clear separation, no risk of deploying v2 code to v1, independent CI/CD.
- **Cons:** You maintain two repos until cutover.

### Option B: Monorepo or branch
- Same repo: v2 in a folder (e.g. `/v2` or `/apps/checkin-v2`) or on a long-lived branch (e.g. `v2`).
- Deploy only `main` (v1) to production; v2 is built and tested separately.
- **Pros:** One repo, easy to copy-paste and compare.
- **Cons:** Need discipline so v2 changes never get merged to main until you’re ready.

### Option C: New Firebase / GCP project for v2
- Create a new Firebase project (and Cloud Run project if used) for v2.
- v1 stays on the current project; v2 uses the new one.
- **Pros:** Complete isolation: no risk of v2 breaking v1; separate auth, DB, and billing.
- **Cons:** Later you’ll need to decide: migrate v1 data into v2’s project, or keep one project and two codebases.

**Recommendation:** New repo **and** new Firebase/GCP project for v2. Build and test v2 there; when ready, run a one-time (or phased) migration of v1 data into v2’s database.

---

## 2. v1 Data You’ll Want to Migrate

From the current codebase, these Firestore collections (and related bits) hold the data you’ll likely want in v2:

| Collection / area | Purpose | Migration priority |
|-------------------|--------|---------------------|
| `clients` | Client profiles, coachId, authUid, payment fields | **Critical** |
| `coaches` | Coach profiles | **Critical** |
| `users` | Auth-linked user records (role, email) | **Critical** |
| `forms` | Form definitions | **Critical** |
| `questions` | Questions per form (often subcollection or linked) | **Critical** |
| `check_in_assignments` | Assigned check-ins (client, form, dueDate, status, recurringWeek, etc.) | **Critical** |
| `formResponses` | Submitted check-in answers, scores, assignmentId | **Critical** |
| `coachFeedback` | Coach feedback on responses (responseId) | **High** |
| `client_measurements` | Measurements (e.g. body weight) | **High** |
| `progress_images` | Before/after photos | **High** |
| `clientGoals` | Client goals | **High** |
| `clientScoring` | Scoring config per client | **Medium** |
| `client_onboarding` / `client_onboarding_responses` | Onboarding state | **Medium** |
| `measurement_schedules` | When to take measurements | **Medium** |
| `notifications` | In-app notifications | **Low** (optional) |
| `messages` | If you use in-app messaging | **Low** (optional) |
| `wellnessResources` | Resources shown in client portal | **Low** (optional) |

**Auth:** Firebase Auth users (coaches and clients) live in the Firebase project. For v2 you can either (a) use the **same** Firebase project and same Auth users, or (b) use a **new** project and migrate users (export/import or link accounts). Same project is simpler for “same people, new app.”

---

## 3. Align v2 Data Model With v1 (Makes Import Easy)

- **Option 1 — Same shape:** Design v2’s Firestore schema to match v1’s collections and main fields. Then migration is “copy documents (with optional transforms for dates/refs).”
- **Option 2 — New shape:** Design v2 with a cleaner or different schema. You’ll need an **import layer** (scripts or one-off Cloud Functions) that:
  - Reads from v1 (export files or direct read from v1 DB).
  - Maps old collections/fields to new (e.g. `clientId` → `tenantId` + `clientId` if you add multi-tenancy).
  - Writes into v2’s Firestore (and fixes up any references).

**Practical tip:** Keep collection names and document IDs the same where possible (e.g. `clients`, `forms`, `check_in_assignments`, `formResponses`). That keeps references (e.g. `assignmentId`, `responseId`, `clientId`) valid and avoids big ID-mapping tables.

---

## 4. Exporting Data From v1 (When You’re Ready)

- **Firestore backup:** Use [Firestore exports](https://firebase.google.com/docs/firestore/manage-data/export-import) (e.g. to GCS). You can export the whole DB or selected collections. Restore into a **staging** v2 project first to test migration.
- **Scripted export:** Write a Node script (using Admin SDK) that reads each collection and writes JSON/NDJSON to Cloud Storage or to files. Run it against v1’s project (read-only). Gives you a point-in-time snapshot and full control over what to migrate.
- **When to run:** Run export during a low-usage window. Optionally put v1 in “read-only” for a short period for a consistent snapshot, or accept “last write wins” for any changes during the copy.

---

## 5. Importing Into v2

- **If v2 schema matches v1:**  
  Use Firestore import from the export, or a script that reads your export files and writes to v2’s Firestore (same project or v2’s project) with `set()` or `add()` (with explicit IDs to preserve links).

- **If v2 schema differs:**  
  Write a **migration script** that:
  1. Reads v1 export (or v1 Firestore if same project).
  2. For each document, maps to v2’s structure (new collection names, new fields, split/merge docs if needed).
  3. Writes to v2 Firestore. Use batch writes (e.g. 500 docs per batch) to avoid rate limits.
  4. Preserves or builds ID mapping for references (e.g. if you change client IDs, keep a map `oldId → newId` and rewrite all references).

- **Order of import (to respect references):**  
  e.g. `users` → `coaches` → `clients` → `forms` → `questions` → `check_in_assignments` → `formResponses` → `coachFeedback` → `client_measurements` → `progress_images` → `clientGoals` → etc. Adjust if v2 has different dependencies.

- **Auth:** If v2 uses a **new** Firebase project, you must create users in the new project (e.g. Firebase Admin `createUser` from an export of v1’s Auth users, or use Auth import if available). Then ensure v2’s `clients`/`users` use the new UIDs, or keep the same UIDs if you use Auth export/import.

---

## 6. Cutover Strategy

- **Big bang:** Pick a cutover window; run export from v1, run import into v2, switch DNS/app to v2, turn off v1 writes (or retire v1).
- **Phased:** Migrate read-only history first (e.g. old formResponses, clients, assignments). v2 reads historical data; new activity still happens in v1. Then do a second phase: migrate “current” state (e.g. active assignments, unsent notifications) and switch traffic to v2.
- **Redirects:** After cutover, redirect old v1 URLs to v2 (e.g. `/client-portal` → v2’s client portal). Keeps bookmarks and links working.

---

## 7. Checklist for a Smooth Transition

- [ ] **v2 codebase** in its own repo or clearly separated path; v1 deploys unchanged.
- [ ] **v2 environment** (new Firebase/GCP project or clearly separate config) so v2 never touches v1 data in production.
- [ ] **Data model** for v2 documented; mapping from v1 collections/fields to v2 defined.
- [ ] **Export** from v1 tested (Firestore export or script) and run in a low-impact window.
- [ ] **Import/migration script** tested on a **copy** of v1 data (e.g. staging v2 project); validate counts and spot-checks (clients, forms, responses, assignments, feedback).
- [ ] **Auth** plan: same project (easiest) or new project + user migration; v2 login works for migrated users.
- [ ] **Cutover** plan: who does what, when; rollback if import or v2 fails.
- [ ] **Post-cutover:** redirects, monitoring, and a short period of “v1 read-only” or parallel run if useful.

---

## 8. Quick Reference: v1 Firestore Collections

Use this as the list to export and map into v2:

```
clients
coaches
users
forms
questions (or forms/{id}/questions)
check_in_assignments
formResponses
coachFeedback
client_measurements
progress_images
clientGoals
clientScoring
client_onboarding
client_onboarding_responses
measurement_schedules
notifications
messages
wellnessResources
```

(Subcollections and custom-named collections in your project should be added to this list.)

---

*Update this doc as you lock in v2’s repo, project, and schema so it stays the single place for “how we build v2 and how we’ll migrate.”*
