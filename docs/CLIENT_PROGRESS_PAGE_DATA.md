# Client Progress Page – Data Flow

**URL:** `/clients/[id]/progress`  
**Example:** https://checkinv5.web.app/clients/AccDHIRYyeP0mDZNsRf95AuA4NO2/progress

## How data is drawn in

The progress page loads **client** first, then uses a **resolved client id** (`effectiveClientId = client?.id ?? clientId`) for all data APIs. That way it works whether the URL `[id]` is the Firestore **document id** or the client’s **auth UID** (e.g. from a shared link).

| Data | Source API | What it’s used for |
|------|------------|--------------------|
| **Client profile** | `GET /api/clients/[id]` | Name, profile; also resolves doc id when URL is authUid. |
| **Question / check-in history** | `GET /api/client-portal/history?clientId=` | Form responses and assignments; builds question-level progress over time. |
| **Measurements** | `GET /api/client-measurements?clientId=` | Weight/measurements for charts. |
| **Onboarding baseline** | `GET /api/client-portal/onboarding/report?clientId=` | Baseline measurements merged with `client-measurements`. |
| **Progress images** | `GET /api/progress-images?clientId=&limit=12` | Before/after and progress photos. |
| **Check-ins awaiting response** | `GET /api/dashboard/check-ins-to-review?coachId=` | Filtered to this client, `!coachResponded`. |
| **Week debug** | `GET /api/clients/[id]/progress-week-debug` | Assignments vs responses for week alignment. |
| **Reassign / correct week** | `PATCH/POST` on progress-week-debug and reassign-response-to-week | Fixing which week a response belongs to. |

All of the above (except client profile and check-ins-to-review) are called with **`effectiveClientId`** (resolved document id), so formResponses, client_measurements, progress_images, and assignments – which store the **client document id** in their `clientId` field – return the correct data even when the URL uses the auth UID.

## Data linkage

- **formResponses** → `clientId` = client document id (set when the client submits).
- **check_in_assignments** → `clientId` = client document id.
- **client_measurements** → `clientId` = client document id.
- **progress_images** → `clientId` = client document id.
- **client-portal/history** returns responses and assignments for the given `clientId`; the page deduplicates by `assignmentId` and builds question progress from `responses[].responses`.

So as long as the progress page uses **`effectiveClientId`** for these APIs (and the client doc is loaded first so `client.id` is available when it differs from the URL), all data is linked correctly to the client.

## Possible gaps

1. **History API** – Only returns formResponses and assignments; no other “activity” (e.g. goals, messages) is shown on this page.
2. **Check-ins to review** – Filter is `checkIn.clientId === clientId || checkIn.clientId === client?.id` so both URL id and resolved doc id are accepted.
3. **Progress week debug / reassign** – Use `effectiveClientId` so they operate on the same client document as the rest of the page.
