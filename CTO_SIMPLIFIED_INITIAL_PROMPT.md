# CTO-Level Initial Prompt - Health & Wellness Check-in Platform (SIMPLIFIED)

## 🎯 Project Overview

Build a **lean, production-ready Health & Wellness Coaching Platform MVP** that enables coaches to create check-in forms, assign them to clients, and track progress. 

**MVP Goal:** Launch a fully functional platform in 4 weeks that coaches can use immediately. Focus on core value, not features.

**Core Principle:** **Simplicity is the ultimate sophistication. Build 40% of the code to deliver 100% of the value.**

---

## 🚨 Critical Rules (Read First)

### ❌ DON'T DO THIS
1. **Don't create 65 API endpoints** - You need 15 max
2. **Don't create separate collections for coaches/clients** - Use one `users` collection
3. **Don't over-engineer Firebase initialization** - 10 lines, not 200
4. **Don't build setup/debug/test routes** - Use scripts or dev tools
5. **Don't create multiple navigation components** - One component with role prop
6. **Don't add features before MVP is solid** - Core features first, rest later
7. **Don't over-abstract** - Direct code is better than clever abstractions
8. **Don't duplicate data** - Single source of truth, denormalize strategically
9. **Don't build complex scoring** - Simple 3-threshold system works
10. **Don't create utility classes** - Simple functions are better

### ✅ DO THIS
1. **Start with 6 core collections** - Add more only if absolutely needed
2. **Build 15 API endpoints max** - Consolidate similar operations
3. **Use explicit, direct code** - Easy to read, easy to debug
4. **Delete unused code immediately** - Less code = less bugs
5. **One way to do things** - Consistency beats cleverness
6. **MVP features only** - Validate core value first
7. **Simple scoring system** - Average of question scores, 3 thresholds
8. **Single navigation component** - Role-based rendering
9. **Embed questions in forms** - Don't over-normalize
10. **Ship fast, learn fast** - 4-week MVP, iterate based on feedback

---

## 🏗️ Simplified Architecture

### Tech Stack (Keep It Simple)

**Frontend:**
- Next.js 15.4.5+ (App Router, TypeScript)
- Tailwind CSS 4 (mobile-first)
- React Hooks (useState, useEffect, useContext)
- No external state management libraries

**Backend:**
- Firebase Firestore (database)
- Firebase Auth (authentication)
- Firebase Storage (images - optional for MVP)
- Firebase Admin SDK (server-side)

**Deployment:**
- Google Cloud Run (Next.js server)
- Firebase Hosting (reverse proxy)

**That's it. No other dependencies needed for MVP.**

---

## 📋 MVP Feature Scope (4 Weeks)

### Week 1: Foundation
1. ✅ Authentication (Coach, Client roles)
2. ✅ Coach dashboard (client list)
3. ✅ Client management (CRUD)

### Week 2: Forms & Assignments
4. ✅ Form builder (simple, embedded questions)
5. ✅ Assign check-ins to clients

### Week 3: Check-ins & Scoring
6. ✅ Client completes check-in
7. ✅ Score calculation (simple)
8. ✅ Coach views responses
9. ✅ Basic traffic light (3 thresholds)

### Week 4: Polish & Deploy
10. ✅ Mobile optimization
11. ✅ Basic analytics
12. ✅ Deploy to production

**That's the MVP. Everything else comes after validation.**

---

## 🗄️ Simplified Data Model (6 Collections)

### 1. `users` - All Users (Single Collection)

```typescript
users/{userId}
  - role: 'coach' | 'client' | 'admin'
  - profile: {
      firstName: string
      lastName: string
      email: string
      phone?: string
    }
  - coachId?: string  // If client, link to coach
  - scoringThresholds?: {
      redMax: number    // Default: 60
      orangeMax: number // Default: 80
    }
  - metrics?: {
      progressScore?: number      // Average score (0-100)
      completionRate?: number     // Percentage
      totalCheckIns?: number
      completedCheckIns?: number
      lastCheckIn?: Timestamp
    }
  - createdAt: Timestamp
  - status: 'active' | 'inactive' | 'pending'
```

**Why:** One collection for all users. Simpler queries, no joins, easier to understand.

---

### 2. `forms` - Forms with Embedded Questions

```typescript
forms/{formId}
  - title: string
  - description?: string
  - questions: [{
      id: string
      text: string
      type: 'text' | 'textarea' | 'number' | 'select' | 'scale' | 'boolean'
      options?: string[]  // For select/scale
      required: boolean
    }]
  - createdBy: string  // userId
  - createdAt: Timestamp
  - isStandard: boolean
```

**Why:** Embed questions in forms. No separate collection needed. Simpler queries, easier to manage.

---

### 3. `assignments` - Check-in Assignments

```typescript
assignments/{assignmentId}
  - clientId: string
  - formId: string
  - formTitle: string  // Denormalized for quick access
  - assignedAt: Timestamp
  - dueDate: Timestamp
  - status: 'pending' | 'completed' | 'overdue' | 'inactive'
  - isRecurring: boolean
  - recurringWeek?: number
  - totalWeeks?: number
  - frequency?: 'weekly' | 'bi-weekly' | 'monthly'
  - score?: number  // Denormalized from response (0-100)
  - responseId?: string  // Link to response when completed
  - createdAt: Timestamp
```

**Why:** Single collection for all assignments. Denormalize `formTitle` and `score` for performance.

---

### 4. `responses` - Form Responses

```typescript
responses/{responseId}
  - assignmentId: string
  - clientId: string
  - formId: string
  - answers: [{
      questionId: string
      questionText: string  // Denormalized
      answer: any
      score: number  // 0-10 per question
    }]
  - score: number  // 0-100, calculated final score
  - submittedAt: Timestamp
  - coachResponded: boolean
  - coachFeedback?: {
      text?: string
      respondedAt: Timestamp
    }
```

**Why:** Single source of truth for scores. Calculate once, store here. Denormalize to assignments for quick access.

---

### 5. `media` - Progress Images & Measurements (Optional for MVP)

```typescript
media/{clientId}/
  images/{imageId}
    - url: string
    - orientation: 'front' | 'back' | 'side'
    - uploadedAt: Timestamp
  
  measurements/{measurementId}
    - bodyWeight?: number
    - measurements: { [key: string]: number }
    - recordedAt: Timestamp
```

**Why:** Subcollections keep data organized. Optional for MVP - can add later.

---

### 6. `analytics` - Cached Analytics (Optional)

```typescript
analytics/{coachId}
  - lastUpdated: Timestamp
  - overview: {
      totalClients: number
      activeClients: number
      pendingCheckIns: number
      averageScore: number
    }
```

**Why:** Optional cache. Can compute on-demand for MVP. Add caching if performance issues arise.

---

## 🔌 Simplified API Structure (15 Endpoints Max)

### Core Endpoints

```
/api/auth/register          POST   - Register new user
/api/users                  GET    - List users (filtered by role/coach)
/api/users/[id]             GET, PUT, DELETE - User CRUD
/api/users/[id]/check-ins   GET    - Get user's check-ins

/api/forms                  GET, POST - Forms CRUD
/api/forms/[id]             GET, PUT, DELETE

/api/assignments            GET, POST - Assignments CRUD
/api/assignments/[id]       GET, PUT, DELETE

/api/responses              POST   - Submit response
/api/responses/[id]         GET, PUT - Get/update response

/api/analytics              GET    - Single analytics endpoint
```

**That's 11 endpoints. Add 4 more only if absolutely necessary.**

### ❌ Don't Create These

- `/api/setup-*` - Use scripts
- `/api/debug-*` - Use dev tools
- `/api/test-*` - Use tests
- `/api/create-*` - Use admin UI
- `/api/clear-*` - Use admin UI
- `/api/client-portal/*` - Use `/api/users/[id]/check-ins`
- `/api/clients/*` - Use `/api/users` with role filter
- `/api/coaches/*` - Use `/api/users` with role filter

---

## 🔐 Simplified Authentication

### Implementation

```typescript
// Single AuthContext
// Store user in Firestore 'users' collection
// Use Firebase Auth UID as document ID
// Role-based redirect after login
```

**No complex role management. Just a role field in the user document.**

---

## 📊 Simplified Scoring System

### Score Calculation (Simple)

```typescript
// 1. Each question: score 0-10
//    - Scale (1-10): Direct value
//    - Boolean: YES = 8, NO = 3
//    - Select: Based on option (or default 5)
//    - Text/Number: Neutral 5

// 2. Final score: Average of all question scores × 10
const finalScore = (answers.reduce((sum, a) => sum + a.score, 0) / answers.length) * 10;

// 3. Traffic light: 3 simple thresholds
function getTrafficLightStatus(score: number, thresholds: { redMax: number, orangeMax: number }) {
  if (score <= thresholds.redMax) return 'red';
  if (score <= thresholds.orangeMax) return 'orange';
  return 'green';
}
```

**No weighting. No complex profiles. Just simple averages and 3 thresholds.**

---

## 🎨 Simplified UI Components

### Single Navigation Component

```typescript
// src/components/Navigation.tsx
export default function Navigation({ role }: { role: 'coach' | 'client' | 'admin' }) {
  // Role-based menu items
  // Single component, role-based rendering
  // Shared mobile menu logic
}
```

**One component. Not three. Role-based rendering.**

### Page Structure

```typescript
// Keep pages under 300 lines
// Extract reusable components
// Separate data fetching from UI
// But don't over-extract (3-line functions aren't components)
```

---

## 🔧 Simplified Firebase Setup

### Firebase Initialization (10 Lines)

```typescript
// src/lib/firebase-server.ts
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let db: Firestore | null = null;

export function getDb() {
  if (!db) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!);
    initializeApp({ credential: cert(serviceAccount) });
    db = getFirestore();
  }
  return db;
}
```

**That's it. No build-time mocks. No complex fallbacks. Simple and direct.**

### API Route Pattern

```typescript
// src/app/api/users/route.ts
import { getDb } from '@/lib/firebase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const coachId = searchParams.get('coachId');
    
    let query = db.collection('users');
    if (role) query = query.where('role', '==', role);
    if (coachId) query = query.where('coachId', '==', coachId);
    
    const snapshot = await query.get();
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    return NextResponse.json({ success: true, users });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

**Simple. Direct. Easy to understand.**

---

## 📱 Mobile Optimization (Client Portal)

### Simplified Approach

```typescript
// Single dashboard page with tabs (not separate routes)
// Simple state: useState, useEffect
// One API endpoint returns all needed data
// Client-side filtering/sorting
```

**Fewer routes. Simpler state. Faster development.**

---

## 🚀 Deployment (Simplified)

### Next.js Config

```typescript
// next.config.ts
export default {
  output: 'standalone',
  compress: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true }, // Fix later
};
```

### Dockerfile (Simple)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY .next/standalone ./
COPY .next/static ./.next/static
EXPOSE 8080
ENV PORT=8080
CMD ["node", "server.js"]
```

**No complex multi-stage builds. Simple and works.**

---

## ✅ Development Principles

### 1. **Start Smaller**
- Build absolute minimum
- Launch with 5 features, not 50
- Add features based on user feedback

### 2. **One Way to Do Things**
- One navigation component
- One way to fetch data
- One way to handle errors
- Consistency > cleverness

### 3. **Explicit > Abstract**
- Direct code is better than "clever" abstractions
- Abstract when you have 3+ duplications (not before)
- Simple functions > utility classes

### 4. **Data: Denormalize Strategically**
- Store computed values (scores) for performance
- But have single source of truth
- Don't sync everywhere

### 5. **Delete Aggressively**
- Remove unused code immediately
- Delete debug/setup routes before production
- Less code = less bugs = faster development

### 6. **Build for Change**
- Simple code is easier to change
- Complex code is harder to change
- You WILL need to change things

### 7. **Test in Production**
- Ship MVP fast
- Get real users
- Iterate based on feedback
- Don't build features users don't want

---

## 🎯 MVP Success Criteria

### Must-Have (Launch Blockers)
- ✅ User authentication (Coach, Client)
- ✅ Coach dashboard with client list
- ✅ Client management (CRUD)
- ✅ Form builder (simple, embedded questions)
- ✅ Check-in assignment
- ✅ Client completes check-in
- ✅ Score calculation
- ✅ Coach views responses
- ✅ Basic traffic light (3 thresholds)
- ✅ Mobile-responsive design

### Nice-to-Have (Post-MVP)
- Progress images
- Measurements tracking
- Messaging system
- Advanced analytics
- Export functionality
- Real-time notifications

**Build must-haves first. Add nice-to-haves after validation.**

---

## 🐛 Common Pitfalls to Avoid

### 1. **Next.js 15 Async Params**
```typescript
// ✅ DO THIS
const { id } = await params;

// ❌ NOT THIS
const { id } = params;
```

### 2. **Firebase Initialization**
```typescript
// ✅ DO THIS (simple)
const db = getDb();

// ❌ NOT THIS (over-engineered)
// Complex initialization with build-time mocks, fallbacks, etc.
```

### 3. **Data Fetching**
```typescript
// ✅ DO THIS (direct)
const snapshot = await db.collection('users').where('role', '==', 'coach').get();

// ❌ NOT THIS (over-abstracted)
// Wrapped in 3 layers of utilities and abstractions
```

### 4. **Component Structure**
```typescript
// ✅ DO THIS (simple)
export default function ClientList() {
  const [clients, setClients] = useState([]);
  useEffect(() => { fetchClients(); }, []);
  return <div>{/* render */}</div>;
}

// ❌ NOT THIS (over-engineered)
// Complex state management, multiple contexts, utility classes
```

---

## 📚 Key Files to Create (Minimal)

### Core Infrastructure
- `src/lib/firebase-client.ts` - Client-side Firebase (20 lines)
- `src/lib/firebase-server.ts` - Server-side Firebase (10 lines)
- `src/lib/scoring-utils.ts` - Simple scoring (30 lines)
- `src/contexts/AuthContext.tsx` - Auth context (100 lines)
- `src/components/ProtectedRoute.tsx` - Route protection (30 lines)
- `src/components/Navigation.tsx` - Single navigation (150 lines)

### Main Pages
- `src/app/dashboard/page.tsx` - Coach dashboard (300 lines)
- `src/app/users/page.tsx` - User list (200 lines)
- `src/app/users/[id]/page.tsx` - User profile (400 lines)
- `src/app/client-portal/page.tsx` - Client dashboard (300 lines)
- `src/app/client-portal/check-in/[id]/page.tsx` - Check-in form (300 lines)

### API Routes (11 endpoints)
- `src/app/api/auth/register/route.ts`
- `src/app/api/users/route.ts`
- `src/app/api/users/[id]/route.ts`
- `src/app/api/users/[id]/check-ins/route.ts`
- `src/app/api/forms/route.ts`
- `src/app/api/forms/[id]/route.ts`
- `src/app/api/assignments/route.ts`
- `src/app/api/assignments/[id]/route.ts`
- `src/app/api/responses/route.ts`
- `src/app/api/responses/[id]/route.ts`
- `src/app/api/analytics/route.ts`

**Total: ~3,000 lines of code for MVP. Not 15,000.**

---

## 🚦 Development Phases (4 Weeks)

### Week 1: Foundation
- Day 1-2: Project setup, Firebase config, Auth
- Day 3-4: Coach dashboard, User list
- Day 5: Client management CRUD

### Week 2: Forms & Assignments
- Day 1-2: Form builder (simple, embedded questions)
- Day 3: Question types (text, scale, boolean, select)
- Day 4-5: Assignment system

### Week 3: Check-ins & Scoring
- Day 1-2: Client check-in form
- Day 3: Score calculation
- Day 4: Coach response view
- Day 5: Traffic light system

### Week 4: Polish & Deploy
- Day 1-2: Mobile optimization
- Day 3: Basic analytics
- Day 4: Testing & bug fixes
- Day 5: Deploy to production

**4 weeks. Not 6 months.**

---

## 💡 Pro Tips

1. **Start with Data Models** - Define 6 collections first
2. **Build API Routes First** - Create endpoints before UI
3. **Mobile-First** - Design for mobile, enhance for desktop
4. **Incremental Development** - One feature completely before next
5. **Test as You Go** - Test each feature before building next
6. **Delete Unused Code** - Remove immediately, don't accumulate
7. **Simple > Clever** - Direct code is maintainable
8. **Ship Fast** - MVP in 4 weeks, iterate based on feedback

---

## 🎯 Final Notes

**This prompt is designed to build a lean, maintainable MVP in 4 weeks.**

**Key Differences from Over-Engineered Version:**
- 6 collections instead of 12+
- 15 endpoints instead of 65+
- Simple scoring instead of complex weighting
- Single navigation instead of multiple components
- 3,000 lines instead of 15,000
- 4 weeks instead of 6 months

**Remember:**
- **Simplicity is the ultimate sophistication**
- **Less code = less bugs = faster development**
- **Ship fast, learn fast, iterate fast**
- **The best code is code you don't write**

**Good luck building! 🚀**


