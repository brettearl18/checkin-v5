'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { scoringProfiles as defaultScoringProfiles, getDefaultThresholds, type ScoringProfile } from '@/lib/scoring-utils';

interface Client {
  id: string;
  name: string;
  email: string;
  status: string;
  coachId?: string;
}

interface ScoringConfig {
  clientId: string;
  clientName: string;
  scoringProfile: 'high-performance' | 'moderate' | 'lifestyle' | 'custom';
  thresholds: {
    redMax: number;    // Maximum score for Red zone (e.g., 33 or 75)
    orangeMax: number; // Maximum score for Orange zone (e.g., 80 or 89)
    // Green is implicitly: orangeMax + 1 to 100
  };
  categories: {
    [category: string]: {
      enabled: boolean;
      weight: number; // How much this category affects overall score
      thresholds: {
        red: number;
        yellow: number;
        green: number;
      };
    };
  };
  createdAt: any;
  updatedAt: any;
}

const defaultCategories = [
  'Health & Wellness',
  'Fitness & Exercise', 
  'Nutrition & Diet',
  'Mental Health',
  'Sleep & Recovery',
  'Stress Management',
  'Goals & Progress',
  'Lifestyle'
];

const scoringProfiles = {
  'high-performance': {
    name: 'High Performance',
    description: 'Elite athletes, competitive clients - Stricter standards (Red: 0-75%, Orange: 76-89%, Green: 90-100%)',
    thresholds: getDefaultThresholds('high-performance'),
    color: 'text-purple-600'
  },
  'moderate': {
    name: 'Moderate',
    description: 'Active clients, good adherence expected (Red: 0-60%, Orange: 61-85%, Green: 86-100%)',
    thresholds: getDefaultThresholds('moderate'),
    color: 'text-blue-600'
  },
  'lifestyle': {
    name: 'Lifestyle',
    description: 'General wellness, flexible approach - More lenient standards (Red: 0-33%, Orange: 34-80%, Green: 81-100%)',
    thresholds: getDefaultThresholds('lifestyle'),
    color: 'text-green-600'
  },
  'custom': {
    name: 'Custom',
    description: 'Customized thresholds for specific needs',
    thresholds: getDefaultThresholds('custom'),
    color: 'text-orange-600'
  }
};

export default function ClientScoringPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  
  const [client, setClient] = useState<Client | null>(null);
  const [scoringConfig, setScoringConfig] = useState<ScoringConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch client data
        const clientResponse = await fetch(`/api/clients/${clientId}`);
        const clientData = await clientResponse.json();
        
        if (clientData.success) {
          setClient(clientData.client);
        }

        // Fetch scoring configuration
        const scoringResponse = await fetch(`/api/clients/${clientId}/scoring`);
        const scoringData = await scoringResponse.json();
        
        if (scoringData.success) {
          setScoringConfig(scoringData.config);
        } else {
          // Create default config
          setScoringConfig({
            clientId,
            clientName: clientData.client?.name || 'Unknown Client',
            scoringProfile: 'moderate',
            thresholds: scoringProfiles.moderate.thresholds,
            categories: defaultCategories.reduce((acc, category) => {
              acc[category] = {
                enabled: true,
                weight: 1,
                thresholds: scoringProfiles.moderate.thresholds
              };
              return acc;
            }, {} as any),
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [clientId]);

  const handleProfileChange = (profile: keyof typeof scoringProfiles) => {
    if (!scoringConfig) return;
    const profileData = scoringProfiles[profile];
    setScoringConfig({
      ...scoringConfig,
      scoringProfile: profile,
      thresholds: profileData.thresholds,
      categories: Object.keys(scoringConfig.categories || {}).reduce((acc, category) => {
        acc[category] = {
          ...(scoringConfig.categories?.[category] || { enabled: true, weight: 1, thresholds: profileData.thresholds }),
          thresholds: profileData.thresholds
        };
        return acc;
      }, {} as any)
    });
  };

  const handleThresholdChange = (type: 'redMax' | 'orangeMax', value: number) => {
    if (!scoringConfig) return;
    setScoringConfig({
      ...scoringConfig,
      thresholds: {
        ...(scoringConfig.thresholds || { redMax: 60, orangeMax: 80 }),
        [type]: value
      }
    });
  };

  const handleCategoryToggle = (category: string, enabled: boolean) => {
    if (!scoringConfig) return;
    setScoringConfig({
      ...scoringConfig,
      categories: {
        ...(scoringConfig.categories || {}),
        [category]: {
          ...(scoringConfig.categories?.[category] || { enabled: true, weight: 1, thresholds: { red: 60, yellow: 80, green: 90 } }),
          enabled
        }
      }
    });
  };

  const handleCategoryWeightChange = (category: string, weight: number) => {
    if (!scoringConfig) return;
    setScoringConfig({
      ...scoringConfig,
      categories: {
        ...(scoringConfig.categories || {}),
        [category]: {
          ...(scoringConfig.categories?.[category] || { enabled: true, weight: 1, thresholds: { red: 60, yellow: 80, green: 90 } }),
          weight
        }
      }
    });
  };

  const handleCategoryThresholdChange = (category: string, type: 'redMax' | 'orangeMax', value: number) => {
    if (!scoringConfig) return;
    const currentCategory = scoringConfig.categories?.[category] || { enabled: true, weight: 1, thresholds: { red: 60, yellow: 80, green: 90 } };
    setScoringConfig({
      ...scoringConfig,
      categories: {
        ...(scoringConfig.categories || {}),
        [category]: {
          ...currentCategory,
          thresholds: {
            ...currentCategory.thresholds,
            [type]: value
          }
        }
      }
    });
  };

  const handleSave = async () => {
    if (!scoringConfig) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/clients/${clientId}/scoring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...scoringConfig,
          updatedAt: new Date()
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('Scoring configuration saved successfully!');
      } else {
        alert('Failed to save scoring configuration: ' + data.message);
      }
    } catch (error) {
      console.error('Error saving scoring config:', error);
      alert('Failed to save scoring configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (!scoringConfig) return 'text-gray-500';
    const orangeMax = scoringConfig.thresholds?.orangeMax ?? 80;
    const redMax = scoringConfig.thresholds?.redMax ?? 60;
    if (score > orangeMax) return 'text-green-600';
    if (score > redMax) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreStatus = (score: number) => {
    if (!scoringConfig) return 'Unknown';
    const orangeMax = scoringConfig.thresholds?.orangeMax ?? 80;
    const redMax = scoringConfig.thresholds?.redMax ?? 60;
    if (score > orangeMax) return '🟢 Excellent';
    if (score > redMax) return '🟠 On Track';
    return '🔴 Needs Attention';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!client || !scoringConfig) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Client Not Found</h1>
            <Link href="/clients" className="text-blue-600 hover:text-blue-800">
              ← Back to Clients
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Scoring Configuration</h1>
              <p className="text-gray-800 mt-2">
                Set personalized scoring thresholds for {client.name}
              </p>
            </div>
            <Link
              href={`/clients/${clientId}`}
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              ← Back to Client
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* Scoring Profile */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Scoring Profile</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {Object.entries(scoringProfiles).map(([key, profile]) => (
                  <label
                    key={key}
                    className={`relative flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                        scoringConfig?.scoringProfile === key
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="profile"
                      value={key}
                      checked={scoringConfig?.scoringProfile === key}
                      onChange={() => handleProfileChange(key as keyof typeof scoringProfiles)}
                      className="sr-only"
                    />
                    <div className="flex-1">
                      <div className={`font-medium ${profile.color}`}>{profile.name}</div>
                      <div className="text-sm text-gray-800 mt-1">{profile.description}</div>
                      <div className="text-xs text-gray-500 mt-2">
                        Red: 0-{profile.thresholds.redMax}% | Orange: {profile.thresholds.redMax + 1}-{profile.thresholds.orangeMax}% | Green: {profile.thresholds.orangeMax + 1}-100%
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Overall Thresholds */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Overall Thresholds</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-red-600 mb-2">
                    🔴 Red Zone Max (Needs Attention)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={scoringConfig?.thresholds?.redMax ?? 60}
                    onChange={(e) => handleThresholdChange('redMax', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum score for Red zone (0-{scoringConfig?.thresholds?.redMax ?? 60}%)</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-orange-600 mb-2">
                    🟠 Orange Zone Max (On Track)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={scoringConfig?.thresholds?.orangeMax ?? 80}
                    onChange={(e) => handleThresholdChange('orangeMax', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-orange-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum score for Orange zone ({(scoringConfig?.thresholds?.redMax ?? 60) + 1}-{scoringConfig?.thresholds?.orangeMax ?? 80}%)</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-green-600 mb-2">
                    🟢 Green Zone (Excellent)
                  </label>
                  <div className="w-full px-3 py-2 border border-green-300 rounded-md bg-gray-50">
                    <p className="text-sm text-gray-700">{(scoringConfig?.thresholds?.orangeMax ?? 80) + 1}-100%</p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Automatically calculated (above Orange max)</p>
                </div>
              </div>
            </div>

            {/* Category Configuration */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Category Configuration</h2>
              
              <div className="space-y-4">
                {Object.entries(scoringConfig?.categories || {}).map(([category, config]) => (
                  <div key={category} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={config.enabled}
                          onChange={(e) => handleCategoryToggle(category, e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-medium text-gray-900">{category}</span>
                      </div>
                      
                      {config.enabled && (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-800">Weight:</span>
                          <input
                            type="number"
                            min="0.1"
                            max="5"
                            step="0.1"
                            value={config.weight}
                            onChange={(e) => handleCategoryWeightChange(category, parseFloat(e.target.value) || 1)}
                            className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      )}
                    </div>
                    
                    {config.enabled && (
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-red-600 mb-1">Red</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={config.thresholds.red}
                            onChange={(e) => handleCategoryThresholdChange(category, 'red', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-sm border border-red-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-yellow-600 mb-1">Yellow</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={config.thresholds.yellow}
                            onChange={(e) => handleCategoryThresholdChange(category, 'yellow', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-sm border border-yellow-300 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-green-600 mb-1">Green</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={config.thresholds.green}
                            onChange={(e) => handleCategoryThresholdChange(category, 'green', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1 text-sm border border-green-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Preview Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Scoring Preview</h3>
              
              <div className="space-y-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900 mb-2">Traffic Light System</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>🔴 Red Zone:</span>
                      <span className="font-medium">0-{scoringConfig.thresholds.redMax}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>🟠 Orange Zone:</span>
                      <span className="font-medium">{scoringConfig.thresholds.redMax + 1}-{scoringConfig.thresholds.orangeMax}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>🟢 Green Zone:</span>
                      <span className="font-medium">{scoringConfig.thresholds.orangeMax + 1}-100%</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900">Example Scores:</h4>
                  {[95, 85, 75, 65, 55].map((score) => (
                    <div key={score} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="font-medium">{score}%</span>
                      <span className={`text-sm font-medium ${getScoreColor(score)}`}>
                        {getScoreStatus(score)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {isSaving ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 