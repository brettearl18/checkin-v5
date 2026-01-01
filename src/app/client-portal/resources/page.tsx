'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';

interface Resource {
  id: string;
  title: string;
  description: string;
  category: 'fitness' | 'nutrition' | 'mental-health' | 'sleep' | 'general';
  type: 'article' | 'video' | 'pdf' | 'link';
  url: string;
  thumbnail?: string;
  duration?: string;
  tags: string[];
  createdAt: string;
}

export default function ClientResourcesPage() {
  const { userProfile } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (userProfile?.uid) {
      fetchResources();
    }
  }, [userProfile?.uid]);

  const fetchResources = async () => {
    try {
      const clientId = userProfile?.uid;
      if (!clientId) {
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/client-portal/resources?clientId=${clientId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.resources) {
          setResources(data.resources);
          console.log('Resources fetched:', data.resources.length);
        } else {
          console.warn('Resources API returned success:false:', data.message);
          setResources([]);
        }
      } else {
        console.error('Resources API returned error status:', response.status);
        setResources([]);
      }
    } catch (error) {
      console.error('Error fetching resources:', error);
      setResources([]);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'fitness': return '💪';
      case 'nutrition': return '🥗';
      case 'mental-health': return '🧠';
      case 'sleep': return '😴';
      default: return '📚';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'fitness': return 'bg-blue-100 text-blue-800';
      case 'nutrition': return 'bg-green-100 text-green-800';
      case 'mental-health': return 'bg-purple-100 text-purple-800';
      case 'sleep': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'video': return '🎥';
      case 'pdf': return '📄';
      case 'link': return '🔗';
      default: return '📖';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredResources = resources.filter(resource => {
    const matchesCategory = selectedCategory === 'all' || resource.category === selectedCategory;
    const matchesSearch = resource.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         resource.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         resource.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const categories = [
    { id: 'all', name: 'All Resources', icon: '📚' },
    { id: 'fitness', name: 'Fitness', icon: '💪' },
    { id: 'nutrition', name: 'Nutrition', icon: '🥗' },
    { id: 'mental-health', name: 'Mental Health', icon: '🧠' },
    { id: 'sleep', name: 'Sleep', icon: '😴' },
    { id: 'general', name: 'General', icon: '📖' }
  ];

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-white flex">
        <ClientNavigation />
        
        <div className="flex-1 ml-4 lg:ml-8 p-5 lg:p-6">
          {/* Header */}
          <div className="mb-6 lg:mb-8">
            <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 border-b-2 mb-4 rounded-t-2xl lg:rounded-t-3xl" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Wellness Resources</h1>
              <p className="text-gray-600 text-sm lg:text-base">Access educational content and tools to support your wellness journey</p>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mb-6 lg:mb-8">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search resources..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 lg:py-2.5 border border-gray-300 rounded-xl lg:rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-all"
                    style={{ focusRingColor: '#daa450' }}
                    onFocus={(e) => e.target.style.borderColor = '#daa450'}
                    onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Category Filter */}
              <div className="flex flex-wrap gap-2 lg:gap-2 overflow-x-auto pb-2 lg:pb-0">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`flex items-center space-x-2 px-5 py-3 lg:px-4 lg:py-2 rounded-xl lg:rounded-lg font-semibold whitespace-nowrap transition-all duration-200 min-h-[48px] lg:min-h-[44px] ${
                      selectedCategory === category.id
                        ? 'text-white shadow-md'
                        : 'bg-white text-gray-900 hover:bg-gray-50 border border-gray-200'
                    }`}
                    style={selectedCategory === category.id ? { backgroundColor: '#daa450' } : {}}
                  >
                    <span className="text-base lg:text-sm">{category.icon}</span>
                    <span className="text-base lg:text-sm">{category.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Stats Cards - Coming Soon */}
          <div className="relative mb-6 lg:mb-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 opacity-30">
              <div className="bg-white rounded-xl lg:rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-3 lg:p-4">
                <div className="flex items-center">
                  <div className="p-2 lg:p-2.5 rounded-lg flex-shrink-0" style={{ backgroundColor: '#daa450' }}>
                    <svg className="w-5 h-5 lg:w-4 lg:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div className="ml-2 lg:ml-3 min-w-0">
                    <p className="text-[10px] lg:text-xs font-medium text-gray-600 truncate">Total Resources</p>
                    <p className="text-lg lg:text-xl font-bold text-gray-900">{resources.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl lg:rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-3 lg:p-4">
                <div className="flex items-center">
                  <div className="p-2 lg:p-2.5 rounded-lg flex-shrink-0" style={{ backgroundColor: '#daa450' }}>
                    <svg className="w-5 h-5 lg:w-4 lg:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="ml-2 lg:ml-3 min-w-0">
                    <p className="text-[10px] lg:text-xs font-medium text-gray-600 truncate">Videos</p>
                    <p className="text-lg lg:text-xl font-bold text-gray-900">
                      {resources.filter(r => r.type === 'video').length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl lg:rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-3 lg:p-4">
                <div className="flex items-center">
                  <div className="p-2 lg:p-2.5 rounded-lg flex-shrink-0" style={{ backgroundColor: '#daa450' }}>
                    <svg className="w-5 h-5 lg:w-4 lg:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <div className="ml-2 lg:ml-3 min-w-0">
                    <p className="text-[10px] lg:text-xs font-medium text-gray-600 truncate">Articles</p>
                    <p className="text-lg lg:text-xl font-bold text-gray-900">
                      {resources.filter(r => r.type === 'article').length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl lg:rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-3 lg:p-4">
                <div className="flex items-center">
                  <div className="p-2 lg:p-2.5 rounded-lg flex-shrink-0" style={{ backgroundColor: '#daa450' }}>
                    <svg className="w-5 h-5 lg:w-4 lg:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="ml-2 lg:ml-3 min-w-0">
                    <p className="text-[10px] lg:text-xs font-medium text-gray-600 truncate">Downloads</p>
                    <p className="text-lg lg:text-xl font-bold text-gray-900">
                      {resources.filter(r => r.type === 'pdf').length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {/* Coming Soon Notice */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white rounded-xl lg:rounded-2xl px-4 py-2 lg:px-6 lg:py-3 shadow-lg border-2" style={{ borderColor: '#daa450' }}>
                <p className="text-sm lg:text-base font-semibold" style={{ color: '#daa450' }}>
                  Coming Soon
                </p>
              </div>
            </div>
          </div>

          {/* Resources Grid */}
          <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
            <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
              <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Available Resources</h2>
              <p className="text-gray-600 text-sm lg:text-base mt-1">
                {filteredResources.length} resource{filteredResources.length !== 1 ? 's' : ''} found
              </p>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderBottomColor: '#daa450' }}></div>
                <p className="mt-4 text-gray-600">Loading resources...</p>
              </div>
            ) : filteredResources.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No resources found</h3>
                <p className="text-gray-600">
                  {searchTerm || selectedCategory !== 'all' 
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Your coach will add resources here to support your wellness journey.'
                  }
                </p>
              </div>
            ) : (
              <div className="p-5 lg:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                  {filteredResources.map((resource) => (
                    <div key={resource.id} className="bg-gray-50 rounded-xl lg:rounded-2xl p-5 lg:p-6 border border-gray-200 hover:shadow-lg transition-all duration-200">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{getCategoryIcon(resource.category)}</span>
                          <div>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getCategoryColor(resource.category)}`}>
                              {resource.category.replace('-', ' ')}
                            </span>
                          </div>
                        </div>
                        <span className="text-xl">{getTypeIcon(resource.type)}</span>
                      </div>

                      <h3 className="font-semibold text-gray-900 mb-2 text-base lg:text-lg">{resource.title}</h3>
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{resource.description}</p>

                      {resource.duration && (
                        <p className="text-xs text-gray-500 mb-3">
                          Duration: {resource.duration}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {resource.tags.slice(0, 3).map((tag, index) => (
                          <span
                            key={index}
                            className="px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{ backgroundColor: '#fef9e7', color: '#daa450' }}
                          >
                            {tag}
                          </span>
                        ))}
                        {resource.tags.length > 3 && (
                          <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                            +{resource.tags.length - 3} more
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                        <p className="text-xs text-gray-500">
                          Added {formatDate(resource.createdAt)}
                        </p>
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2.5 rounded-xl lg:rounded-lg text-sm font-semibold text-white transition-all duration-200 shadow-sm hover:shadow-md min-h-[44px] flex items-center justify-center"
                          style={{ backgroundColor: '#daa450' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c89540'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#daa450'}
                        >
                          {resource.type === 'video' ? 'Watch' : 
                           resource.type === 'pdf' ? 'Download' : 'View'}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Featured Resources */}
          <div className="mt-6 lg:mt-8 bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
            <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
              <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Featured Resources</h2>
              <p className="text-gray-600 text-sm lg:text-base mt-1">Hand-picked content to help you get started</p>
            </div>

            <div className="p-5 lg:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                <div className="bg-gray-50 rounded-xl lg:rounded-2xl p-5 lg:p-6 border border-gray-200">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 lg:w-10 lg:h-10 rounded-xl lg:rounded-lg flex items-center justify-center flex-shrink-0 mr-3" style={{ backgroundColor: '#daa450' }}>
                      <span className="text-2xl lg:text-xl">🎯</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-base lg:text-lg">Getting Started Guide</h3>
                      <p className="text-sm text-gray-600">Essential tips for your wellness journey</p>
                    </div>
                  </div>
                  <a
                    href="#"
                    className="inline-block px-4 py-2.5 rounded-xl lg:rounded-lg text-sm font-semibold text-white transition-all duration-200 shadow-sm hover:shadow-md min-h-[44px] flex items-center justify-center"
                    style={{ backgroundColor: '#daa450' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c89540'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#daa450'}
                  >
                    Read Guide
                  </a>
                </div>

                <div className="bg-gray-50 rounded-xl lg:rounded-2xl p-5 lg:p-6 border border-gray-200">
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 lg:w-10 lg:h-10 rounded-xl lg:rounded-lg flex items-center justify-center flex-shrink-0 mr-3" style={{ backgroundColor: '#daa450' }}>
                      <span className="text-2xl lg:text-xl">📱</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-base lg:text-lg">Mobile App Tips</h3>
                      <p className="text-sm text-gray-600">Make the most of your wellness app</p>
                    </div>
                  </div>
                  <a
                    href="#"
                    className="inline-block px-4 py-2.5 rounded-xl lg:rounded-lg text-sm font-semibold text-white transition-all duration-200 shadow-sm hover:shadow-md min-h-[44px] flex items-center justify-center"
                    style={{ backgroundColor: '#daa450' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c89540'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#daa450'}
                  >
                    View Tips
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
} 