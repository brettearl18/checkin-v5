'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import CoachNavigation from '@/components/CoachNavigation';
import Link from 'next/link';

type PaymentStatus = 'paid' | 'past_due' | 'failed' | 'canceled' | null;

interface ClientRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  coachId?: string;
  paymentStatus?: PaymentStatus;
  lastPaymentAt?: string | null;
  nextBillingAt?: string | null;
  stripeCustomerId?: string | null;
}

function parseDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000).toISOString();
  }
  return null;
}

export default function PaymentReportPage() {
  const { user, userProfile } = useAuth();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'up_to_date' | 'not_up_to_date'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'lastPayment'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (!user || !userProfile?.uid) return;
    setAuthError(false);
    const fetchClients = async () => {
      try {
        setLoading(true);
        const token = await user.getIdToken(true);
        if (!token) {
          setAuthError(true);
          return;
        }
        const res = await fetch(`/api/clients?coachId=${userProfile.uid}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'same-origin',
        });
        if (!res.ok) {
          setAuthError(true);
          setClients([]);
          return;
        }
        const data = await res.json();
        const list = (data.clients || []).map((c: any) => ({
          id: c.id,
          firstName: c.firstName ?? '',
          lastName: c.lastName ?? '',
          email: c.email ?? '',
          coachId: c.coachId,
          paymentStatus: c.paymentStatus ?? null,
          lastPaymentAt: parseDate(c.lastPaymentAt) ?? null,
          nextBillingAt: parseDate(c.nextBillingAt) ?? null,
          stripeCustomerId: c.stripeCustomerId ?? null,
        }));
        setClients(list);
      } catch {
        setAuthError(true);
        setClients([]);
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, [user, userProfile?.uid]);

  const isUpToDate = (c: ClientRow) => c.paymentStatus === 'paid';

  const filteredAndSorted = useMemo(() => {
    let list = clients;
    if (filterStatus === 'up_to_date') list = list.filter(isUpToDate);
    if (filterStatus === 'not_up_to_date') list = list.filter((c) => !isUpToDate(c));
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') {
        const na = `${a.firstName} ${a.lastName}`.trim() || a.email;
        const nb = `${b.firstName} ${b.lastName}`.trim() || b.email;
        cmp = na.localeCompare(nb);
      } else if (sortBy === 'status') {
        const sa = a.paymentStatus ?? 'none';
        const sb = b.paymentStatus ?? 'none';
        cmp = sa.localeCompare(sb);
      } else {
        const da = a.lastPaymentAt ? new Date(a.lastPaymentAt).getTime() : 0;
        const db = b.lastPaymentAt ? new Date(b.lastPaymentAt).getTime() : 0;
        cmp = da - db;
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [clients, filterStatus, sortBy, sortOrder]);

  const statusLabel = (c: ClientRow) => {
    if (!c.stripeCustomerId) return { label: 'Not linked', className: 'bg-gray-100 text-gray-700' };
    switch (c.paymentStatus) {
      case 'paid':
        return { label: 'Up to date', className: 'bg-emerald-100 text-emerald-800' };
      case 'failed':
        return { label: 'Failed', className: 'bg-red-100 text-red-800' };
      case 'past_due':
        return { label: 'Past due', className: 'bg-amber-100 text-amber-800' };
      case 'canceled':
        return { label: 'Canceled', className: 'bg-gray-100 text-gray-600' };
      default:
        return { label: 'Unknown', className: 'bg-gray-100 text-gray-600' };
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
  };

  const upToDateCount = clients.filter(isUpToDate).length;
  const notUpToDateCount = clients.length - upToDateCount;

  return (
    <RoleProtected requiredRole="coach">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex">
        <CoachNavigation />
        <div className="flex-1 ml-8 p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Payment Report
                </h1>
                <p className="text-gray-600 mt-2 text-lg">
                  See which clients are up to date on payments
                </p>
              </div>
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 font-medium">
                ← Back to Dashboard
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
              <div className="animate-pulse space-y-4">
                <div className="h-10 bg-gray-200 rounded w-1/3" />
                <div className="h-64 bg-gray-100 rounded" />
              </div>
            </div>
          ) : authError ? (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center">
              <p className="text-gray-700">Could not load clients. Please refresh the page.</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-6">
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <label className="text-sm font-medium text-gray-700">Filter:</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                    className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="all">All clients ({clients.length})</option>
                    <option value="up_to_date">Up to date ({upToDateCount})</option>
                    <option value="not_up_to_date">Not up to date ({notUpToDateCount})</option>
                  </select>
                  <label className="text-sm font-medium text-gray-700 ml-4">Sort by:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="name">Name</option>
                    <option value="status">Payment status</option>
                    <option value="lastPayment">Last payment</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
                    className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  >
                    {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                  </button>
                </div>
                <p className="text-sm text-gray-500">
                  Showing {filteredAndSorted.length} of {clients.length} clients
                </p>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                {filteredAndSorted.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    No clients match the current filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50/80">
                          <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Client</th>
                          <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Email</th>
                          <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Payment status</th>
                          <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Last payment</th>
                          <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Next billing</th>
                          <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAndSorted.map((c) => {
                          const { label, className } = statusLabel(c);
                          const name = `${c.firstName} ${c.lastName}`.trim() || c.email || '—';
                          return (
                            <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                              <td className="py-4 px-6 font-medium text-gray-900">{name}</td>
                              <td className="py-4 px-6 text-gray-600">{c.email || '—'}</td>
                              <td className="py-4 px-6">
                                <span className={`inline-block px-2 py-1 rounded-lg text-xs font-medium ${className}`}>
                                  {label}
                                </span>
                              </td>
                              <td className="py-4 px-6 text-gray-600 text-sm">{formatDate(c.lastPaymentAt)}</td>
                              <td className="py-4 px-6 text-gray-600 text-sm">{formatDate(c.nextBillingAt)}</td>
                              <td className="py-4 px-6">
                                <Link
                                  href={`/clients/${c.id}`}
                                  className="text-orange-600 hover:text-orange-700 font-medium text-sm"
                                >
                                  View client
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </RoleProtected>
  );
}
