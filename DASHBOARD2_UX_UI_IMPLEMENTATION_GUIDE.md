# Dashboard2 UX/UI Implementation Guide

## Overview

This guide provides detailed specifications for implementing the new `/dashboard2` page based on Trainerize design patterns analyzed in the CTO breakdown.

---

## 🎨 Design System

### Color Palette
```css
/* Primary Colors */
--primary-blue: #3b82f6;
--primary-orange: #daa450; /* Brand color */
--primary-orange-hover: #c89440;

/* Status Colors */
--status-active: #3b82f6;
--status-upcoming: #93c5fd;
--status-success: #10b981;
--status-warning: #f59e0b;
--status-error: #ef4444;

/* Text Colors */
--text-primary: #111827; /* gray-900 */
--text-secondary: #4b5563; /* gray-600 */
--text-tertiary: #9ca3af; /* gray-400 */

/* Background Colors */
--bg-white: #ffffff;
--bg-gray-50: #f9fafb;
--bg-gray-100: #f3f4f6;
--bg-orange-50: #fff7ed;
```

### Typography
```css
/* Headings */
--font-h1: 24px / 32px, font-weight: 700
--font-h2: 20px / 28px, font-weight: 700
--font-h3: 18px / 24px, font-weight: 600

/* Body Text */
--font-body: 14px / 20px, font-weight: 400
--font-body-bold: 14px / 20px, font-weight: 600
--font-small: 12px / 16px, font-weight: 400

/* Tab Labels */
--font-tab: 14px / 20px, font-weight: 500, text-transform: uppercase, letter-spacing: 0.5px
```

### Spacing System
```
--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 20px
--space-6: 24px
--space-8: 32px
```

---

## 📐 Layout Structure

### Desktop (>1024px)
```
┌─────────────────────────────────────────────────────────────────┐
│  Left Sidebar (250px)  │  Main Content (flex-1)  │  Right Sidebar (300px) │
│                        │                         │                       │
│  - Logo                │  - Tabs                 │  - Recent Activities   │
│  - Search              │  - Client Table         │  - Filters             │
│  - Navigation          │  - Controls             │  - Activity Feed       │
│  - Filters             │  - Pagination           │                        │
└─────────────────────────────────────────────────────────────────┘
```

### Tablet (768px-1024px)
```
┌─────────────────────────────────────────────┐
│  Left Sidebar (Collapsible)  │  Main Content │
│                              │               │
│  - Navigation                │  - Tabs       │
│                              │  - Table      │
└─────────────────────────────────────────────┘
│  Recent Activities (Full Width Below)       │
└─────────────────────────────────────────────┘
```

### Mobile (<768px)
```
┌─────────────────────┐
│  Header             │
│  - Search           │
│  - Filters          │
├─────────────────────┤
│  Tabs (Scrollable)  │
├─────────────────────┤
│  Client Cards       │
│  (Stacked)          │
├─────────────────────┤
│  Recent Activities  │
└─────────────────────┘
```

---

## 🧩 Component Specifications

### 1. ClientListTable Component

**Props:**
```typescript
interface ClientListTableProps {
  clients: ClientListItem[];
  activeTab: 'summary' | 'exercise' | 'nutrition' | 'weight' | 'payment' | 'engagement';
  onClientClick: (clientId: string) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
}
```

**Column Configurations by Tab:**

#### Summary Tab
- Name (with profile pic, secondary info)
- Main Program (program name, end date)
- Current Phase (phase name, time remaining, progress bar)
- Next Phase (phase name, start date, progress bar)
- Actions (OPEN button, notification badge)

#### Exercise Tab (Future)
- Name
- Active Programs
- Last Workout
- Workouts This Week
- Completion Rate

#### Nutrition Tab (Future)
- Name
- Current Meal Plan
- Macro Compliance
- Last Logged Meal

#### Weight Tab (Future)
- Name
- Current Weight
- Weight Change (vs baseline)
- Last Weighed

#### Payment Tab (Future)
- Name
- Plan Status
- Next Payment
- Payment History

#### Engagement Tab (Future)
- Name
- Last Check-in
- Messages Unread
- Engagement Score

**Row Height:** 64px minimum (comfortable click target)

**Styling:**
```tsx
<tr className="border-b border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer h-16">
```

---

### 2. ProgressBar Component

**Props:**
```typescript
interface ProgressBarProps {
  value: number; // 0-100
  color?: 'blue' | 'green' | 'orange' | 'red';
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}
```

**Visual Spec:**
- Height: 8px (sm), 12px (md), 16px (lg)
- Border radius: 9999px (fully rounded)
- Background: gray-200
- Fill: Color-based on status
- Percentage text: 12px, gray-700, positioned above or inside

**Implementation:**
```tsx
<div className="relative w-full bg-gray-200 rounded-full" style={{ height: '8px' }}>
  <div 
    className="rounded-full transition-all duration-300"
    style={{ 
      width: `${value}%`, 
      height: '100%',
      backgroundColor: colorMap[color] 
    }}
  />
  {showPercentage && (
    <span className="absolute -top-5 right-0 text-xs text-gray-700 font-medium">
      {value}%
    </span>
  )}
</div>
```

---

### 3. RecentActivities Component

**Props:**
```typescript
interface RecentActivitiesProps {
  activities: ActivityItem[];
  filters: {
    location?: string;
    eventType?: string;
    customFilter?: string;
  };
  onFilterChange: (filterType: string, value: string) => void;
}
```

**Activity Item Structure:**
```tsx
<div className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
  <img 
    src={activity.clientImage} 
    alt={activity.clientName}
    className="w-10 h-10 rounded-full flex-shrink-0"
  />
  <div className="flex-1 min-w-0">
    <p className="text-sm text-gray-900">
      <span className="font-semibold">{activity.clientName}</span>
      {' '}{activity.description}
    </p>
    <p className="text-xs text-gray-500 mt-0.5">
      {formatRelativeTime(activity.timestamp)}
    </p>
  </div>
</div>
```

**Activity Types to Support:**
1. Weight tracking: "weighed in at {weight} kg"
2. Exercise: "completed a {distance} {activity} in {duration}"
3. Workout: "completed {workout} and rated it as RPE {rating}/10"
4. Personal bests: "set {count} new personal bests"
5. Photos: Show thumbnails (3 images max)
6. Comments: "added {count} comment(s)"

---

### 4. ClientCategorization Component

**Props:**
```typescript
interface ClientCategorizationProps {
  categories: {
    id: string;
    label: string;
    icon: ReactNode;
    color: string;
    count: number;
    clients: ClientSummary[];
  }[];
  onCategoryClick: (categoryId: string) => void;
  onViewAll: () => void;
}
```

**Category Card:**
```tsx
<div className="bg-white rounded-xl p-4 border border-gray-200 hover:shadow-md transition-shadow">
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center space-x-2">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
        {icon}
      </div>
      <span className="text-sm font-semibold text-gray-900">{label}</span>
    </div>
    <span className="text-sm text-gray-600">{count}</span>
  </div>
  <div className="flex items-center -space-x-2">
    {clients.slice(0, 3).map(client => (
      <img 
        key={client.id}
        src={client.profileImage} 
        alt={client.name}
        className="w-8 h-8 rounded-full border-2 border-white"
      />
    ))}
    {count > 3 && (
      <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-semibold text-gray-700">
        +{count - 3}
      </div>
    )}
  </div>
  {count > 0 && (
    <button className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium">
      View All >
    </button>
  )}
</div>
```

---

### 5. TabNavigation Component

**Props:**
```typescript
interface TabNavigationProps {
  tabs: Array<{
    id: string;
    label: string;
    count?: number;
  }>;
  activeTab: string;
  onChange: (tabId: string) => void;
}
```

**Styling:**
```tsx
<nav className="border-b border-gray-200 mb-6">
  <div className="flex space-x-1">
    {tabs.map(tab => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={`
          px-4 py-3 text-sm font-medium border-b-2 transition-colors
          ${activeTab === tab.id 
            ? 'border-blue-600 text-blue-600' 
            : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
          }
        `}
      >
        {tab.label}
        {tab.count !== undefined && (
          <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 rounded-full">
            {tab.count}
          </span>
        )}
      </button>
    ))}
  </div>
</nav>
```

---

## 📱 Responsive Behavior

### Mobile Adaptations

#### Client Table → Client Cards
```tsx
// Desktop: Table
<table className="hidden lg:table w-full">
  {/* Table rows */}
</table>

// Mobile: Cards
<div className="lg:hidden space-y-4">
  {clients.map(client => (
    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
      {/* Card layout */}
    </div>
  ))}
</div>
```

#### Sidebar → Drawer
```tsx
// Desktop: Fixed sidebar
<aside className="hidden lg:block w-64 fixed left-0 top-0 h-screen">
  {/* Sidebar content */}
</aside>

// Mobile: Drawer
<Drawer open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
  {/* Sidebar content */}
</Drawer>
```

---

## 🎯 Interaction Patterns

### 1. Search Behavior
- **Debounce**: 300ms delay
- **Placeholder**: "Search clients..."
- **Clear button**: Appears when text entered
- **Results highlighting**: Highlight matching text

### 2. Sorting
- **Click header**: Toggle ascending/descending
- **Visual indicator**: Arrow icon (↑↓) shows sort direction
- **Active column**: Background color change

### 3. Filtering
- **Sidebar filters**: Persistent, shows active filter count
- **Inline filters**: Dropdowns in table header
- **Clear all**: Button to reset all filters

### 4. Pagination
- **Page size**: 10, 25, 50, 100 (dropdown)
- **Navigation**: Previous, Next, First, Last buttons
- **Page numbers**: Show current ±2 pages, ellipsis for gaps

### 5. Loading States
- **Skeleton loaders**: For table rows
- **Shimmer effect**: CSS animation
- **Loading spinner**: For initial load
- **Infinite scroll option**: For mobile (alternative to pagination)

---

## 🔄 State Management

### Client List State
```typescript
interface ClientListState {
  clients: ClientListItem[];
  filteredClients: ClientListItem[];
  loading: boolean;
  error: string | null;
  
  // Filters
  searchQuery: string;
  statusFilter: string[];
  programFilter: string[];
  trainerFilter: string[];
  
  // Sorting
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  
  // Pagination
  currentPage: number;
  pageSize: number;
  totalPages: number;
  
  // Tab
  activeTab: string;
}
```

### Activity Feed State
```typescript
interface ActivityFeedState {
  activities: ActivityItem[];
  loading: boolean;
  filters: {
    location?: string;
    eventType?: string;
    dateRange?: { start: Date; end: Date };
  };
  hasMore: boolean;
}
```

---

## 🎨 Animation & Transitions

### Transitions
```css
/* Smooth transitions for interactive elements */
.transition-base {
  transition: all 0.2s ease-in-out;
}

/* Hover effects */
.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* Loading shimmer */
@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}

.shimmer {
  animation: shimmer 2s infinite;
  background: linear-gradient(
    to right,
    #f0f0f0 0%,
    #e0e0e0 20%,
    #f0f0f0 40%,
    #f0f0f0 100%
  );
  background-size: 1000px 100%;
}
```

---

## ♿ Accessibility

### Keyboard Navigation
- **Tab order**: Logical flow through interactive elements
- **Enter/Space**: Activate buttons, select table rows
- **Arrow keys**: Navigate table rows, tabs
- **Escape**: Close modals, clear search

### Screen Reader Support
```tsx
<button
  aria-label={`Sort by ${columnName}, currently ${sortOrder}`}
  aria-sort={sortOrder === 'asc' ? 'ascending' : 'descending'}
>
  {columnName}
</button>

<table role="table" aria-label="Client list">
  <thead>
    <tr role="row">
      <th role="columnheader" scope="col">Name</th>
    </tr>
  </thead>
  <tbody>
    <tr role="row" aria-label={`Client: ${client.name}`}>
      <td role="gridcell">{client.name}</td>
    </tr>
  </tbody>
</table>
```

### Color Contrast
- **Text**: Minimum 4.5:1 contrast ratio
- **Interactive elements**: 3:1 contrast ratio
- **Focus indicators**: Clear, visible outline (2px solid)

---

## 📊 Data Flow

### Component Hierarchy
```
Dashboard2Page
├── Layout
│   ├── Sidebar (Left)
│   │   ├── Logo
│   │   ├── Search
│   │   ├── Navigation
│   │   └── Filters
│   ├── Main Content
│   │   ├── Business Analytics Charts
│   │   │   ├── BusinessGrowthChart (12 months client growth)
│   │   │   └── CheckInsPerWeekChart (engagement metrics)
│   │   ├── Header (Actions, Search)
│   │   ├── TabNavigation
│   │   ├── ClientListTable
│   │   │   ├── ClientRow (multiple)
│   │   │   │   ├── ProfileImage
│   │   │   │   ├── ClientInfo
│   │   │   │   ├── ProgressBar (multiple)
│   │   │   │   └── ActionButtons
│   │   └── Pagination
│   └── RecentActivities (Right)
│       ├── FilterDropdowns
│       └── ActivityFeed
│           └── ActivityItem (multiple)
```

### Data Fetching
```typescript
// Dashboard2Page.tsx
useEffect(() => {
  fetchClients();
  fetchActivities();
}, [activeTab, filters, sortBy, sortOrder, currentPage]);

const fetchClients = async () => {
  setLoading(true);
  const params = new URLSearchParams({
    coachId: userProfile.uid,
    tab: activeTab,
    ...filters,
    sortBy,
    sortOrder,
    page: currentPage.toString(),
    pageSize: pageSize.toString()
  });
  
  const response = await fetch(`/api/dashboard2/clients?${params}`);
  const data = await response.json();
  setClients(data.clients);
  setTotalPages(data.totalPages);
  setLoading(false);
};
```

---

## ✅ Implementation Checklist

### Phase 1: Foundation
- [ ] Set up `/dashboard2` route
- [ ] Create base layout with three columns
- [ ] Implement sidebar navigation
- [ ] Add business analytics charts:
  - [ ] Business Growth Chart (12 months)
  - [ ] Average Check-ins Per Week Chart
- [ ] Add tab navigation component
- [ ] Basic client list table (Summary tab only)

### Phase 2: Core Features
- [ ] Client table with all columns
- [ ] Progress bar component
- [ ] Search functionality
- [ ] Sorting (client-side first)
- [ ] Pagination
- [ ] Recent activities sidebar
- [ ] Activity feed component

### Phase 3: Enhanced Features
- [ ] Filtering system
- [ ] Client categorization cards
- [ ] Notification badges
- [ ] Responsive design (mobile)
- [ ] Loading states
- [ ] Error handling

### Phase 4: Advanced Features
- [ ] Additional tabs (Exercise, Nutrition, etc.)
- [ ] Real-time activity updates
- [ ] Export functionality
- [ ] Bulk actions
- [ ] Advanced filtering

---

**Document Version**: 1.0  
**Created**: 2025-01-06  
**Status**: Ready for Implementation
