'use client';

import React, { useMemo, useState, useEffect } from "react";
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Flame,
  HelpCircle,
  Images,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageSquare,
  Ruler,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
  User,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

/**
 * PART 1/2 — Client Portal Dashboard (standalone file)
 *
 * - Tailwind + shadcn/ui + lucide + recharts
 * - Calm, modern, rounded, warm-neutral styling
 */

// -----------------------------
// Helpers
// -----------------------------

function classNames(...c: Array<string | false | undefined | null>) {
  return c.filter(Boolean).join(" ");
}

function calcPct(current: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((current / total) * 100);
}

function TrendPill({ delta }: { delta: number }) {
  const isDown = delta < 0;
  const isUp = delta > 0;
  const Icon = isDown ? TrendingDown : isUp ? TrendingUp : Scale;
  return (
    <Badge
      variant="secondary"
      className={classNames(
        "rounded-full px-3 py-1",
        isDown && "bg-emerald-50 text-emerald-700 border-emerald-200",
        isUp && "bg-rose-50 text-rose-700 border-rose-200",
        !isDown && !isUp && "bg-muted"
      )}
    >
      <Icon className="mr-1 h-3.5 w-3.5" />
      {isDown ? `${delta.toFixed(1)} kg` : isUp ? `+${delta.toFixed(1)} kg` : "Stable"}
    </Badge>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active,
}: {
  icon: any;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={classNames(
        "w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm",
        active
          ? "bg-amber-100/70 text-amber-950"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <span
        className={classNames(
          "grid h-8 w-8 place-items-center rounded-lg",
          active ? "bg-amber-200/70" : "bg-background"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="font-medium">{label}</span>
      {active && <ChevronRight className="ml-auto h-4 w-4 opacity-70" />}
    </button>
  );
}

function MiniArea({ data }: { data: Array<{ w: string; v: number }> }) {
  return (
    <div className="h-20 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 0, top: 6, bottom: 0 }}>
          <XAxis dataKey="w" hide />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const v = payload[0]?.value as number;
              return (
                <div className="rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
                  <div className="text-muted-foreground">Weight</div>
                  <div className="font-semibold">{v.toFixed(1)} kg</div>
                </div>
              );
            }}
          />
          <Area 
            type="monotone" 
            dataKey="v" 
            stroke="#d97706" 
            fill="#fbbf24" 
            strokeWidth={2} 
            fillOpacity={0.18} 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function TargetRow({
  label,
  current,
  total,
}: {
  label: string;
  current: number;
  total: number;
}) {
  const pct = calcPct(current, total);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="font-medium">{label}</div>
        <div className="text-muted-foreground">
          {current}/{total}
        </div>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

function ImagePlaceholder({ label }: { label: string }) {
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border bg-gradient-to-br from-amber-50 to-zinc-50">
      <div className="absolute left-3 top-3">
        <Badge className="rounded-full" variant="secondary">
          <Lock className="mr-1 h-3.5 w-3.5" />
          Private
        </Badge>
      </div>
      <div className="absolute inset-0 grid place-items-center p-6">
        <div className="text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-background shadow-sm">
            <Images className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-sm font-semibold">{label}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Upload your {label.toLowerCase()} photo
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------
// Mock data
// -----------------------------

const inspirationalQuotes = [
  "Progress, not perfection.",
  "Small steps lead to big changes.",
  "Your body can do it. It's your mind you need to convince.",
  "Consistency beats intensity every time.",
  "You don't have to be great to start, but you have to start to be great.",
  "The only bad workout is the one you didn't do.",
  "Strength doesn't come from what you can do. It comes from overcoming the things you once thought you couldn't.",
  "Today's choices shape tomorrow's results.",
];

const clientMock = {
  user: { name: "Brett", initials: "BE" },
  summary: {
    onTrackLabel: "On track",
    weeklyScore: 66,
    checkinsCompleted: 3,
    checkinsTotal: 12,
    streakDays: 0,
  },
  nextCheckin: {
    title: "Vana Health 2026 Check‑In",
    opensAt: "Fri 23 Jan, 9:00am",
    dueAt: "Sun 25 Jan, 9:00pm",
    opensInDays: 5,
    status: "scheduled" as "scheduled" | "open" | "overdue",
  },
  weeklyTargets: {
    protein: { label: "Protein goal", current: 3, total: 7 },
    steps: { label: "Steps (8k+)", current: 4, total: 7 },
    training: { label: "Training sessions", current: 2, total: 3 },
    sleep: { label: "Sleep (7h+)", current: 3, total: 7 },
  },
  trends: {
    weightKg: 100.0,
    weightDelta: -6.0,
    measurementsLabel: "No change",
    weightSeries: [
      { w: "Wk 1", v: 106.0 },
      { w: "Wk 2", v: 104.7 },
      { w: "Wk 3", v: 102.8 },
      { w: "Wk 4", v: 101.9 },
      { w: "Wk 5", v: 100.0 },
    ],
  },
  photos: {
    privacyNote: "Only you and your coach can view these.",
    sets: {
      front: { date: "Jan 2, 2026" },
      side: { date: "Jan 2, 2026" },
      back: { date: "Jan 2, 2026" },
    },
  },
  coachingFocus: {
    headline: "This week: consistency over perfection.",
    bullets: [
      "Eat protein first at each meal.",
      "Two strength sessions + one easy walk day.",
      "No alcohol for 7 days (reset inflammation + sleep).",
    ],
  },
};

// -----------------------------
// Component
// -----------------------------

export default function ClientPortalDashboard() {
  const { userProfile, loading: authLoading } = useAuth();
  const [showCoachNote, setShowCoachNote] = useState(true);
  const [tab, setTab] = useState("overview");
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [checkInsData, setCheckInsData] = useState<any[]>([]);

  // Rotate quotes every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuoteIndex((prev) => (prev + 1) % inspirationalQuotes.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch dashboard data
  useEffect(() => {
    if (authLoading || !userProfile?.email) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Get auth token for API calls
        let idToken: string | null = null;
        if (typeof window !== 'undefined' && userProfile?.uid) {
          try {
            const { auth } = await import('@/lib/firebase-client');
            if (auth?.currentUser) {
              idToken = await auth.currentUser.getIdToken();
            }
          } catch (authError) {
            console.warn('Could not get auth token:', authError);
          }
        }

        const headers: HeadersInit = {};
        if (idToken) {
          headers['Authorization'] = `Bearer ${idToken}`;
        }
        
        // Fetch all data in parallel
        const [portalRes, analyticsRes, checkInsRes] = await Promise.all([
          fetch(`/api/client-portal?clientEmail=${encodeURIComponent(userProfile.email)}`, { headers }).catch(() => null),
          fetch('/api/client-portal/analytics', { headers }).catch(() => null),
          fetch('/api/client-portal/check-ins', { headers }).catch(() => null),
        ]);

        if (portalRes?.ok) {
          const portalData = await portalRes.json();
          if (portalData.success) {
            setDashboardData(portalData.data);
          }
        }

        if (analyticsRes?.ok) {
          const analyticsJson = await analyticsRes.json();
          if (analyticsJson.success) {
            setAnalyticsData(analyticsJson.data);
          }
        }

        if (checkInsRes?.ok) {
          const checkInsJson = await checkInsRes.json();
          if (checkInsJson.success) {
            setCheckInsData(checkInsJson.data || []);
          }
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authLoading, userProfile?.email, userProfile?.uid]);

  // Compute dashboard state from real data
  const clientData = useMemo(() => {
    if (!dashboardData) return null;

    const client = dashboardData.client || {};
    const summary = dashboardData.summary || {};
    const checkIns = checkInsData || [];
    
    // Find next check-in - filter to only incomplete ones, then sort by due date and take the earliest
    const incompleteCheckIns = checkIns.filter((c: any) => 
      c.status !== 'completed' && c.status !== 'missed'
    );
    
    // Sort by due date (earliest first)
    incompleteCheckIns.sort((a: any, b: any) => {
      const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return dateA - dateB;
    });
    
    const nextCheckIn = incompleteCheckIns[0] || checkIns[0];

    // Calculate next check-in status
    let checkInStatus: "scheduled" | "open" | "overdue" = "scheduled";
    if (nextCheckIn) {
      const dueDate = nextCheckIn.dueDate ? new Date(nextCheckIn.dueDate) : null;
      const now = new Date();
      if (dueDate) {
        const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff >= 3 && nextCheckIn.status !== 'completed') {
          checkInStatus = "overdue";
        } else if (nextCheckIn.status === 'open') {
          checkInStatus = "open";
        }
      }
    }

    // Calculate check-in window (same logic as check-ins page)
    // Window opens: Friday 10am before the Monday of the week containing the due date
    // Window closes: Tuesday 12pm after that Monday
    const calculateCheckInWindow = (dueDateStr: string | null) => {
      if (!dueDateStr) return { opensAt: null, closesAt: null };
      
      // Parse the date string - handle ISO strings and ensure we use local time
      const due = new Date(dueDateStr);
      
      // Create a new date in local timezone to avoid timezone issues
      const dueLocal = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      
      // Find the Monday of the week containing the due date
      const dayOfWeek = dueLocal.getDay();
      const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : (8 - dayOfWeek));
      const weekMonday = new Date(dueLocal);
      weekMonday.setDate(dueLocal.getDate() - daysToMonday);
      weekMonday.setHours(0, 0, 0, 0);
      
      // Window opens: Friday 10am before that Monday (3 days before)
      const windowOpen = new Date(weekMonday);
      windowOpen.setDate(weekMonday.getDate() - 3);
      windowOpen.setHours(10, 0, 0, 0);
      
      // Window closes: Tuesday 12pm after that Monday (1 day after)
      const windowClose = new Date(weekMonday);
      windowClose.setDate(weekMonday.getDate() + 1);
      windowClose.setHours(12, 0, 0, 0);
      
      return { opensAt: windowOpen, closesAt: windowClose };
    };

    // Format dates - match check-ins page format
    const formatDate = (date: Date | null) => {
      if (!date) return '';
      // Use the same format as check-ins page
      return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short',
        day: 'numeric',
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true
      });
    };

    const windowInfo = nextCheckIn?.dueDate ? calculateCheckInWindow(nextCheckIn.dueDate) : { opensAt: null, closesAt: null };
    
    // Format opens date - match check-ins page exactly: "Opens [date] at 10:00 AM"
    let opensAt = 'TBD';
    if (windowInfo.opensAt) {
      // Format like check-ins page: "Friday Jan 16 at 10:00 AM"
      const datePart = windowInfo.opensAt.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
      const timePart = windowInfo.opensAt.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      opensAt = `${datePart} at ${timePart}`;
    }
    
    const dueAt = nextCheckIn?.dueDate ? formatDate(new Date(nextCheckIn.dueDate)) : '';
    
    // Calculate days until opens
    const opensInDays = windowInfo.opensAt ? 
      Math.max(0, Math.ceil((windowInfo.opensAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
    
    // Debug log to verify calculation
    if (nextCheckIn?.dueDate && typeof window !== 'undefined') {
      console.log('Check-in window calculation:', {
        checkInTitle: nextCheckIn.title,
        checkInStatus: nextCheckIn.status,
        dueDate: nextCheckIn.dueDate,
        calculatedOpensAt: windowInfo.opensAt?.toISOString(),
        formattedOpensAt: opensAt,
        totalCheckIns: checkIns.length,
        incompleteCount: incompleteCheckIns.length
      });
    }

    return {
      user: {
        name: client.firstName || userProfile?.firstName || 'User',
        initials: `${client.firstName?.[0] || ''}${client.lastName?.[0] || ''}`.toUpperCase() || 
                  `${userProfile?.firstName?.[0] || ''}${userProfile?.lastName?.[0] || ''}`.toUpperCase() || 'U',
      },
      summary: {
        onTrackLabel: summary.averageScore && summary.averageScore >= 60 ? "On track" : "Getting there",
        weeklyScore: summary.averageScore || 0,
        checkinsCompleted: summary.completedAssignments || 0,
        checkinsTotal: summary.totalAssignments || 0,
        streakDays: analyticsData?.quickStats?.currentStreak || 0,
      },
      nextCheckin: {
        title: nextCheckIn?.title || 'No check-ins scheduled',
        opensAt: opensAt || 'TBD',
        dueAt: dueAt || 'TBD',
        opensInDays: opensInDays,
        status: checkInStatus,
      },
      weeklyTargets: {
        protein: { label: "Protein goal", current: 0, total: 7 }, // TODO: Get from real data
        steps: { label: "Steps (8k+)", current: 0, total: 7 },
        training: { label: "Training sessions", current: 0, total: 3 },
        sleep: { label: "Sleep (7h+)", current: 0, total: 7 },
      },
      trends: {
        weightKg: analyticsData?.currentWeight || 0,
        weightDelta: analyticsData?.weightDelta || 0,
        measurementsLabel: analyticsData?.measurementsDelta ? `${analyticsData.measurementsDelta} cm change` : "No change",
        weightSeries: analyticsData?.weightHistory?.map((entry: any, idx: number) => ({
          w: `Wk ${idx + 1}`,
          v: entry.weight || 0
        })) || [],
      },
      photos: {
        privacyNote: "Only you and your coach can view these.",
        sets: {
          front: { date: "No photos yet" },
          side: { date: "No photos yet" },
          back: { date: "No photos yet" },
        },
      },
      coachingFocus: {
        headline: dashboardData.coach?.coachingNote || "This week: consistency over perfection.",
        bullets: [
          "Eat protein first at each meal.",
          "Two strength sessions + one easy walk day.",
          "No alcohol for 7 days (reset inflammation + sleep).",
        ],
      },
    };
  }, [dashboardData, analyticsData, checkInsData, userProfile]);

  const computed = useMemo(() => {
    if (!clientData) return { completionPct: 0 };
    const { checkinsCompleted, checkinsTotal } = clientData.summary;
    return {
      completionPct: calcPct(checkinsCompleted, checkinsTotal),
    };
  }, [clientData]);

  const next = clientData?.nextCheckin || clientMock.nextCheckin;
  const isOpen = next.status === "open";
  const isOverdue = next.status === "overdue";

  // Use real data or fallback to mock
  const displayData = clientData || clientMock;

  // Show loading state
  if (authLoading || loading) {
    return (
      <RoleProtected requiredRole="client">
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your dashboard...</p>
          </div>
        </div>
      </RoleProtected>
    );
  }

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-zinc-50">
      {/* Inspirational Quote Banner */}
      <div className="bg-gradient-to-r from-amber-50 via-amber-100/50 to-amber-50 border-b border-amber-200/50">
        <div className="mx-auto max-w-7xl px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center justify-center gap-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-amber-600" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.996 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.984zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
              </svg>
            </div>
            <div className="flex-1 text-center">
              <p className="text-sm md:text-base font-medium text-amber-900 transition-opacity duration-500">
                {inspirationalQuotes[currentQuoteIndex]}
              </p>
            </div>
            <div className="flex-shrink-0 flex gap-1">
              {inspirationalQuotes.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentQuoteIndex(index)}
                  className={classNames(
                    "h-1.5 w-1.5 rounded-full transition-all",
                    index === currentQuoteIndex
                      ? "bg-amber-600 w-6"
                      : "bg-amber-300 hover:bg-amber-400"
                  )}
                  aria-label={`Go to quote ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl gap-6 p-4 md:p-6">
        {/* Sidebar */}
        <aside className="hidden w-72 shrink-0 md:block">
          <div className="sticky top-6 space-y-4">
            <Card className="rounded-3xl border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-amber-200/60 text-amber-950">
                      {displayData.user.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{displayData.user.name}</div>
                    <div className="text-xs text-muted-foreground">Client portal</div>
                  </div>
                  <div className="ml-auto">
                    <Badge className="rounded-full bg-amber-100 text-amber-950">Active</Badge>
                  </div>
                </div>

                <Separator className="my-4" />

                <nav className="space-y-1">
                  <SidebarItem icon={LayoutDashboard} label="Dashboard" active />
                  <SidebarItem icon={ClipboardCheck} label="My check-ins" />
                  <SidebarItem icon={Target} label="My goals" />
                  <SidebarItem icon={Ruler} label="Measurements" />
                  <SidebarItem icon={Images} label="Progress photos" />
                  <SidebarItem icon={MessageSquare} label="Messages" />
                  <SidebarItem icon={User} label="Profile" />
                  <SidebarItem icon={HelpCircle} label="Support" />
                </nav>

                <Separator className="my-4" />

                <Button
                  variant="ghost"
                  className="w-full justify-start rounded-2xl text-muted-foreground"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-0 bg-amber-50 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Coach tone</CardTitle>
                <CardDescription>Keep the dashboard human, not clinical.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Show coach note</div>
                  <button
                    onClick={() => setShowCoachNote((v) => !v)}
                    className={classNames(
                      "relative inline-flex h-6 w-11 items-center rounded-full border transition",
                      showCoachNote ? "bg-amber-200 border-amber-300" : "bg-background"
                    )}
                    aria-label="Toggle coach note"
                  >
                    <span
                      className={classNames(
                        "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
                        showCoachNote ? "translate-x-5" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1">
          {/* Top bar */}
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="space-y-1 flex-1 min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">
                Welcome back{displayData.user.name ? `, ${displayData.user.name}` : ""}.
              </h1>
                <p className="text-sm text-muted-foreground">
                  Your progress, your pace — we keep it simple and consistent.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button variant="outline" className="rounded-2xl whitespace-nowrap">
                  <Bell className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Notifications</span>
                </Button>
                <Button className="rounded-2xl bg-amber-600 hover:bg-amber-700 text-white whitespace-nowrap">
                  Message coach
                </Button>
              </div>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="rounded-2xl bg-white shadow-sm w-full sm:w-auto">
                <TabsTrigger value="overview" className="rounded-2xl">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="trends" className="rounded-2xl">
                  Trends
                </TabsTrigger>
                <TabsTrigger value="photos" className="rounded-2xl">
                  Photos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6 space-y-6">
                {/* HERO: Next Action */}
                <Card
                  className={classNames(
                    "rounded-3xl border-0 shadow-sm",
                    isOverdue ? "bg-rose-50" : isOpen ? "bg-emerald-50" : "bg-white"
                  )}
                >
                  <CardContent className="p-5 md:p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            className={classNames(
                              "rounded-full",
                              isOverdue
                                ? "bg-rose-100 text-rose-800"
                                : isOpen
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-950"
                            )}
                          >
                            {isOverdue ? "Overdue" : isOpen ? "Open now" : "Scheduled"}
                          </Badge>
                          <span className="text-sm text-muted-foreground">Next check‑in</span>
                        </div>
                        <h2 className="mt-2 truncate text-xl font-semibold">{next.title}</h2>
                        <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                          <div>
                            <span className="font-medium text-foreground">Opens:</span> {next.opensAt}
                          </div>
                          <div>
                            <span className="font-medium text-foreground">Due:</span> {next.dueAt}
                          </div>
                        </div>

                        {showCoachNote && (
                          <div className="mt-4 rounded-2xl border bg-zinc-50 px-4 py-3">
                            <div className="text-xs font-semibold text-muted-foreground">Coach note</div>
                            <div className="mt-1 text-sm font-medium">{displayData.coachingFocus.headline}</div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 md:w-[320px]">
                        <Button
                          disabled={!isOpen}
                          className={classNames(
                            "w-full rounded-2xl",
                            isOpen
                              ? "bg-amber-600 hover:bg-amber-700"
                              : "bg-zinc-200 text-zinc-600 hover:bg-zinc-200"
                          )}
                        >
                          <ClipboardCheck className="mr-2 h-4 w-4" />
                          {isOpen ? "Complete check‑in" : `Opens in ${next.opensInDays} days`}
                        </Button>
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" className="rounded-2xl">
                            <CalendarPlus className="mr-2 h-4 w-4" />
                            Add
                          </Button>
                          <Button variant="outline" className="rounded-2xl">
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Quick update
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Quick update is a 30‑second mid‑week check to keep you on track.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 3-column overview */}
                <div className="grid gap-4 lg:grid-cols-3">
                  {/* Weekly Targets */}
                  <Card className="rounded-3xl border-0 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">This week's targets</CardTitle>
                      <CardDescription>Keep it boring. Boring works.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <TargetRow {...displayData.weeklyTargets.protein} />
                      <TargetRow {...displayData.weeklyTargets.steps} />
                      <TargetRow {...displayData.weeklyTargets.training} />
                      <TargetRow {...displayData.weeklyTargets.sleep} />
                    </CardContent>
                  </Card>

                  {/* Trends */}
                  <Card className="rounded-3xl border-0 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Trends</CardTitle>
                      <CardDescription>Look at the direction, not the daily noise.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-xs text-muted-foreground">Current weight</div>
                          <div className="mt-1 flex items-center gap-2">
                            <div className="text-2xl font-semibold">
                              {displayData.trends.weightKg > 0 ? displayData.trends.weightKg.toFixed(1) : '--'}
                              <span className="ml-1 text-base font-medium text-muted-foreground">kg</span>
                            </div>
                            {displayData.trends.weightDelta !== 0 && <TrendPill delta={displayData.trends.weightDelta} />}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Measurements: {displayData.trends.measurementsLabel}
                          </div>
                        </div>
                        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-50">
                          <Scale className="h-5 w-5 text-amber-800" />
                        </div>
                      </div>
                      {displayData.trends.weightSeries.length > 0 ? (
                        <MiniArea data={displayData.trends.weightSeries} />
                      ) : (
                        <div className="h-20 flex items-center justify-center text-sm text-muted-foreground">
                          No weight data yet
                        </div>
                      )}
                      <Button variant="outline" className="w-full rounded-2xl">
                        View full trends
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Consistency */}
                  <Card className="rounded-3xl border-0 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Consistency</CardTitle>
                      <CardDescription>Momentum is built, not found.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border bg-zinc-50 p-3">
                          <div className="text-xs text-muted-foreground">Weekly score</div>
                          <div className="mt-1 text-2xl font-semibold">{displayData.summary.weeklyScore}%</div>
                          <div className="mt-2 text-xs text-muted-foreground">{displayData.summary.onTrackLabel}</div>
                        </div>
                        <div className="rounded-2xl border bg-zinc-50 p-3">
                          <div className="text-xs text-muted-foreground">Streak</div>
                          <div className="mt-1 flex items-center gap-2 text-2xl font-semibold">
                            {displayData.summary.streakDays}
                            <Flame className="h-5 w-5 text-amber-700" />
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">days</div>
                        </div>
                      </div>

                      <div className="rounded-2xl border bg-white p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold">Check-ins completed</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {displayData.summary.checkinsCompleted} completed so far{displayData.summary.checkinsCompleted > 0 ? ' (great start).' : '.'}
                            </div>
                          </div>
                          <Badge className="rounded-full" variant="secondary">
                            {computed.completionPct}%
                          </Badge>
                        </div>
                        <div className="mt-3">
                          <Progress value={computed.completionPct} className="h-2" />
                        </div>
                      </div>

                      <div className="rounded-2xl border bg-amber-50 p-4">
                        <div className="text-sm font-semibold">Simple wins</div>
                        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                          {displayData.coachingFocus.bullets.map((b: string, idx: number) => (
                            <li key={idx} className="flex gap-2">
                              <span className="mt-0.5 grid h-5 w-5 place-items-center rounded-full bg-amber-200/70 text-amber-950">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </span>
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Photos */}
                <Card className="rounded-3xl border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">Progress photos</CardTitle>
                        <CardDescription>{displayData.photos.privacyNote}</CardDescription>
                      </div>
                      <Button className="rounded-2xl bg-amber-600 hover:bg-amber-700">Upload photos</Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <ImagePlaceholder label="Front" />
                        <div className="mt-2 text-xs text-muted-foreground">Last set: {displayData.photos.sets.front.date}</div>
                      </div>
                      <div>
                        <ImagePlaceholder label="Side" />
                        <div className="mt-2 text-xs text-muted-foreground">Last set: {displayData.photos.sets.side.date}</div>
                      </div>
                      <div>
                        <ImagePlaceholder label="Back" />
                        <div className="mt-2 text-xs text-muted-foreground">Last set: {displayData.photos.sets.back.date}</div>
                      </div>
                    </div>

                    <div className="mt-5 rounded-2xl border bg-zinc-50 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm font-semibold">Photo guide</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            Same lighting, same distance, same pose. This makes changes obvious.
                          </div>
                        </div>
                        <Button variant="outline" className="rounded-2xl">View how‑to guide</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="trends" className="mt-6 space-y-6">
                <Card className="rounded-3xl border-0 shadow-sm">
                  <CardHeader>
                    <CardTitle>Trends (preview)</CardTitle>
                    <CardDescription>This is where you'd expand charts, history, and notes.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card className="rounded-3xl">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Weight</CardTitle>
                          <CardDescription>Last 5 weeks</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {displayData.trends.weightSeries.length > 0 ? (
                            <MiniArea data={displayData.trends.weightSeries} />
                          ) : (
                            <div className="h-20 flex items-center justify-center text-sm text-muted-foreground">
                              No weight data yet
                            </div>
                          )}
                        </CardContent>
                      </Card>
                      <Card className="rounded-3xl">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Measurements</CardTitle>
                          <CardDescription>Coming soon</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="rounded-2xl border bg-zinc-50 p-4 text-sm text-muted-foreground">
                            Add waist/hips/thigh/arm trends here, with the same calm styling.
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="photos" className="mt-6 space-y-6">
                <Card className="rounded-3xl border-0 shadow-sm">
                  <CardHeader>
                    <CardTitle>Photos (preview)</CardTitle>
                    <CardDescription>Add compare slider + timeline + coach comments.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                    <ImagePlaceholder label="Front" />
                    <ImagePlaceholder label="Side" />
                    <ImagePlaceholder label="Back" />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Mobile nav (simple) */}
          <div className="mt-8 md:hidden">
            <Card className="rounded-3xl border-0 shadow-sm">
              <CardContent className="p-3">
                <div className="grid grid-cols-4 gap-2">
                  <Button variant="secondary" className="rounded-2xl">
                    <LayoutDashboard className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" className="rounded-2xl">
                    <ClipboardCheck className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" className="rounded-2xl">
                    <Images className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" className="rounded-2xl">
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <footer className="border-t bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-4 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">Vana Health</span>
            <span>•</span>
            <span>Client portal preview</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Lock className="h-3.5 w-3.5" /> Privacy-first by design
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Simple, consistent, trackable
            </span>
          </div>
        </div>
      </footer>
    </div>
    </RoleProtected>
  );
}

