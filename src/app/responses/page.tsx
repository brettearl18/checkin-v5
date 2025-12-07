'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';

interface FormResponse {
  id: string;
  formId: string;
  formTitle: string;
  responses: { [key: string]: any };
  score: number;
  totalQuestions: number;
  answeredQuestions: number;
  submittedAt: any;
}

interface Form {
  id: string;
  title: string;
  description: string;
  category: string;
}

export default function ResponsesPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to check-ins page which now includes all response functionality
    router.replace('/check-ins');
  }, [router]);

  return (
    <RoleProtected requiredRole="coach">
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to Check-ins...</p>
        </div>
      </div>
    </RoleProtected>
  );
} 