'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';
import Link from 'next/link';

interface BillingHistorySubscription {
  id: string;
  status: string;
  productName: string;
  priceInterval: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

interface BillingHistoryInvoice {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  invoicePdf?: string;
  hostedInvoiceUrl?: string;
}

interface BillingHistory {
  subscription: BillingHistorySubscription | null;
  invoices: BillingHistoryInvoice[];
  appProgram: {
    programStartDate: string | null;
    programDuration: number | null;
    programDurationUnit: string | null;
  };
}

function formatDate(dateField: string | null | undefined): string {
  if (!dateField) return '—';
  try {
    const d = new Date(dateField);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

export default function ClientPortalPaymentsPage() {
  const { userProfile } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingHistory, setBillingHistory] = useState<BillingHistory | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(true);

  useEffect(() => {
    if (!userProfile?.email) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    (async () => {
      try {
        const headers = await import('@/lib/auth-headers').then((m) => m.getAuthHeaders());
        const res = await fetch(
          `/api/client-portal?clientEmail=${encodeURIComponent(userProfile.email)}`,
          { signal: controller.signal, headers }
        );
        const result = await res.json();
        if (result.success && result.data?.client?.id) {
          setClientId(result.data.client.id);
        }
      } catch {
        setClientId(null);
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [userProfile?.email]);

  useEffect(() => {
    if (!clientId) {
      setLoadingBilling(false);
      setBillingHistory(null);
      return;
    }
    setLoadingBilling(true);
    const controller = new AbortController();
    (async () => {
      try {
        const headers = await import('@/lib/auth-headers').then((m) => m.getAuthHeaders());
        const res = await fetch(`/api/clients/${clientId}/billing/history`, {
          signal: controller.signal,
          headers,
        });
        const data = await res.json();
        if (data.success) {
          setBillingHistory({
            subscription: data.subscription ?? null,
            invoices: data.invoices ?? [],
            appProgram: data.appProgram ?? {
              programStartDate: null,
              programDuration: null,
              programDurationUnit: null,
            },
          });
        } else {
          setBillingHistory(null);
        }
      } catch {
        setBillingHistory(null);
      } finally {
        setLoadingBilling(false);
      }
    })();
    return () => controller.abort();
  }, [clientId]);

  if (loading || !clientId) {
    return (
      <RoleProtected allowedRoles={['client']}>
        <div className="min-h-screen bg-gray-50 flex">
          <ClientNavigation />
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent" />
            </div>
          </main>
        </div>
      </RoleProtected>
    );
  }

  return (
    <RoleProtected allowedRoles={['client']}>
      <div className="min-h-screen bg-gray-50 flex">
        <ClientNavigation />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <Link
                href="/client-portal"
                className="text-sm text-gray-600 hover:text-gray-900 font-medium inline-flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Payments</h1>
            <p className="text-gray-600 text-sm mb-6">View your subscription and payment history</p>

            <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-5 border-b-2 border-emerald-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Payment & Program</h2>
                  <p className="text-sm text-gray-600 mt-1">Subscription and payment history</p>
                </div>
                <a
                  href="https://go.vanahealth.com.au/myaccount"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors whitespace-nowrap"
                >
                  View full account
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
              <div className="p-6">
                {loadingBilling ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-orange-500 border-t-transparent" />
                  </div>
                ) : (
                  <>
                    <div className="mb-8">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Program & subscription</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {billingHistory?.subscription && (
                          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                            <div className="text-xs font-medium text-emerald-700 mb-1">Subscription</div>
                            <div className="font-semibold text-gray-900">{billingHistory.subscription.productName}</div>
                            <div className="text-sm text-gray-600 mt-1">
                              Billing: {billingHistory.subscription.priceInterval} · Status: {billingHistory.subscription.status}
                              {billingHistory.subscription.cancelAtPeriodEnd && (
                                <span className="ml-2 text-amber-600">(cancels at period end)</span>
                              )}
                            </div>
                            {billingHistory.subscription.currentPeriodEnd && (
                              <div className="text-xs text-gray-500 mt-2">
                                Current period ends: {formatDate(billingHistory.subscription.currentPeriodEnd)}
                              </div>
                            )}
                          </div>
                        )}
                        {(billingHistory?.appProgram?.programStartDate || billingHistory?.appProgram?.programDuration != null) && (
                          <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                            <div className="text-xs font-medium text-blue-700 mb-1">Program</div>
                            <div className="font-semibold text-gray-900">
                              {billingHistory?.appProgram?.programStartDate
                                ? formatDate(billingHistory.appProgram.programStartDate)
                                : '—'}
                              {billingHistory?.appProgram?.programDuration != null && (
                                <span className="text-gray-600 font-normal">
                                  {' '}· {billingHistory.appProgram.programDuration} {billingHistory?.appProgram?.programDurationUnit ?? 'weeks'}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {!billingHistory?.subscription && !billingHistory?.appProgram?.programStartDate && (
                          <p className="text-gray-500 col-span-2">No subscription or program details on file.</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Payment history</h3>
                      {billingHistory?.invoices && billingHistory.invoices.length > 0 ? (
                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Amount</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase">Invoice</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {billingHistory.invoices.map((inv) => (
                                <tr key={inv.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm text-gray-900">{formatDate(inv.date)}</td>
                                  <td className="px-4 py-3 text-sm text-gray-900">
                                    {inv.currency} {(inv.amount ?? 0).toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                        inv.status === 'paid'
                                          ? 'bg-green-100 text-green-800'
                                          : inv.status === 'open' || inv.status === 'draft'
                                            ? 'bg-red-100 text-red-800'
                                            : 'bg-red-100 text-red-800'
                                      }`}
                                    >
                                      {inv.status === 'paid' ? 'Paid' : inv.status === 'open' || inv.status === 'draft' ? 'Failed' : inv.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {(inv.hostedInvoiceUrl || inv.invoicePdf) && (
                                      <a
                                        href={inv.hostedInvoiceUrl || inv.invoicePdf}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-orange-600 hover:text-orange-700 text-sm font-medium"
                                      >
                                        View
                                      </a>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-gray-500 py-4">No payment history yet.</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </RoleProtected>
  );
}
