'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';
import Link from 'next/link';

interface Goal {
  id: string;
  title: string;
  description: string;
  category: 'fitness' | 'nutrition' | 'mental-health' | 'sleep' | 'general';
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline: string;
  status: 'active' | 'completed' | 'overdue';
  progress: number;
  createdAt: string;
}

export default function ClientGoalsPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showEditGoal, setShowEditGoal] = useState(false);
  const [showUpdateProgress, setShowUpdateProgress] = useState(false);
  const [updatingGoal, setUpdatingGoal] = useState<Goal | null>(null);
  const [newProgressValue, setNewProgressValue] = useState<number>(0);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editingCurrentValue, setEditingCurrentValue] = useState<number>(0);
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [questionnaireStatus, setQuestionnaireStatus] = useState<'not_started' | 'in_progress' | 'completed' | 'submitted' | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    category: 'general' as Goal['category'],
    targetValue: 0,
    startingValue: 0,
    unit: '',
    deadline: ''
  });

  useEffect(() => {
    // Wait for auth to finish loading before trying to fetch client ID
    if (authLoading) {
      // Still loading auth, wait
      return;
    }
    
    if (userProfile?.email) {
      fetchClientId();
    } else {
      // Auth finished but no user profile - user might not be logged in
      setLoading(false);
    }
  }, [userProfile?.email, authLoading]);

  useEffect(() => {
    if (clientId) {
      fetchGoals();
      fetchQuestionnaireStatus();
    }
  }, [clientId]);

  const fetchQuestionnaireStatus = async () => {
    try {
      if (!clientId) return;
      const response = await fetch(`/api/client-portal/goals-questionnaire?clientId=${clientId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setQuestionnaireStatus(data.data.status || 'not_started');
        }
      }
    } catch (error) {
      console.error('Error fetching questionnaire status:', error);
    }
  };

  const fetchClientId = async () => {
    try {
      if (!userProfile?.email) {
        // Don't log as error - this is expected if userProfile is still loading
        setLoading(false);
        return;
      }

      // Fetch client ID from clients collection using email
      const response = await fetch(`/api/client-portal?clientEmail=${userProfile.email}`);
      const result = await response.json();

      if (result.success && result.data.client) {
        setClientId(result.data.client.id);
      } else {
        console.warn('Failed to fetch client ID:', result.message);
        setLoading(false);
      }
    } catch (error) {
      console.warn('Error fetching client ID:', error);
      setLoading(false);
    }
  };

  const fetchGoals = async () => {
    try {
      if (!clientId) {
        console.error('No client ID available');
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/client-portal/goals?clientId=${clientId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setGoals(data.goals);
        }
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!clientId) {
        alert('Error: No client ID available. Please refresh the page and try again.');
        return;
      }

      // Validate required fields
      if (!newGoal.title || !newGoal.unit || !newGoal.deadline) {
        alert('Please fill in all required fields (Title, Unit, and Deadline).');
        return;
      }

      if (!newGoal.targetValue || newGoal.targetValue <= 0 || isNaN(newGoal.targetValue)) {
        alert('Target Value must be greater than 0.');
        return;
      }

      // Set initial currentValue from startingValue if provided, otherwise 0
      const goalData = {
        clientId,
        title: newGoal.title,
        description: newGoal.description,
        category: newGoal.category,
        targetValue: newGoal.targetValue,
        currentValue: newGoal.startingValue || 0, // Use startingValue as currentValue
        unit: newGoal.unit,
        deadline: newGoal.deadline
      };
      
      console.log('Submitting goal:', goalData);

      const response = await fetch('/api/client-portal/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(goalData),
      });

      const data = await response.json();
      
      console.log('Goal API response:', { status: response.status, data });

      if (response.ok && data.success) {
        // Success - close modal, reset form, and refresh goals
        setShowAddGoal(false);
        setNewGoal({
          title: '',
          description: '',
          category: 'general',
          targetValue: 0,
          startingValue: 0,
          unit: '',
          deadline: ''
        });
        // Refresh goals list to show the new goal
        await fetchGoals();
        console.log('Goal created successfully with ID:', data.goalId);
      } else {
        // Error - show user-friendly message
        const errorMsg = data.message || data.error || 'Unknown error';
        alert(`Failed to create goal: ${errorMsg}\n\nPlease check that all fields are filled correctly and try again.`);
        console.error('Failed to create goal:', { response: response.status, data });
      }
    } catch (error) {
      console.error('Error adding goal:', error);
      alert('An error occurred while creating the goal. Please try again.');
    }
  };

  const handleEditGoal = (goal: Goal) => {
    // Set editing goal and populate form
    setEditingGoal(goal);
    setEditingCurrentValue(goal.currentValue);
    // Format deadline for date input (YYYY-MM-DD)
    const deadlineDate = new Date(goal.deadline).toISOString().split('T')[0];
    setNewGoal({
      title: goal.title,
      description: goal.description,
      category: goal.category,
      targetValue: goal.targetValue,
      startingValue: goal.currentValue || 0,
      unit: goal.unit,
      deadline: deadlineDate
    });
    setShowEditGoal(true);
  };

  const handleUpdateProgress = (goal: Goal) => {
    setUpdatingGoal(goal);
    setNewProgressValue(goal.currentValue);
    setShowUpdateProgress(true);
  };

  const handleDeleteGoal = (goal: Goal) => {
    setDeletingGoal(goal);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteGoal = async () => {
    if (!deletingGoal) return;

    try {
      const response = await fetch(`/api/client-portal/goals?goalId=${deletingGoal.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Close modal and refresh goals
        setShowDeleteConfirm(false);
        setDeletingGoal(null);
        // Refresh goals list
        await fetchGoals();
        console.log('Goal deleted successfully');
      } else {
        const errorMsg = data.message || data.error || 'Unknown error';
        alert(`Failed to delete goal: ${errorMsg}`);
        console.error('Failed to delete goal:', { response: response.status, data });
      }
    } catch (error) {
      console.error('Error deleting goal:', error);
      alert('An error occurred while deleting the goal. Please try again.');
    }
  };

  const handleSubmitProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!updatingGoal) {
        alert('Error: No goal selected for updating.');
        return;
      }

      if (newProgressValue < 0) {
        alert('Progress value cannot be negative.');
        return;
      }

      const goalData = {
        goalId: updatingGoal.id,
        title: updatingGoal.title,
        description: updatingGoal.description,
        category: updatingGoal.category,
        targetValue: updatingGoal.targetValue,
        unit: updatingGoal.unit,
        deadline: updatingGoal.deadline,
        currentValue: newProgressValue
      };
      
      console.log('Updating progress:', goalData);

      const response = await fetch('/api/client-portal/goals', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(goalData),
      });

      const data = await response.json();
      
      console.log('Progress update API response:', { status: response.status, data });

      if (response.ok && data.success) {
        // Success - close modal and refresh goals
        setShowUpdateProgress(false);
        setUpdatingGoal(null);
        setNewProgressValue(0);
        // Refresh goals list to show the updated progress
        await fetchGoals();
        console.log('Progress updated successfully');
      } else {
        // Error - show user-friendly message
        const errorMsg = data.message || data.error || 'Unknown error';
        alert(`Failed to update progress: ${errorMsg}`);
        console.error('Failed to update progress:', { response: response.status, data });
      }
    } catch (error) {
      console.error('Error updating progress:', error);
      alert('An error occurred while updating progress. Please try again.');
    }
  };

  const handleUpdateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!editingGoal) {
        alert('Error: No goal selected for editing.');
        return;
      }

      // Validate required fields
      if (!newGoal.title || !newGoal.unit || !newGoal.deadline) {
        alert('Please fill in all required fields (Title, Unit, and Deadline).');
        return;
      }

      if (!newGoal.targetValue || newGoal.targetValue <= 0 || isNaN(newGoal.targetValue)) {
        alert('Target Value must be greater than 0.');
        return;
      }

      const goalData = {
        goalId: editingGoal.id,
        ...newGoal,
        currentValue: editingCurrentValue // Use the edited current value
      };
      
      console.log('Updating goal:', goalData);

      const response = await fetch('/api/client-portal/goals', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(goalData),
      });

      const data = await response.json();
      
      console.log('Goal update API response:', { status: response.status, data });

      if (response.ok && data.success) {
        // Success - close modal, reset form, and refresh goals
        setShowEditGoal(false);
        setEditingGoal(null);
        setNewGoal({
          title: '',
          description: '',
          category: 'general',
          targetValue: 0,
          startingValue: 0,
          unit: '',
          deadline: ''
        });
        // Refresh goals list to show the updated goal
        await fetchGoals();
        console.log('Goal updated successfully with ID:', data.goalId);
      } else {
        // Error - show user-friendly message
        const errorMsg = data.message || data.error || 'Unknown error';
        alert(`Failed to update goal: ${errorMsg}\n\nPlease check that all fields are filled correctly and try again.`);
        console.error('Failed to update goal:', { response: response.status, data });
      }
    } catch (error) {
      console.error('Error updating goal:', error);
      alert('An error occurred while updating the goal. Please try again.');
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'fitness': return '💪';
      case 'nutrition': return '🥗';
      case 'mental-health': return '🧠';
      case 'sleep': return '😴';
      default: return '🎯';
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const activeGoals = goals.filter(goal => goal.status === 'active');
  const completedGoals = goals.filter(goal => goal.status === 'completed');
  const overdueGoals = goals.filter(goal => goal.status === 'overdue');

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-white flex">
        <ClientNavigation />
        
        <div className="flex-1 ml-4 lg:ml-8 p-5 lg:p-6">
          {/* Header */}
          <div className="mb-6 lg:mb-8">
            <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 border-b-2 mb-4 rounded-t-2xl lg:rounded-t-3xl" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">My Goals</h1>
                  <p className="text-gray-600 text-sm lg:text-base">Set and track your wellness goals</p>
                </div>
                <button
                  onClick={() => setShowAddGoal(true)}
                  className="px-5 py-3 lg:px-6 lg:py-2.5 rounded-xl lg:rounded-lg text-white font-semibold transition-all duration-200 shadow-sm hover:shadow-md min-h-[48px] lg:min-h-[44px] flex items-center justify-center"
                  style={{ backgroundColor: '#daa450' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c89540'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#daa450'}
                >
                  + Add New Goal
                </button>
              </div>
            </div>

            {/* Goals Questionnaire Banner */}
            {questionnaireStatus !== 'submitted' && questionnaireStatus !== 'completed' && questionnaireStatus !== null && (
              <div className="mb-6 bg-gradient-to-r from-[#daa450] to-[#c89540] rounded-2xl lg:rounded-3xl shadow-lg p-6 text-white">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-2">🎯 Set Your 2026 Goals</h3>
                    <p className="text-white/90 mb-1">Take our quick questionnaire to help us create personalized goals based on your vision for 2026.</p>
                    <p className="text-sm text-white/80">Your coach will see your responses and can better support your journey.</p>
                  </div>
                  <Link
                    href="/client-portal/goals/questionnaire"
                    className="px-6 py-3 bg-white text-[#daa450] rounded-xl lg:rounded-lg font-semibold transition-all duration-200 shadow-sm hover:shadow-md hover:bg-gray-50 whitespace-nowrap min-h-[48px] flex items-center justify-center"
                  >
                    Start Questionnaire →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
            <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 lg:p-6">
              <div className="flex items-center">
                <div className="p-2.5 lg:p-3 rounded-xl lg:rounded-lg flex-shrink-0" style={{ backgroundColor: '#daa450' }}>
                  <svg className="w-6 h-6 lg:w-5 lg:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3 lg:ml-4 min-w-0">
                  <p className="text-xs lg:text-sm font-medium text-gray-600 truncate">Total Goals</p>
                  <p className="text-xl lg:text-2xl font-bold text-gray-900">{goals.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 lg:p-6">
              <div className="flex items-center">
                <div className="p-2.5 lg:p-3 rounded-xl lg:rounded-lg flex-shrink-0" style={{ backgroundColor: '#daa450' }}>
                  <svg className="w-6 h-6 lg:w-5 lg:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3 lg:ml-4 min-w-0">
                  <p className="text-xs lg:text-sm font-medium text-gray-600 truncate">Active Goals</p>
                  <p className="text-xl lg:text-2xl font-bold text-gray-900">{activeGoals.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 lg:p-6">
              <div className="flex items-center">
                <div className="p-2.5 lg:p-3 rounded-xl lg:rounded-lg flex-shrink-0" style={{ backgroundColor: '#daa450' }}>
                  <svg className="w-6 h-6 lg:w-5 lg:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3 lg:ml-4 min-w-0">
                  <p className="text-xs lg:text-sm font-medium text-gray-600 truncate">Completed</p>
                  <p className="text-xl lg:text-2xl font-bold text-gray-900">{completedGoals.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-4 lg:p-6">
              <div className="flex items-center">
                <div className="p-2.5 lg:p-3 rounded-xl lg:rounded-lg flex-shrink-0" style={{ backgroundColor: '#daa450' }}>
                  <svg className="w-6 h-6 lg:w-5 lg:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="ml-3 lg:ml-4 min-w-0">
                  <p className="text-xs lg:text-sm font-medium text-gray-600 truncate">Overdue</p>
                  <p className="text-xl lg:text-2xl font-bold text-gray-900">{overdueGoals.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Goals List */}
          <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 overflow-hidden">
            <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 border-b-2" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
              <h2 className="text-xl lg:text-2xl font-bold text-gray-900">Your Goals</h2>
              <p className="text-gray-600 text-sm lg:text-base mt-1">Track your progress towards achieving your wellness goals</p>
            </div>

            {(loading || authLoading) ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderBottomColor: '#daa450' }}></div>
                <p className="mt-4 text-gray-600">Loading your goals...</p>
              </div>
            ) : goals.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-6xl mb-4">🎯</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No goals set yet</h3>
                <p className="text-gray-600 mb-6">Start by setting your first wellness goal to track your progress.</p>
                <button
                  onClick={() => setShowAddGoal(true)}
                  className="px-6 py-3 rounded-xl lg:rounded-lg text-white font-semibold transition-all duration-200 shadow-sm hover:shadow-md min-h-[48px] flex items-center justify-center mx-auto"
                  style={{ backgroundColor: '#daa450' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c89540'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#daa450'}
                >
                  Set Your First Goal
                </button>
              </div>
            ) : (
              <div className="p-5 lg:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                  {goals.map((goal) => (
                    <div key={goal.id} className="bg-gray-50 rounded-xl lg:rounded-2xl p-5 lg:p-6 border border-gray-200 hover:shadow-lg transition-all duration-200">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{getCategoryIcon(goal.category)}</span>
                          <div>
                            <h3 className="font-semibold text-gray-900 text-base lg:text-lg">{goal.title}</h3>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getCategoryColor(goal.category)} mt-1 inline-block`}>
                              {goal.category.replace('-', ' ')}
                            </span>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(goal.status)} flex-shrink-0`}>
                          {goal.status}
                        </span>
                      </div>

                      {goal.description && (
                        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{goal.description}</p>
                      )}

                      <div className="mb-4">
                        <div className="flex justify-between text-sm text-gray-600 mb-1">
                          <span>Progress</span>
                          <span className="font-medium">{goal.currentValue} / {goal.targetValue} {goal.unit}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                          <div 
                            className="h-2.5 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${Math.min(goal.progress || 0, 100)}%`,
                              backgroundColor: '#daa450'
                            }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-700">{Math.round(goal.progress || 0)}% complete</p>
                      </div>

                      <div className="text-xs text-gray-700 mb-4">
                        Deadline: {formatDate(goal.deadline)}
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col gap-2">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <button 
                            onClick={() => handleUpdateProgress(goal)}
                            className="flex-1 px-3 py-2.5 rounded-xl lg:rounded-lg text-white font-semibold transition-all duration-200 shadow-sm hover:shadow-md min-h-[44px] flex items-center justify-center text-sm"
                            style={{ backgroundColor: '#daa450' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c89540'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#daa450'}
                          >
                            Update Progress
                          </button>
                          <button 
                            onClick={() => handleEditGoal(goal)}
                            className="px-4 py-2.5 bg-gray-200 text-gray-700 rounded-xl lg:rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium min-h-[44px] flex items-center justify-center"
                          >
                            Edit
                          </button>
                        </div>
                        <button 
                          onClick={() => handleDeleteGoal(goal)}
                          className="w-full px-4 py-2.5 bg-red-50 text-red-700 rounded-xl lg:rounded-lg hover:bg-red-100 transition-colors text-sm font-medium min-h-[44px] flex items-center justify-center border border-red-200"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete Goal
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Add Goal Modal */}
        {showAddGoal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Add New Goal</h3>
                  <button
                    onClick={() => {
                      setShowAddGoal(false);
                      setNewGoal({
                        title: '',
                        description: '',
                        category: 'general',
                        targetValue: 0,
                        unit: '',
                        deadline: ''
                      });
                    }}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddGoal} className="px-6 py-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Goal Title
                    </label>
                    <input
                      type="text"
                      required
                      value={newGoal.title}
                      onChange={(e) => setNewGoal({...newGoal, title: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Run 5km"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={newGoal.description}
                      onChange={(e) => setNewGoal({...newGoal, description: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="Describe your goal..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      value={newGoal.category}
                      onChange={(e) => setNewGoal({...newGoal, category: e.target.value as Goal['category']})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="general">General Wellness</option>
                      <option value="fitness">Fitness</option>
                      <option value="nutrition">Nutrition</option>
                      <option value="mental-health">Mental Health</option>
                      <option value="sleep">Sleep</option>
                    </select>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-blue-800 font-medium mb-1">💡 How to set your goal:</p>
                    <ul className="text-xs text-blue-700 list-disc list-inside space-y-1">
                      <li><strong>For weight loss:</strong> Enter your goal weight (e.g., if you're 80kg and want to lose 10kg, enter 70kg as the target)</li>
                      <li><strong>For weight gain/other goals:</strong> Enter the final value you want to reach (e.g., gain 5kg to reach 75kg)</li>
                      <li><strong>Starting value</strong> is optional - you can update it later when tracking progress</li>
                    </ul>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Starting Value <span className="text-gray-500 font-normal">(Optional - Your current measurement)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={newGoal.startingValue > 0 ? newGoal.startingValue : ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewGoal({...newGoal, startingValue: value ? Number(value) : 0});
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1"
                      placeholder="e.g., 80 (your current weight/measurement)"
                    />
                    <p className="text-xs text-gray-500">
                      For weight loss: Enter your current weight (e.g., 80kg). You can leave this blank and update it later.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Target Value <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min="0.01"
                        step="any"
                        value={newGoal.targetValue > 0 ? newGoal.targetValue : ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setNewGoal({...newGoal, targetValue: value ? Number(value) : 0});
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1"
                        placeholder="e.g., 70"
                      />
                      <p className="text-xs text-gray-500">
                        {newGoal.title.toLowerCase().includes('loss') || newGoal.title.toLowerCase().includes('lose')
                          ? 'Your goal weight (e.g., 70kg). The system will track your progress toward this target.'
                          : 'The final value you want to reach (e.g., 75kg, 100km, etc.)'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unit <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newGoal.unit}
                        onChange={(e) => setNewGoal({...newGoal, unit: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-1"
                        placeholder="e.g., kg, km, days"
                      />
                      <p className="text-xs text-gray-500">
                        Measurement unit (kg, lbs, km, etc.)
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Deadline <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={newGoal.deadline}
                      onChange={(e) => setNewGoal({...newGoal, deadline: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddGoal(false);
                      setNewGoal({
                        title: '',
                        description: '',
                        category: 'general',
                        targetValue: 0,
                        unit: '',
                        deadline: ''
                      });
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 rounded-xl lg:rounded-lg text-white font-semibold transition-all duration-200 shadow-sm hover:shadow-md min-h-[44px] flex items-center justify-center"
                    style={{ backgroundColor: '#daa450' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c89540'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#daa450'}
                  >
                    Add Goal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Goal Modal */}
        {showEditGoal && editingGoal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Edit Goal</h3>
                  <button
                    onClick={() => {
                      setShowEditGoal(false);
                      setEditingGoal(null);
                      setEditingCurrentValue(0);
                      setNewGoal({
                        title: '',
                        description: '',
                        category: 'general',
                        targetValue: 0,
                        unit: '',
                        deadline: ''
                      });
                    }}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form onSubmit={handleUpdateGoal} className="px-6 py-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Goal Title
                    </label>
                    <input
                      type="text"
                      required
                      value={newGoal.title}
                      onChange={(e) => setNewGoal({...newGoal, title: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Run 5km"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={newGoal.description}
                      onChange={(e) => setNewGoal({...newGoal, description: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      placeholder="Describe your goal..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      value={newGoal.category}
                      onChange={(e) => setNewGoal({...newGoal, category: e.target.value as Goal['category']})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="general">General Wellness</option>
                      <option value="fitness">Fitness</option>
                      <option value="nutrition">Nutrition</option>
                      <option value="mental-health">Mental Health</option>
                      <option value="sleep">Sleep</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Target Value
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        step="any"
                        value={newGoal.targetValue > 0 ? newGoal.targetValue : ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setNewGoal({...newGoal, targetValue: value ? Number(value) : 0});
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter target value"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unit
                      </label>
                      <input
                        type="text"
                        required
                        value={newGoal.unit}
                        onChange={(e) => setNewGoal({...newGoal, unit: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., km, kg, days"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Current Progress
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editingCurrentValue}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditingCurrentValue(value ? Number(value) : 0);
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Current progress"
                    />
                    <p className="text-xs text-gray-500 mt-1">Current progress: {editingCurrentValue} / {newGoal.targetValue} {newGoal.unit}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Deadline
                    </label>
                    <input
                      type="date"
                      required
                      value={newGoal.deadline}
                      onChange={(e) => setNewGoal({...newGoal, deadline: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditGoal(false);
                      setEditingGoal(null);
                      setEditingCurrentValue(0);
                      setNewGoal({
                        title: '',
                        description: '',
                        category: 'general',
                        targetValue: 0,
                        unit: '',
                        deadline: ''
                      });
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 rounded-xl lg:rounded-lg text-white font-semibold transition-all duration-200 shadow-sm hover:shadow-md min-h-[44px] flex items-center justify-center"
                    style={{ backgroundColor: '#daa450' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c89540'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#daa450'}
                  >
                    Update Goal
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Update Progress Modal */}
        {showUpdateProgress && updatingGoal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Update Progress</h3>
                  <button
                    onClick={() => {
                      setShowUpdateProgress(false);
                      setUpdatingGoal(null);
                      setNewProgressValue(0);
                    }}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmitProgress} className="px-6 py-4">
                <div className="mb-4">
                  <h4 className="text-base font-semibold text-gray-900 mb-2">{updatingGoal.title}</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Target: {updatingGoal.targetValue} {updatingGoal.unit}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Progress ({updatingGoal.unit})
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="any"
                      value={newProgressValue > 0 ? newProgressValue : ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewProgressValue(value ? Number(value) : 0);
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                      placeholder="Enter current progress"
                    />
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Progress</span>
                      <span className="font-medium">
                        {newProgressValue} / {updatingGoal.targetValue} {updatingGoal.unit}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                      <div 
                        className="h-3 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${Math.min((newProgressValue / updatingGoal.targetValue) * 100, 100)}%`,
                          backgroundColor: '#daa450'
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-700 text-center">
                      {Math.round((newProgressValue / updatingGoal.targetValue) * 100)}% complete
                    </p>
                  </div>
                </div>

                <div className="flex space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUpdateProgress(false);
                      setUpdatingGoal(null);
                      setNewProgressValue(0);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 rounded-xl lg:rounded-lg text-white font-semibold transition-all duration-200 shadow-sm hover:shadow-md min-h-[44px] flex items-center justify-center"
                    style={{ backgroundColor: '#daa450' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c89540'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#daa450'}
                  >
                    Update Progress
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && deletingGoal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Delete Goal</h3>
              </div>

              <div className="px-6 py-4">
                <p className="text-gray-700 mb-4">
                  Are you sure you want to delete the goal <strong>"{deletingGoal.title}"</strong>?
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  This action cannot be undone. All progress data for this goal will be permanently deleted.
                </p>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 flex space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingGoal(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteGoal}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Delete Goal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleProtected>
  );
} 
