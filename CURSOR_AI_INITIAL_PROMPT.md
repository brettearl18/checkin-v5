# CursorAI Initial Prompt - Health & Wellness Check-in Platform MVP

## 🎯 Project Overview

Build a **production-ready Health & Wellness Coaching Platform** that enables coaches to create check-in forms, assign them to clients, track progress, and provide feedback. The platform must support three user roles (Admin, Coach, Client) with role-based access control and a comprehensive analytics system.

**MVP Goal**: Launch a fully functional platform that coaches can use immediately to manage clients, create forms, assign check-ins, and track progress with a traffic light scoring system.

---

## 🏗️ Architecture & Tech Stack

### Core Technology Decisions

**Frontend Framework:**
- **Next.js 15.4.5+** with App Router (TypeScript)
- Use Server Components by default, Client Components only when needed
- Implement `'use client'` directive only for interactive components
- Use `export const dynamic = 'force-dynamic'` for all API routes

**Styling:**
- **Tailwind CSS 4** for all styling
- Mobile-first responsive design
- Consistent design system with:
  - Gradient backgrounds: `bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50`
  - Card styling: `rounded-2xl shadow-xl border border-gray-100`
  - Color scheme: Blue/Indigo primary, Green for success, Red for alerts, Orange for warnings

**Database & Backend:**
- **Firebase Firestore** for all data storage
- **Firebase Authentication** for user management
- **Firebase Storage** for progress images
- **Firebase Admin SDK** for server-side operations

**State Management:**
- React Hooks (`useState`, `useEffect`, `useContext`)
- Custom `AuthContext` for authentication state
- No external state management libraries needed for MVP

**Deployment:**
- **Google Cloud Run** for Next.js server
- **Firebase Hosting** as reverse proxy
- Docker containerization with standalone Next.js output

---

## 📋 MVP Feature Requirements

### 1. Authentication & User Management (Priority: CRITICAL)

**Requirements:**
- Three user roles: Admin, Coach, Client
- Firebase Authentication integration
- Role-based access control with `RoleProtected` component
- User registration with role selection
- Login/logout functionality
- Session persistence
- Client onboarding flow with email verification
- Coach short UID system for client verification

**Implementation Pattern:**
```typescript
// Use AuthContext for global auth state
// Protect routes with RoleProtected component
// Store user profile in Firestore 'coaches' or 'clients' collection
// Use Firebase Auth UID as primary identifier
```

**Collections:**
- `coaches` - Coach profiles with `uid`, `profile`, `role: 'coach'`
- `clients` - Client profiles with `uid`, `assignedCoach`, `role: 'client'`
- `admins` - Admin profiles (optional, can use coaches with `role: 'admin'`)

---

### 2. Coach Dashboard (Priority: CRITICAL)

**Core Features:**
- Overview statistics (Total Clients, Active Clients, Pending Check-ins)
- Check-ins to Review section (pending coach feedback)
- Recent Activity feed
- Quick actions (Add Client, Create Form, Send Check-in)
- Client inventory with search and filters
- Traffic light indicators for client health status

**Key Metrics to Display:**
- Total clients count
- Active clients count
- Pending check-ins count
- Average progress score
- Overdue check-ins count
- At-risk clients (red traffic light)

**UI Requirements:**
- Clean, modern design with gradient backgrounds
- Responsive grid layouts
- Real-time data updates
- Loading states and error handling
- Search and filter functionality

---

### 3. Client Management (Priority: CRITICAL)

**Features:**
- Client list page with:
  - Search bar (name, email)
  - Filter buttons (All, Active, Needs Attention)
  - Sortable table (Name, Status, Weeks on Program, Score, Completion Rate, Last Check-in)
  - Traffic light health status column
  - Activity badges (days since last check-in, overdue check-ins)
- Client profile page with:
  - Overview metrics (Progress Score, Check-ins, Completion Rate, Last Activity)
  - Traffic light status for progress score
  - Check-in management (tabs: All Check-ins, Completed)
  - Question Progress Grid
  - Measurements tracking
  - Progress images gallery
  - Quick actions (Send Check-in, Update Status)

**Data Structure:**
```typescript
interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  status: 'active' | 'inactive' | 'pending' | 'paused' | 'completed';
  assignedCoach: string;
  progressScore?: number; // Average score of completed check-ins (0-100)
  completionRate?: number; // Percentage of completed check-ins
  totalCheckIns?: number;
  completedCheckIns?: number;
  lastCheckIn?: string;
  createdAt: string;
  scoringThresholds?: ScoringThresholds; // For traffic light system
}
```

---

### 4. Check-in System (Priority: CRITICAL)

**Form Builder:**
- Create custom forms with multiple question types:
  - Text, Textarea, Number, Select, Multi-select
  - Scale (1-10), Boolean, Date, Time
- Question library for reusable questions
- Question weighting system (default: 5, range: 1-10)
- Form templates (8 pre-built templates)
- Form assignment to clients with:
  - Due dates
  - Recurring schedules (weekly, bi-weekly, monthly)
  - Check-in windows (specific days/times when check-in is available)

**Check-in Assignment Flow:**
1. Coach selects form and clients
2. Sets start date, duration, frequency
3. Optionally sets check-in window (e.g., Friday 10am - Monday 10pm)
4. System creates assignments in `check_in_assignments` collection

**Data Structure:**
```typescript
interface CheckInAssignment {
  id: string;
  clientId: string;
  formId: string;
  formTitle: string;
  assignedAt: Timestamp;
  dueDate: Timestamp;
  status: 'pending' | 'completed' | 'overdue' | 'inactive';
  isRecurring: boolean;
  recurringWeek?: number;
  totalWeeks?: number;
  frequency?: 'weekly' | 'bi-weekly' | 'monthly';
  checkInWindow?: {
    enabled: boolean;
    startDay: string;
    startTime: string;
    endDay: string;
    endTime: string;
  };
  score?: number; // 0-100, calculated from responses
  responseCount?: number;
}
```

---

### 5. Client Portal (Priority: CRITICAL)

**Dashboard Features:**
- Mobile-optimized design
- Stats cards (Total Check-ins, Completed, Pending, Average Score)
- Upcoming check-ins list
- Recent activity
- Quick access to progress, measurements, images

**Check-in Completion:**
- Mobile-friendly form interface
- Real-time validation
- Progress indicator
- Score calculation on submission
- Success page with traffic light status

**Progress Tracking:**
- Question-level progress grid (traffic light indicators per question over time)
- Measurements line graph (weight, body measurements)
- Score trends
- Click on progress indicators to see historical answers

**Data Structure:**
```typescript
interface FormResponse {
  id: string;
  assignmentId: string;
  clientId: string;
  formId: string;
  responses: {
    questionId: string;
    questionText: string;
    answer: any;
    score: number; // 0-10 per question
    questionWeight: number;
  }[];
  score: number; // 0-100, calculated final score
  submittedAt: Timestamp;
  coachResponded: boolean;
  coachFeedback?: {
    text?: string;
    audioUrl?: string;
    respondedAt: Timestamp;
  };
}
```

---

### 6. Traffic Light Scoring System (Priority: HIGH)

**Scoring Profiles:**
- **Lifestyle**: Red (0-33), Orange (34-80), Green (81-100)
- **High Performance**: Red (0-75), Orange (76-89), Green (90-100)
- **Moderate**: Red (0-60), Orange (61-85), Green (86-100)
- **Custom**: Configurable thresholds per client

**Implementation:**
- Client-specific thresholds stored in `clientScoring` collection
- Utility functions in `lib/scoring-utils.ts`:
  - `getTrafficLightStatus(score, thresholds)`
  - `getTrafficLightIcon(status)`
  - `getTrafficLightColor(status)`
  - `getTrafficLightLabel(status)`

**Display Requirements:**
- Traffic light icons (🔴🟠🟢) throughout the app
- Color-coded UI elements based on status
- Progress bars with traffic light colors
- Status labels ("Needs Attention", "On Track", "Excellent")

---

### 7. Analytics & Reporting (Priority: MEDIUM)

**Dashboard Analytics:**
- Client engagement metrics
- Progress trends
- Risk indicators
- Form and question usage statistics

**Client-Specific Analytics:**
- Progress over time (line graphs)
- Question-level improvements
- Completion rates
- Score distributions

**Implementation:**
- API routes in `/api/analytics/`
- Real-time data fetching from Firestore
- Time range filtering
- Export functionality (CSV/PDF) - UI ready, backend optional for MVP

---

### 8. Progress Images & Measurements (Priority: MEDIUM)

**Progress Images:**
- Upload before/after photos
- Filter by orientation (front, back, side)
- Filter by date
- Comparison mode (side-by-side)
- Firebase Storage integration

**Measurements:**
- Track body weight
- Track body measurements (chest, waist, hips, etc.)
- Line graph visualization
- Historical data tracking

---

## 🗄️ Data Architecture

### Firestore Collections Structure

```
coaches/
  {coachId}/
    profile: { firstName, lastName, email, phone }
    role: 'coach'
    createdAt: Timestamp

clients/
  {clientId}/
    firstName, lastName, email, phone
    assignedCoach: string (coach UID)
    status: 'active' | 'inactive' | 'pending' | 'paused'
    progressScore: number (0-100)
    completionRate: number (0-100)
    totalCheckIns: number
    completedCheckIns: number
    lastCheckIn: Timestamp
    createdAt: Timestamp

clientScoring/
  {clientId}/
    scoringProfile: 'lifestyle' | 'high-performance' | 'moderate' | 'custom'
    thresholds: { redMax: number, orangeMax: number }

forms/
  {formId}/
    title: string
    description: string
    questions: Question[]
    isStandard: boolean
    createdAt: Timestamp

questions/
  {questionId}/
    text: string
    type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'scale' | 'boolean' | 'date' | 'time'
    options?: Option[]
    weight: number (1-10, default: 5)
    category: string

check_in_assignments/
  {assignmentId}/
    clientId: string
    formId: string
    formTitle: string
    assignedAt: Timestamp
    dueDate: Timestamp
    status: 'pending' | 'completed' | 'overdue' | 'inactive'
    isRecurring: boolean
    recurringWeek?: number
    totalWeeks?: number
    frequency?: string
    checkInWindow?: CheckInWindow
    score?: number
    responseCount?: number

formResponses/
  {responseId}/
    assignmentId: string
    clientId: string
    formId: string
    responses: Response[]
    score: number (0-100)
    submittedAt: Timestamp
    coachResponded: boolean
    coachFeedback?: CoachFeedback

progress_images/
  {imageId}/
    clientId: string
    url: string
    orientation: 'front' | 'back' | 'side'
    uploadedAt: Timestamp

client_measurements/
  {measurementId}/
    clientId: string
    bodyWeight?: number
    measurements: { [key: string]: number }
    recordedAt: Timestamp
```

---

## 🔐 Security & Access Control

### Role-Based Access Control

**Implementation Pattern:**
```typescript
// Use RoleProtected component for route protection
<RoleProtected requiredRole="coach">
  {/* Coach-only content */}
</RoleProtected>

// In API routes, verify user role:
const userProfile = await getUserProfile(request);
if (userProfile.role !== 'coach') {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
}
```

**Access Rules:**
- **Coaches**: Can only access their own clients (`assignedCoach === coachId`)
- **Clients**: Can only access their own data (`clientId === userId`)
- **Admins**: Full access to all data

**Data Isolation:**
- Always filter queries by `coachId` or `clientId`
- Never expose other users' data
- Validate ownership in API routes before operations

---

## 🎨 UI/UX Requirements

### Design System

**Color Palette:**
- Primary: Blue/Indigo gradients (`from-blue-600 to-indigo-600`)
- Success: Green (`bg-green-100 text-green-800`)
- Warning: Orange/Yellow (`bg-orange-100 text-orange-800`)
- Danger: Red (`bg-red-100 text-red-800`)
- Neutral: Gray (`bg-gray-100 text-gray-800`)

**Component Patterns:**
- Cards: `bg-white rounded-2xl shadow-xl border border-gray-100`
- Buttons: `bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl`
- Inputs: `border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500`
- Badges: `px-3 py-1 text-xs font-medium rounded-full`

**Navigation:**
- Sidebar navigation for coach dashboard
- Mobile hamburger menu
- Bottom tab bar for client portal (mobile)
- Consistent navigation across all pages

**Responsive Design:**
- Mobile-first approach
- Breakpoints: `sm:`, `md:`, `lg:`, `xl:`
- Touch-friendly buttons (min 44x44px)
- Readable font sizes (min 14px)

---

## 🔧 API Design Patterns

### Route Structure

```
/api/
  /clients/
    route.ts (GET, POST)
    /[id]/
      route.ts (GET, PUT, DELETE)
      /check-ins/
        route.ts (GET - fetch client's check-ins)
  /check-in-assignments/
    route.ts (GET, POST)
    /[id]/
      route.ts (GET, PUT, DELETE)
  /forms/
    route.ts (GET, POST)
    /[id]/
      route.ts (GET, PUT, DELETE)
  /questions/
    route.ts (GET, POST)
    /[id]/
      route.ts (GET, PUT, DELETE)
  /form-responses/
    route.ts (GET, POST)
    /[id]/
      route.ts (GET, PUT)
  /client-portal/
    route.ts (GET - client dashboard data)
    /check-ins/
      route.ts (GET - client's check-ins)
  /analytics/
    /overview/
      route.ts (GET)
    /progress/
      route.ts (GET)
    /risk/
      route.ts (GET)
```

### API Response Patterns

**Success Response:**
```typescript
{
  success: true,
  data: { ... },
  // or
  clients: [...],
  metrics: { ... }
}
```

**Error Response:**
```typescript
{
  success: false,
  error: 'Error message'
}
```

**Always:**
- Use `export const dynamic = 'force-dynamic'` for all API routes
- Initialize Firebase Admin SDK using `getDb()` from `lib/firebase-server`
- Handle errors gracefully with try-catch
- Return appropriate HTTP status codes (200, 400, 401, 403, 500)

---

## 📱 Mobile Optimization

### Client Portal Mobile Requirements

**Navigation:**
- Hamburger menu for mobile
- Bottom tab bar for main sections
- Slide-in navigation drawer

**Check-in Form:**
- Large input fields (min 48px height)
- Full-width buttons
- Touch-friendly radio buttons and checkboxes
- Sticky submit button at bottom

**Progress Page:**
- Compact question progress grid
- Swipeable cards
- Modal popups for detailed views
- Responsive charts

---

## 🚀 Deployment Strategy

### Build Configuration

**Next.js Config:**
```typescript
{
  output: 'standalone', // Required for Cloud Run
  compress: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true }, // For production
  typescript: { ignoreBuildErrors: true } // Temporary
}
```

**Dockerfile:**
- Multi-stage build
- Use Node.js 18+ Alpine
- Copy standalone output
- Expose port 8080
- Set environment variables

**Environment Variables:**
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `FIREBASE_SERVICE_ACCOUNT_KEY` (base64 encoded)
- `NEXT_PHASE=phase-production-build` (for build)
- `PORT=8080` (for Cloud Run)

---

## ✅ Development Workflow

### Code Organization

```
src/
  app/
    (pages)/          # Next.js pages
    api/              # API routes
  components/          # Reusable components
  contexts/           # React contexts (AuthContext)
  lib/                 # Utilities
    firebase-client.ts
    firebase-server.ts
    scoring-utils.ts
  types/              # TypeScript types (if needed)
```

### Best Practices

1. **Type Safety:**
   - Use TypeScript interfaces for all data structures
   - Type all function parameters and return values
   - Use `any` only when absolutely necessary

2. **Error Handling:**
   - Always use try-catch in async functions
   - Provide user-friendly error messages
   - Log errors to console for debugging

3. **Performance:**
   - Use React.memo for expensive components
   - Implement loading states
   - Optimize Firestore queries (use indexes)
   - Lazy load heavy components

4. **Code Quality:**
   - Consistent naming conventions (camelCase for variables, PascalCase for components)
   - Extract reusable logic into utility functions
   - Keep components focused and small
   - Use meaningful variable names

5. **Firebase Best Practices:**
   - Always check if document exists before accessing data
   - Handle Firestore Timestamps correctly (convert to Date)
   - Use transactions for critical operations
   - Implement proper Firestore indexes

---

## 🎯 MVP Success Criteria

### Must-Have Features (Launch Blockers)

- ✅ User authentication (Coach, Client, Admin)
- ✅ Coach dashboard with client overview
- ✅ Client management (CRUD operations)
- ✅ Form builder with question library
- ✅ Check-in assignment system
- ✅ Client portal for completing check-ins
- ✅ Score calculation and traffic light system
- ✅ Progress tracking (scores, measurements, images)
- ✅ Basic analytics dashboard
- ✅ Mobile-responsive design

### Nice-to-Have (Post-MVP)

- Real-time notifications (currently polling)
- Advanced analytics and reporting
- Export functionality (CSV/PDF)
- Automated email notifications
- Bulk operations
- Advanced filtering and search
- Data visualization enhancements

---

## 🐛 Common Pitfalls to Avoid

1. **Next.js 15 Async Params:**
   - Always await params: `const { id } = await params;`
   - Use in API routes and page components

2. **Firebase Initialization:**
   - Never initialize Firebase at module level in API routes
   - Use `getDb()` function that initializes on first call
   - Always use `export const dynamic = 'force-dynamic'` for API routes

3. **Client/Server Component Boundaries:**
   - Don't use `'use client'` unnecessarily
   - Keep server components for data fetching
   - Use client components only for interactivity

4. **Firestore Queries:**
   - Always create indexes for compound queries
   - Handle missing indexes gracefully
   - Use pagination for large datasets

5. **State Management:**
   - Don't over-engineer with external libraries
   - Use React hooks and context appropriately
   - Avoid prop drilling with context

---

## 📚 Key Files to Create

### Core Infrastructure
- `src/lib/firebase-client.ts` - Client-side Firebase initialization
- `src/lib/firebase-server.ts` - Server-side Firebase Admin SDK
- `src/lib/scoring-utils.ts` - Traffic light system utilities
- `src/contexts/AuthContext.tsx` - Authentication context
- `src/components/ProtectedRoute.tsx` - Role-based route protection
- `src/components/CoachNavigation.tsx` - Coach sidebar navigation
- `src/components/ClientNavigation.tsx` - Client mobile navigation

### Main Pages
- `src/app/dashboard/page.tsx` - Coach dashboard
- `src/app/clients/page.tsx` - Client list
- `src/app/clients/[id]/page.tsx` - Client profile
- `src/app/client-portal/page.tsx` - Client dashboard
- `src/app/client-portal/check-in/[id]/page.tsx` - Check-in form
- `src/app/client-portal/progress/page.tsx` - Progress tracking

### API Routes
- `src/app/api/clients/route.ts` - Client CRUD
- `src/app/api/clients/[id]/check-ins/route.ts` - Client check-ins
- `src/app/api/check-in-assignments/route.ts` - Assignment management
- `src/app/api/forms/route.ts` - Form management
- `src/app/api/questions/route.ts` - Question library
- `src/app/api/form-responses/route.ts` - Response handling

---

## 🎓 Learning Resources

- Next.js 15 App Router: https://nextjs.org/docs
- Firebase Firestore: https://firebase.google.com/docs/firestore
- Tailwind CSS: https://tailwindcss.com/docs
- TypeScript: https://www.typescriptlang.org/docs

---

## 🚦 Development Phases

### Phase 1: Foundation (Week 1)
1. Set up Next.js project with TypeScript
2. Configure Firebase (Auth, Firestore, Storage)
3. Implement authentication system
4. Create base layout and navigation
5. Set up routing and protected routes

### Phase 2: Core Features (Week 2-3)
1. Coach dashboard
2. Client management
3. Form builder
4. Question library
5. Check-in assignment system

### Phase 3: Client Portal (Week 4)
1. Client dashboard
2. Check-in completion flow
3. Progress tracking
4. Measurements and images

### Phase 4: Scoring & Analytics (Week 5)
1. Traffic light scoring system
2. Score calculations
3. Analytics dashboard
4. Progress visualizations

### Phase 5: Polish & Deploy (Week 6)
1. Mobile optimization
2. Error handling
3. Loading states
4. Testing workflows
5. Cloud Run deployment

---

## 💡 Pro Tips

1. **Start with Data Models**: Define all Firestore collections and interfaces first
2. **Build API Routes First**: Create API endpoints before building UI
3. **Mobile-First**: Design for mobile, then enhance for desktop
4. **Incremental Development**: Build one feature completely before moving to next
5. **Test as You Go**: Test each feature thoroughly before building next
6. **Document Decisions**: Keep notes on why certain decisions were made
7. **Version Control**: Commit frequently with meaningful messages
8. **Error Handling**: Always handle edge cases and errors gracefully

---

## 🎯 Final Notes

This prompt is designed to guide the complete development of a production-ready MVP. Follow the patterns and structures outlined here, and you'll build a scalable, maintainable, and user-friendly platform.

**Remember**: The goal is to build a working MVP that coaches can use immediately. Focus on core functionality first, then enhance with additional features.

**Good luck building! 🚀**











