'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import SuccessNotification from './SuccessNotification';

export default function ClientSuccessNotification() {
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for success parameters in URL
    const success = searchParams.get('success');
    const clientId = searchParams.get('clientId');
    
    if (success === 'true' && clientId) {
      setSuccessMessage(`✅ Client created successfully! Client ID: ${clientId}`);
      setShowSuccessNotification(true);
      
      // Clean up URL parameters
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      url.searchParams.delete('clientId');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  return (
    <SuccessNotification
      message={successMessage}
      isVisible={showSuccessNotification}
      onClose={() => setShowSuccessNotification(false)}
    />
  );
} 