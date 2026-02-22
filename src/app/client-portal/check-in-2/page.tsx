'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getCheckInLinkId } from '@/lib/checkin-link-utils';

interface FormType {
  formId: string;
  title: string;
}

interface ResumableCheckIn {
  id: string;
  documentId?: string;
  title: string;
  dueDate: string;
  status: string;
  formId?: string;
  isRecurring?: boolean;
  recurringWeek?: number;
  responseId?: string;
  /** Monday YYYY-MM-DD for the week this check-in was for (from API when set by resolve-v2). */
  reflectionWeekStart?: string;
}

/** Get Monday YYYY-MM-DD (local) for the reflection week (week this check-in was for). Uses date part only to avoid timezone skew. */
function getReflectionWeekMonday(dueDate: string): string {
  const dateOnly = dueDate.slice(0, 10);
  const d = new Date(dateOnly + 'T12:00:00');
  d.setDate(d.getDate() - 7);
  const day = d.getDay();
  const toMon = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - toMon);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${date}`;
}

export default function CheckIn2Page() {
  const { userProfile, authLoading } = useAuth();
  const router = useRouter();
  const [clientId, setClientId] = useState<string | null>(null);
  const [formTypes, setFormTypes] = useState<FormType[]>([]);
  const [checkins, setCheckins] = useState<ResumableCheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const DISMISSED_RESUME_KEY = 'checkin-2-dismissed-resume';
  const [dismissedResumeIds, setDismissedResumeIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(DISMISSED_RESUME_KEY);
      const arr = raw ? (JSON.parse(raw) as string[]) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  });

  const dismissResume = (linkId: string) => {
    setDismissedResumeIds((prev) => {
      const next = new Set(prev).add(linkId);
      try {
        localStorage.setItem(DISMISSED_RESUME_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const resumableCheckins = useMemo(() => {
    return checkins
      .filter((c) => c.status !== 'completed' && c.status !== 'missed')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [checkins]);

  const visibleResumableCheckins = useMemo(() => {
    return resumableCheckins.filter((c) => !dismissedResumeIds.has(getCheckInLinkId(c)));
  }, [resumableCheckins, dismissedResumeIds]);

  const weekOptions = useMemo(() => {
    const today = new Date();
    const day = today.getDay();
    const daysToMonday = day === 0 ? 6 : day - 1;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - daysToMonday);
    thisMonday.setHours(0, 0, 0, 0);
    const options: { weekStart: string; label: string }[] = [];
    for (let i = -4; i <= 1; i++) {
      const m = new Date(thisMonday);
      m.setDate(thisMonday.getDate() + i * 7);
      const y = m.getFullYear();
      const mo = String(m.getMonth() + 1).padStart(2, '0');
      const d = String(m.getDate()).padStart(2, '0');
      const weekStart = `${y}-${mo}-${d}`;
      const sun = new Date(m);
      sun.setDate(m.getDate() + 6);
      const label =
        i === 0
          ? `This week (${m.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sun.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`
          : `${m.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sun.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      options.push({ weekStart, label });
    }
    return options;
  }, []);

  const completedWeekStartsForForm = useMemo(() => {
    if (!selectedFormId) return new Set<string>();
    const set = new Set<string>();
    checkins.forEach((c) => {
      if (c.formId !== selectedFormId) return;
      if (c.status !== 'completed' && !c.responseId) return;
      // Prefer server-provided reflection week (set by resolve-v2) so completed weeks match exactly
      if (c.reflectionWeekStart && /^\d{4}-\d{2}-\d{2}$/.test(c.reflectionWeekStart)) {
        set.add(c.reflectionWeekStart);
        return;
      }
      const due =
        typeof c.dueDate === 'string'
          ? c.dueDate
          : (c.dueDate as any)?.toDate?.()
            ? (c.dueDate as any).toDate().toISOString()
            : c.dueDate != null
              ? new Date(c.dueDate).toISOString()
              : null;
      if (due) set.add(getReflectionWeekMonday(due));
    });
    return set;
  }, [checkins, selectedFormId]);

  useEffect(() => {
    if (!userProfile?.email) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const headers = await import('@/lib/auth-headers').then((m) => m.getAuthHeaders());
        const res = await fetch(`/api/client-portal?clientEmail=${userProfile.email}`, { headers });
        if (!res.ok || cancelled) return;
        const result = await res.json();
        if (cancelled) return;
        if (result.success && result.data?.client) {
          setClientId(result.data.client.id);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userProfile?.email]);

  useEffect(() => {
    if (!clientId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const headers = await import('@/lib/auth-headers').then((m) => m.getAuthHeaders());
        const res = await fetch(`/api/client-portal/check-ins?clientId=${clientId}`, { headers });
        if (!res.ok || cancelled) return;
        const result = await res.json();
        if (cancelled) return;
        if (result.success && Array.isArray(result.data?.checkins)) {
          const list = result.data.checkins as ResumableCheckIn[];
          setCheckins(list);
          const seen = new Set<string>();
          const types: FormType[] = list
            .filter((c) => {
              if (seen.has(c.formId)) return false;
              seen.add(c.formId);
              return true;
            })
            .map((c) => ({ formId: c.formId, title: c.title || c.formId }));
          setFormTypes(types);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const handleContinue = async () => {
    if (!clientId || !selectedFormId || !selectedWeekStart) return;
    setResolving(true);
    try {
      const authHeaders = await import('@/lib/auth-headers').then((m) => m.getAuthHeaders());
      const res = await fetch('/api/client-portal/check-in-resolve-v2', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          formId: selectedFormId,
          weekStart: selectedWeekStart,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success || !data?.assignmentId) {
        alert(data?.message || 'Could not start check-in. Please try again.');
        return;
      }
      router.push(`/client-portal/check-in/${data.assignmentId}`);
    } catch {
      alert('Something went wrong. Please try again.');
    } finally {
      setResolving(false);
    }
  };

  return (
    <RoleProtected allowedRoles={['client']}>
      <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
        <ClientNavigation />
        <main className="flex-1 lg:ml-4 p-5 lg:p-5 pt-20 lg:pt-8 overflow-x-hidden">
          <div className="max-w-lg mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">New check-in</h1>
              <p className="text-gray-600 mt-1">
                Choose the type and week, then we’ll open the form for that week.
              </p>
            </div>

            {!loading && visibleResumableCheckins.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">Resume check-in</h2>
                <div className="space-y-2">
                  {visibleResumableCheckins.slice(0, 5).map((c) => {
                    const linkId = getCheckInLinkId(c);
                    const due = new Date(c.dueDate);
                    const weekEnd = new Date(due);
                    weekEnd.setDate(due.getDate() - 1);
                    const weekEndStr = weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return (
                      <div
                        key={c.id + (c.recurringWeek ?? 0)}
                        className="flex items-center gap-2 rounded-xl border-2 border-emerald-200 bg-emerald-50/80 overflow-hidden"
                      >
                        <Link
                          href={`/client-portal/check-in/${linkId}`}
                          className="flex-1 min-w-0 px-4 py-3 font-medium text-emerald-900 hover:bg-emerald-50 transition-colors text-left"
                        >
                          <span className="font-semibold">{c.title}</span>
                          <span className="ml-2 text-sm text-emerald-700">– Week ending {weekEndStr}</span>
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            dismissResume(linkId);
                          }}
                          className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors rounded-r-lg"
                          title="Remove from list"
                          aria-label="Remove from list"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-1.5">Removing only hides it from this list. You can still open it from New check-in.</p>
              </div>
            )}

            {loading ? (
              <div className="bg-white rounded-2xl shadow p-8 text-center text-gray-500">Loading…</div>
            ) : !clientId ? (
              <div className="bg-white rounded-2xl shadow p-8 text-center text-gray-600">
                Could not load your account. Please try again or contact support.
              </div>
            ) : formTypes.length === 0 ? (
              <div className="bg-white rounded-2xl shadow p-8 text-center text-gray-600">
                No check-in types assigned. Ask your coach to assign a form.
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {step === 1 ? 'Choose check-in type' : 'Which week?'}
                  </h2>
                </div>
                <div className="p-6">
                  {step === 1 && (
                    <>
                      <p className="text-gray-600 text-sm mb-4">Select the type of check-in you want to complete.</p>
                      <div className="space-y-2 mb-6">
                        {formTypes.map((ft) => (
                          <button
                            key={ft.formId}
                            type="button"
                            onClick={() => setSelectedFormId(ft.formId)}
                            className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors ${
                              selectedFormId === ft.formId
                                ? 'border-amber-400 bg-amber-50 text-amber-900'
                                : 'border-gray-200 hover:border-gray-300 text-gray-900'
                            }`}
                          >
                            {ft.title}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => router.push('/client-portal/check-in-2')}
                          className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={!selectedFormId}
                          onClick={() => setStep(2)}
                          className="flex-1 px-4 py-2.5 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ backgroundColor: '#daa450' }}
                        >
                          Continue
                        </button>
                      </div>
                    </>
                  )}
                  {step === 2 && (
                    <>
                      <p className="text-gray-600 text-sm mb-4">Which week are you completing this for?</p>
                      <div className="space-y-2 mb-6">
                        {weekOptions.map((wo) => {
                          const alreadyDone = completedWeekStartsForForm.has(wo.weekStart);
                          return (
                            <button
                              key={wo.weekStart}
                              type="button"
                              disabled={alreadyDone}
                              onClick={() => !alreadyDone && setSelectedWeekStart(wo.weekStart)}
                              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-colors ${
                                alreadyDone
                                  ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                                  : selectedWeekStart === wo.weekStart
                                    ? 'border-amber-400 bg-amber-50 text-amber-900'
                                    : 'border-gray-200 hover:border-gray-300 text-gray-900'
                              }`}
                            >
                              <span>{wo.label}</span>
                              {alreadyDone && <span className="ml-2 text-sm font-medium">✓ Done</span>}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          disabled={resolving}
                          className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium disabled:opacity-50"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          disabled={
                            !selectedWeekStart ||
                            resolving ||
                            completedWeekStartsForForm.has(selectedWeekStart)
                          }
                          onClick={handleContinue}
                          className="flex-1 px-4 py-2.5 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ backgroundColor: '#daa450' }}
                        >
                          {resolving ? 'Opening…' : 'Continue'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </RoleProtected>
  );
}
