'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';

interface Question {
  id: string;
  title?: string;
  text?: string;
  description?: string;
  questionType?: string;
  type?: string;
  category: string;
  options?: string[] | Array<{text: string, weight: number}>;
  weights?: number[];
  yesNoWeight?: number;
  questionWeight?: number;
  isRequired?: boolean;
  required?: boolean;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
}

export default function CreateFormPage() {
  const router = useRouter();
  const { userProfile, logout } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [clients, setCliients] = useState<Client[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'general',
    isActive: true,
    estimatedTime: 5
  });
  const [allocationData, setAllocationData] = useState({
    frequency: 'weekly',
    duration: 4,
    startDate: new Date().toISOString().split('T')[0],
    dueTime: '09:00',
    checkInWindow: {
      enabled: false,
      startDay: 'monday',
      startTime: '09:00',
      endDay: 'tuesday', 
      endTime: '12:00'
    }
  });

  const categories = [
    { value: 'general', label: 'General Check-in' },
    { value: 'mental_health', label: 'Mental Health Assessment' },
    { value: 'physical_health', label: 'Physical Health Check' },
    { value: 'relationships', label: 'Relationship Assessment' },
    { value: 'work', label: 'Work/Career Check-in' },
    { value: 'lifestyle', label: 'Lifestyle Assessment' },
    { value: 'goals', label: 'Goals & Progress Review' }
  ];

  const frequencies = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'biweekly', label: 'Bi-weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'custom', label: 'Custom' }
  ];

  const daysOfWeek = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' }
  ];

  // Fetch questions and clients from Firebase
  useEffect(() => {
    const fetchData = async () => {
      try {
        const coachId = userProfile?.uid || 'demo-coach-id';
        console.log('Fetching data for coachId:', coachId);
        
        // Fetch questions
        const questionsResponse = await fetch(`/api/questions?coachId=${coachId}`);
        if (questionsResponse.ok) {
          const questionsData = await questionsResponse.json();
          if (questionsData.success) {
            console.log('Fetched questions:', questionsData.questions.length);
            setQuestions(questionsData.questions || []);
          }
        }

        // Fetch clients
        const clientsResponse = await fetch(`/api/clients?coachId=${coachId}`);
        if (clientsResponse.ok) {
          const clientsData = await clientsResponse.json();
          if (clientsData.success) {
            console.log('Fetched clients:', clientsData.clients.length);
            setCliients(clientsData.clients || []);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [userProfile?.uid]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAllocationChange = (field: string, value: any) => {
    setAllocationData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCheckInWindowChange = (field: string, value: any) => {
    setAllocationData(prev => ({
      ...prev,
      checkInWindow: {
        ...prev.checkInWindow,
        [field]: value
      }
    }));
  };

  const toggleQuestionSelection = (questionId: string) => {
    setSelectedQuestions(prev => {
      const newSelection = prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId];
      return newSelection;
    });
  };

  const toggleClientSelection = (clientId: string) => {
    setSelectedClients(prev => {
      const newSelection = prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId];
      return newSelection;
    });
  };

  const nextStep = () => {
    if (currentStep === 1 && (!formData.title.trim() || !formData.description.trim())) {
      alert('Please fill in all form details');
      return;
    }
    if (currentStep === 2 && selectedQuestions.length === 0) {
      alert('Please select at least one question');
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, 4));
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSaveForm = async () => {
    setIsLoading(true);

    try {
      // Create the form
      const formDataToSave = {
        ...formData,
        title: formData.title.trim(),
        description: formData.description.trim(),
        questionIds: selectedQuestions,
        totalQuestions: selectedQuestions.length,
        coachId: userProfile?.uid
      };

      const formResponse = await fetch('/api/forms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formDataToSave)
      });

      if (!formResponse.ok) {
        throw new Error('Failed to create form');
      }

      const responseData = await formResponse.json();
      const formId = responseData.formId;

      console.log('Form created successfully with ID:', formId);
      
      // Redirect to forms page with success message
      router.push('/forms?success=true&formId=' + formId);
    } catch (error) {
      console.error('Error creating form:', error);
      alert('Error creating form. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAndAllocate = async () => {
    setIsLoading(true);

    try {
      // Step 1: Create the form
      const formDataToSave = {
        ...formData,
        title: formData.title.trim(),
        description: formData.description.trim(),
        questionIds: selectedQuestions,
        totalQuestions: selectedQuestions.length,
        coachId: userProfile?.uid
      };

      const formResponse = await fetch('/api/forms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formDataToSave)
      });

      if (!formResponse.ok) {
        throw new Error('Failed to create form');
      }

      const responseData = await formResponse.json();
      const formId = responseData.formId;

      // Step 2: Allocate form to selected clients (if any)
      if (selectedClients.length > 0) {
        const allocationPromises = selectedClients.map(clientId => 
          fetch('/api/check-in-assignments', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              formId: formId,
              clientId: clientId,
              coachId: userProfile?.uid,
              frequency: allocationData.frequency,
              duration: allocationData.duration,
              startDate: allocationData.startDate,
              dueTime: allocationData.dueTime,
              checkInWindow: allocationData.checkInWindow,
              status: 'pending'
            })
          })
        );

        await Promise.all(allocationPromises);
        console.log('Form created and allocated to', selectedClients.length, 'clients');
      } else {
        console.log('Form created successfully (no clients allocated)');
      }

      router.push('/forms?success=true&formId=' + formId);
    } catch (error) {
      console.error('Error creating form:', error);
      alert('Error creating form. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getQuestionTypeLabel = (type: string) => {
    const typeMap: { [key: string]: string } = {
      'multiple_choice': 'Multiple Choice',
      'multiselect': 'Multiple Choice',
      'scale': 'Scale (1-10)',
      'text': 'Text Input',
      'boolean': 'Yes/No',
      'rating': 'Rating (1-5)',
      'select': 'Single Choice',
      'textarea': 'Long Text',
      'number': 'Number',
      'date': 'Date',
      'time': 'Time'
    };
    return typeMap[type] || type;
  };

  const getCategoryLabel = (category: string) => {
    const categoryMap: { [key: string]: string } = {
      'general': 'General',
      'mental_health': 'Mental Health',
      'physical_health': 'Physical Health',
      'relationships': 'Relationships',
      'work': 'Work/Career',
      'lifestyle': 'Lifestyle',
      'goals': 'Goals & Progress'
    };
    return categoryMap[category] || category;
  };

  const getQuestionTitle = (question: Question) => {
    return question.title || question.text || 'Untitled Question';
  };

  const getQuestionType = (question: Question) => {
    return question.questionType || question.type || 'text';
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3, 4].map((step) => (
        <div key={step} className="flex items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
            step <= currentStep 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-600'
          }`}>
            {step}
          </div>
          {step < 4 && (
            <div className={`w-16 h-1 mx-2 ${
              step < currentStep ? 'bg-blue-600' : 'bg-gray-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 1: Form Details</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Form Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter form title..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe what this form is for..."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                >
                  {categories.map(category => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Time (minutes)
                </label>
                <input
                  type="number"
                  value={formData.estimatedTime}
                  onChange={(e) => handleInputChange('estimatedTime', parseInt(e.target.value))}
                  min="1"
                  max="60"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Step 2: Select Questions</h2>
              <Link
                href="/questions/create"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                + Create New Question
              </Link>
            </div>

            {questions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No questions available</h3>
                <p className="text-gray-500 mb-6">Create some questions first to build your form.</p>
                <Link
                  href="/questions/create"
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Create Question
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((question) => (
                  <div
                    key={question.id}
                    className={`border-2 rounded-xl p-4 cursor-pointer transition-all duration-200 ${
                      selectedQuestions.includes(question.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => toggleQuestionSelection(question.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded">
                            {getQuestionTypeLabel(getQuestionType(question))}
                          </span>
                          <span className="text-sm text-gray-500">
                            {getCategoryLabel(question.category)}
                          </span>
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {getQuestionTitle(question)}
                        </h3>
                        {question.description && (
                          <p className="text-sm text-gray-600">{question.description}</p>
                        )}
                      </div>
                      <div className="ml-4">
                        <input
                          type="checkbox"
                          checked={selectedQuestions.includes(question.id)}
                          onChange={() => toggleQuestionSelection(question.id)}
                          className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedQuestions.length > 0 && (
              <div className="mt-6 p-4 bg-blue-50 rounded-xl">
                <p className="text-sm text-blue-800">
                  <strong>{selectedQuestions.length}</strong> question{selectedQuestions.length !== 1 ? 's' : ''} selected
                </p>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 3: Form Preview</h2>
            
            <div className="space-y-6">
              <div className="border-b border-gray-200 pb-4">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{formData.title}</h3>
                <p className="text-gray-600 mb-2">{formData.description}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>Category: {getCategoryLabel(formData.category)}</span>
                  <span>Estimated time: {formData.estimatedTime} minutes</span>
                  <span>Questions: {selectedQuestions.length}</span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-4">Selected Questions:</h4>
                <div className="space-y-3">
                  {selectedQuestions.map((questionId, index) => {
                    const question = questions.find(q => q.id === questionId);
                    if (!question) return null;
                    
                    return (
                      <div key={questionId} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm font-medium text-gray-500 w-8">#{index + 1}</span>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{getQuestionTitle(question)}</p>
                          <p className="text-sm text-gray-600">
                            {getQuestionTypeLabel(getQuestionType(question))} • {getCategoryLabel(question.category)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 4: Allocate to Clients (Optional)</h2>
            <p className="text-gray-600 mb-6">You can save your form now and allocate it to clients later, or allocate it immediately.</p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Client Selection */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Clients</h3>
                
                {clients.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-xl">
                    <p className="text-gray-500 mb-4">No clients available</p>
                    <Link
                      href="/clients/create"
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      Add Client
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {clients.map((client) => (
                      <div
                        key={client.id}
                        className={`flex items-center p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                          selectedClients.includes(client.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => toggleClientSelection(client.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedClients.includes(client.id)}
                          onChange={() => toggleClientSelection(client.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-3"
                        />
                        <div>
                          <p className="font-medium text-gray-900">
                            {client.firstName} {client.lastName}
                          </p>
                          <p className="text-sm text-gray-600">{client.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Schedule Settings */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Schedule Settings</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Frequency
                    </label>
                    <select
                      value={allocationData.frequency}
                      onChange={(e) => handleAllocationChange('frequency', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    >
                      {frequencies.map(freq => (
                        <option key={freq.value} value={freq.value}>
                          {freq.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Duration (weeks)
                    </label>
                    <input
                      type="number"
                      value={allocationData.duration}
                      onChange={(e) => handleAllocationChange('duration', parseInt(e.target.value))}
                      min="1"
                      max="52"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={allocationData.startDate}
                      onChange={(e) => handleAllocationChange('startDate', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Due Time
                    </label>
                    <input
                      type="time"
                      value={allocationData.dueTime}
                      onChange={(e) => handleAllocationChange('dueTime', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    />
                  </div>

                  {/* Check-in Window Settings */}
                  <div className="border-t border-gray-200 pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-md font-semibold text-gray-900">Check-in Window</h4>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={allocationData.checkInWindow.enabled}
                          onChange={(e) => handleCheckInWindowChange('enabled', e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Enable time window</span>
                      </label>
                    </div>

                    {allocationData.checkInWindow.enabled && (
                      <div className="space-y-4 bg-gray-50 p-4 rounded-xl">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Start Day
                            </label>
                            <select
                              value={allocationData.checkInWindow.startDay}
                              onChange={(e) => handleCheckInWindowChange('startDay', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              {daysOfWeek.map(day => (
                                <option key={day.value} value={day.value}>
                                  {day.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Start Time
                            </label>
                            <input
                              type="time"
                              value={allocationData.checkInWindow.startTime}
                              onChange={(e) => handleCheckInWindowChange('startTime', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              End Day
                            </label>
                            <select
                              value={allocationData.checkInWindow.endDay}
                              onChange={(e) => handleCheckInWindowChange('endDay', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              {daysOfWeek.map(day => (
                                <option key={day.value} value={day.value}>
                                  {day.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              End Time
                            </label>
                            <input
                              type="time"
                              value={allocationData.checkInWindow.endTime}
                              onChange={(e) => handleCheckInWindowChange('endTime', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                          <p className="font-medium">Check-in Window:</p>
                          <p>
                            {allocationData.checkInWindow.startDay.charAt(0).toUpperCase() + allocationData.checkInWindow.startDay.slice(1)} {allocationData.checkInWindow.startTime} to {allocationData.checkInWindow.endDay.charAt(0).toUpperCase() + allocationData.checkInWindow.endDay.slice(1)} {allocationData.checkInWindow.endTime}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {selectedClients.length > 0 && (
                  <div className="mt-6 p-4 bg-green-50 rounded-xl">
                    <p className="text-sm text-green-800">
                      <strong>{selectedClients.length}</strong> client{selectedClients.length !== 1 ? 's' : ''} selected
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <RoleProtected requiredRole="coach">
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
        {/* Navigation Sidebar */}
        <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl border-r border-gray-200 z-50">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Coach Portal</h2>
              <p className="text-sm text-gray-600">Create Form</p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2">
              <Link href="/dashboard" className="flex items-center px-4 py-3 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Dashboard
              </Link>
              
              <Link href="/clients" className="flex items-center px-4 py-3 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                My Clients
              </Link>
              
              <Link href="/forms" className="flex items-center px-4 py-3 bg-blue-50 text-blue-700 rounded-xl border-r-4 border-blue-600">
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Forms & Check-ins
              </Link>
              
              <Link href="/questions/library" className="flex items-center px-4 py-3 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Questions Library
              </Link>
            </nav>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="ml-64 p-6">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    Create New Form
                  </h1>
                  <p className="text-gray-600 mt-2 text-lg">Build and allocate check-in forms to your clients</p>
                </div>
                <Link
                  href="/forms"
                  className="inline-flex items-center px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Forms
                </Link>
              </div>

              {renderStepIndicator()}
            </div>

            {/* Step Content */}
            {renderStepContent()}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8">
              <button
                onClick={prevStep}
                disabled={currentStep === 1}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                  currentStep === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Previous
              </button>

              <div className="flex items-center gap-4">
                {currentStep < 4 ? (
                  <button
                    onClick={nextStep}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all duration-200"
                  >
                    Next
                  </button>
                ) : (
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleSaveForm}
                      disabled={isLoading}
                      className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                        isLoading
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-600 text-white hover:bg-gray-700'
                      }`}
                    >
                      {isLoading ? 'Saving...' : 'Save Form Only'}
                    </button>
                    
                    <button
                      onClick={handleSaveAndAllocate}
                      disabled={isLoading}
                      className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                        isLoading
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      {isLoading ? 'Saving...' : 'Save & Allocate'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
} 