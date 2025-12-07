# Traffic Light System - Implementation Map

## 📊 **How Scores Are Currently Calculated**

### Score Calculation Process:
1. **Question-Level Scoring** (in `/client-portal/check-in/[id]/page.tsx`):
   - Each question has a `questionWeight` (default: 5)
   - Each answer receives a score out of 10 based on question type:
     - **Scale (1-10)**: Direct value (1-10)
     - **Boolean**: YES = 8, NO = 3 (or reversed if `yesIsPositive: false`)
     - **Select/Multiple Choice**: Uses option weights if available
     - **Number**: Normalized to 1-10 scale
     - **Text/Textarea**: Neutral score of 5

2. **Final Score Calculation**:
   ```
   totalWeightedScore = Σ(questionScore × questionWeight)
   totalWeight = Σ(questionWeight)
   finalScore = (totalWeightedScore / (totalWeight × 10)) × 100
   ```
   - Result: **0-100%** score stored in `formResponses.score`

3. **Storage Location**:
   - **Collection**: `formResponses`
   - **Field**: `score` (number, 0-100)
   - Also stored in `check_in_assignments.score` for quick access

---

## 🎯 **Where Scores Are Currently Displayed**

### **1. CLIENT PORTAL - Check-in Success Page**
**Location**: `/client-portal/check-in/[id]/success/page.tsx`

**Current Display**:
- Large score percentage (e.g., "100%")
- Color-coded based on hardcoded thresholds:
  - Green: ≥90
  - Blue: ≥80
  - Yellow: ≥70
  - Red: <70
- Score range bar showing "Poor 0-59% | Good 60-89% | Excellent 90-100%"
- Motivational message based on score

**Traffic Light Integration**:
- ✅ Replace hardcoded thresholds with client-specific thresholds
- ✅ Show traffic light indicator (🔴🟠🟢) based on client's profile
- ✅ Update score range bar to reflect client's thresholds
- ✅ Update motivational messages based on zone

---

### **2. CLIENT PORTAL - Dashboard**
**Location**: `/client-portal/page.tsx`

**Current Display**:
- Average score in stats card
- Recent check-in responses with score badges:
  ```typescript
  getScoreColor(score) {
    if (score >= 90) return 'bg-green-200 text-green-800';
    if (score >= 70) return 'bg-yellow-200 text-yellow-800';
    if (score >= 50) return 'bg-orange-200 text-orange-800';
    return 'bg-red-200 text-red-800';
  }
  ```

**Traffic Light Integration**:
- ✅ Replace hardcoded color logic with `getTrafficLightStatus()` function
- ✅ Show traffic light icon next to each check-in score
- ✅ Filter/sort check-ins by traffic light status

---

### **3. CLIENT PORTAL - Check-ins List**
**Location**: `/client-portal/check-ins/page.tsx`

**Current Display**:
- Score badge for completed check-ins: `Score: {checkin.score}%`
- Color-coded status indicators

**Traffic Light Integration**:
- ✅ Add traffic light indicator to each check-in card
- ✅ Color-code card border based on status
- ✅ Show zone label (Red/Orange/Green) alongside score

---

### **4. COACH DASHBOARD - Main Dashboard**
**Location**: `/dashboard/page.tsx`

**Current Display**:
- "Check-ins to Review" section with scores
- "Completed Check-ins" section with scores
- Score sorting capability

**Traffic Light Integration**:
- ✅ Add traffic light column to check-ins table
- ✅ Filter by traffic light status (Show only Red zone, etc.)
- ✅ Sort by traffic light status
- ✅ Color-code rows based on status
- ✅ Summary stats: "X clients in Red zone", "Y clients in Green zone"

---

### **5. COACH - Client Profile Page**
**Location**: `/clients/[id]/page.tsx`

**Current Display**:
- Check-ins table showing score percentage
- No color coding currently

**Traffic Light Integration**:
- ✅ Add traffic light indicator column
- ✅ Color-code score cells
- ✅ Show trend: "Improving" (Red → Orange → Green) or "Declining"
- ✅ Highlight check-ins that need attention

---

### **6. COACH - Check-ins Page**
**Location**: `/check-ins/page.tsx`

**Current Display**:
- Score with color-coded badge:
  ```typescript
  getScoreColor(score) {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  }
  ```
- Score label: "Excellent", "Good", "Needs Attention"

**Traffic Light Integration**:
- ✅ Replace with client-specific thresholds
- ✅ Show traffic light icon
- ✅ Update labels based on client's profile

---

### **7. COACH - Responses Detail Page**
**Location**: `/responses/[id]/page.tsx`

**Current Display**:
- Large score display with color:
  ```typescript
  getScoreColor(score) {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  }
  ```

**Traffic Light Integration**:
- ✅ Replace with client-specific thresholds
- ✅ Show traffic light indicator prominently
- ✅ Display client's threshold ranges in sidebar

---

### **8. COACH - Analytics Page**
**Location**: `/analytics/page.tsx`

**Current Display**:
- Performance metrics with hardcoded thresholds:
  ```typescript
  getScoreColor(score) {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  }
  ```
- "High Performers" (≥80), "Average" (60-79), "Needs Attention" (<60)

**Traffic Light Integration**:
- ✅ Group clients by traffic light status
- ✅ Show distribution: "X% in Red, Y% in Orange, Z% in Green"
- ✅ Filter analytics by traffic light status
- ✅ Trend analysis: "Clients moving from Red to Green"

---

### **9. COACH - Clients List Page**
**Location**: `/clients/page.tsx`

**Current Display**:
- Client list with various metrics
- Risk score with color coding

**Traffic Light Integration**:
- ✅ Add "Latest Check-in Status" column with traffic light
- ✅ Filter clients by traffic light status
- ✅ Sort by traffic light status
- ✅ Quick view: "Show only Red zone clients"

---

### **10. CLIENT PORTAL - Progress Page**
**Location**: `/client-portal/progress/page.tsx`

**Current Display**:
- Progress charts and trends
- Historical scores

**Traffic Light Integration**:
- ✅ Color-code historical scores on timeline
- ✅ Show zone transitions over time
- ✅ "Time in Green zone" metric

---

### **11. CLIENT PORTAL - Feedback Page**
**Location**: `/client-portal/feedback/[id]/page.tsx`

**Current Display**:
- Score display with color coding

**Traffic Light Integration**:
- ✅ Show traffic light status
- ✅ Coach feedback context: "Your score of 75% puts you in the Orange zone for a lifestyle client"

---

## 🔧 **How Traffic Light System Will Be Interpreted**

### **Helper Function** (to be created in `/lib/scoring-utils.ts`):

```typescript
interface ScoringThresholds {
  redMax: number;      // Maximum score for Red zone (e.g., 33 or 75)
  orangeMax: number;   // Maximum score for Orange zone (e.g., 80 or 89)
  // Green is implicitly: orangeMax + 1 to 100
}

function getTrafficLightStatus(
  score: number, 
  thresholds: ScoringThresholds
): 'red' | 'orange' | 'green' {
  if (score <= thresholds.redMax) return 'red';
  if (score <= thresholds.orangeMax) return 'orange';
  return 'green';
}

function getTrafficLightColor(status: 'red' | 'orange' | 'green'): string {
  switch (status) {
    case 'red': return 'text-red-600 bg-red-50 border-red-200';
    case 'orange': return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'green': return 'text-green-600 bg-green-50 border-green-200';
  }
}

function getTrafficLightIcon(status: 'red' | 'orange' | 'green'): string {
  switch (status) {
    case 'red': return '🔴';
    case 'orange': return '🟠';
    case 'green': return '🟢';
  }
}

function getTrafficLightLabel(status: 'red' | 'orange' | 'green'): string {
  switch (status) {
    case 'red': return 'Needs Attention';
    case 'orange': return 'On Track';
    case 'green': return 'Excellent';
  }
}
```

### **Data Flow**:

1. **Client Profile Assignment**:
   - Coach assigns scoring profile to client (Lifestyle, High Performance, Moderate, Custom)
   - Stored in `clientScoring` collection: `{ clientId, scoringProfile, thresholds: { redMax, orangeMax } }`

2. **Score Calculation** (unchanged):
   - Check-in completed → Score calculated (0-100%)
   - Score stored in `formResponses.score`

3. **Traffic Light Determination**:
   - When displaying score, fetch client's thresholds from `clientScoring`
   - Apply `getTrafficLightStatus(score, thresholds)` to determine zone
   - Display appropriate color, icon, and label

4. **Caching Strategy**:
   - Cache thresholds in client-side state to avoid repeated API calls
   - Refresh when client profile is updated

---

## 📍 **Implementation Priority**

### **Phase 1: Core Infrastructure** (High Priority)
1. ✅ Create `/lib/scoring-utils.ts` with helper functions
2. ✅ Update `/api/clients/[id]/scoring/route.ts` to support new threshold model
3. ✅ Update scoring profiles with new ranges (Lifestyle: 0-33/34-80/81-100, High Performance: 0-75/76-89/90-100)

### **Phase 2: Client-Facing Pages** (High Priority)
1. ✅ Client Portal - Check-in Success Page
2. ✅ Client Portal - Dashboard
3. ✅ Client Portal - Check-ins List

### **Phase 3: Coach-Facing Pages** (Medium Priority)
1. ✅ Coach Dashboard
2. ✅ Client Profile Page
3. ✅ Check-ins Page
4. ✅ Responses Detail Page

### **Phase 4: Analytics & Reporting** (Medium Priority)
1. ✅ Analytics Page
2. ✅ Clients List Page
3. ✅ Progress Page

### **Phase 5: Advanced Features** (Low Priority)
1. ✅ Notifications when client enters Red zone
2. ✅ Trend analysis (Red → Orange → Green transitions)
3. ✅ Bulk assignment of scoring profiles

---

## 🎨 **Visual Design**

### **Traffic Light Indicators**:

**Small Badge** (for tables/lists):
```
🔴 Red Zone    | 🟠 Orange Zone  | 🟢 Green Zone
Needs Attention | On Track      | Excellent
```

**Large Display** (for success pages):
```
[Large Icon] 🔴 / 🟠 / 🟢
Score: 75%
Status: Orange Zone - On Track
```

**Color Coding**:
- **Red**: `bg-red-50 text-red-800 border-red-200`
- **Orange**: `bg-orange-50 text-orange-800 border-orange-200`
- **Green**: `bg-green-50 text-green-800 border-green-200`

---

## 🔄 **Migration Strategy**

1. **Existing Clients**:
   - Default to "Lifestyle" profile if no scoring config exists
   - Allow coaches to update profiles via Client Profile → Scoring tab

2. **Backward Compatibility**:
   - Support both old threshold format (red/yellow/green) and new format (redMax/orangeMax)
   - Migration script to convert old format to new format

3. **Default Thresholds**:
   - New clients: "Lifestyle" profile by default
   - Coaches can change during client onboarding

---

## 📊 **Category-Based Averages for Coaches**

### **Requirement**: 
Coaches need to see overall averages grouped by client category/profile (Lifestyle, High Performance, Moderate, Custom).

### **Where This Will Appear**:

#### **1. Analytics Page - Category Performance Section**
**Location**: `/analytics/page.tsx`

**New Section to Add**:
```typescript
interface CategoryPerformance {
  profile: 'lifestyle' | 'high-performance' | 'moderate' | 'custom';
  clientCount: number;
  averageScore: number;
  trafficLightDistribution: {
    red: number;
    orange: number;
    green: number;
  };
  averageCompletionRate: number;
  trend: 'improving' | 'stable' | 'declining';
}
```

**Display**:
- Cards for each category showing:
  - Category name and icon
  - Number of clients in category
  - Average score across all clients in category
  - Traffic light distribution (X% Red, Y% Orange, Z% Green)
  - Average completion rate
  - Trend indicator (↑ improving, → stable, ↓ declining)

#### **2. Coach Dashboard - Category Overview**
**Location**: `/dashboard/page.tsx`

**New Widget to Add**:
- Summary cards showing:
  - "Lifestyle Clients: 12 clients, Avg Score: 78%"
  - "High Performance: 5 clients, Avg Score: 92%"
  - Quick traffic light breakdown per category

#### **3. Analytics API - Category Aggregation**
**Location**: `/api/analytics/overview/route.ts`

**New Function to Add**:
```typescript
async function calculateCategoryAverages(
  coachId: string, 
  clients: any[], 
  responses: any[]
): Promise<CategoryPerformance[]> {
  // Group clients by scoring profile
  // Fetch scoring configs from clientScoring collection
  // Calculate averages per category
  // Determine traffic light distribution per category
  // Calculate trends
}
```

**Data Structure**:
```typescript
interface CategoryAverages {
  categories: Array<{
    profile: string;
    displayName: string;
    clientCount: number;
    averageScore: number;
    trafficLightDistribution: {
      red: { count: number; percentage: number };
      orange: { count: number; percentage: number };
      green: { count: number; percentage: number };
    };
    averageCompletionRate: number;
    recentTrend: {
      direction: 'up' | 'down' | 'stable';
      change: number; // percentage change
    };
  }>;
  overall: {
    totalClients: number;
    overallAverage: number;
    categoryBreakdown: Array<{
      profile: string;
      percentage: number; // % of total clients
    }>;
  };
}
```

### **Implementation Details**:

1. **Fetch Scoring Profiles**:
   - For each client, fetch their scoring config from `clientScoring` collection
   - Default to "lifestyle" if no config exists
   - Group clients by `scoringProfile` field

2. **Calculate Category Averages**:
   - For each category, calculate:
     - Average of all client scores in that category
     - Traffic light distribution (how many in Red/Orange/Green zones)
     - Average completion rate
     - Trend over time (compare last 30 days vs previous 30 days)

3. **Traffic Light Distribution Per Category**:
   - Use each client's specific thresholds to determine their zone
   - Aggregate: "X clients in Red zone, Y in Orange, Z in Green"
   - Show as percentage: "45% in Green zone for Lifestyle clients"

4. **Visual Display**:
   - **Analytics Page**: Large section with cards for each category
   - **Dashboard**: Compact summary widget
   - **Charts**: Bar chart comparing categories side-by-side
   - **Trend Indicators**: Show if category is improving/declining

### **Example Display**:

```
┌─────────────────────────────────────┐
│ Category Performance Overview       │
├─────────────────────────────────────┤
│                                      │
│  🏃 Lifestyle Clients                │
│  12 clients | Avg: 78% | ↑ +5%      │
│  🔴 2 (17%) | 🟠 6 (50%) | 🟢 4 (33%)│
│                                      │
│  🏆 High Performance                │
│  5 clients | Avg: 92% | → 0%         │
│  🔴 0 (0%) | 🟠 1 (20%) | 🟢 4 (80%) │
│                                      │
│  ⚖️ Moderate                         │
│  8 clients | Avg: 82% | ↓ -3%       │
│  🔴 1 (13%) | 🟠 3 (38%) | 🟢 4 (50%)│
│                                      │
└─────────────────────────────────────┘
```

### **API Endpoint Enhancement**:

**Update**: `/api/analytics/overview/route.ts`

**Add to response**:
```typescript
interface AnalyticsOverview {
  // ... existing fields ...
  categoryAverages: CategoryAverages;
}
```

**New Helper Functions**:
- `fetchClientScoringProfiles(coachId: string)` - Get all scoring configs
- `groupClientsByProfile(clients: any[], scoringConfigs: any[])` - Group clients
- `calculateCategoryMetrics(categoryClients: any[], responses: any[], thresholds: ScoringThresholds)` - Calculate metrics
- `determineTrafficLightDistribution(scores: number[], thresholds: ScoringThresholds)` - Get distribution

---

## 📝 **Summary**

**Total Locations to Update**: 11 pages/components + 2 new analytics features

**Key Changes**:
- Replace all hardcoded score thresholds with client-specific thresholds
- Add traffic light indicators throughout the application
- Enable filtering and sorting by traffic light status
- Provide clear visual feedback to both clients and coaches
- **NEW**: Add category-based averages for coaches
- **NEW**: Show traffic light distribution per category

**Impact**:
- **Clients**: See personalized, achievable goals based on their profile
- **Coaches**: Better identify clients needing attention and track progress more accurately
- **Coaches**: Understand performance differences between client categories
- **Coaches**: Identify which categories need more support
- **System**: More flexible and scalable scoring system

