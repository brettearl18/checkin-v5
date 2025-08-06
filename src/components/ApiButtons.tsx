'use client';

export default function ApiButtons() {
  const handleSampleData = async () => {
    try {
      const response = await fetch('/api/sample-data', { method: 'POST' });
      const result = await response.json();
      alert(result.success ? 'Sample data created!' : 'Error: ' + result.error);
    } catch (error) {
      alert('Error testing API: ' + error);
    }
  };

  const handleCreateClient = async () => {
    try {
      const response = await fetch('/api/create-client-profile', { method: 'POST' });
      const result = await response.json();
      alert(result.success ? 'Client profile created!' : 'Error: ' + result.error);
    } catch (error) {
      alert('Error creating client: ' + error);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleSampleData}
        className="block w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded-md"
      >
        Populate Sample Data
      </button>
      <button
        onClick={handleCreateClient}
        className="block w-full text-left px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-md"
      >
        Create Client Profile
      </button>
    </div>
  );
} 