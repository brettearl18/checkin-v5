'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

interface Form {
  id: string;
  title: string;
  description: string;
  category: string;
  questions: string[];
  estimatedTime: number;
  isActive?: boolean;
}

// Sortable Question Item Component
function SortableQuestionItem({ 
  questionId, 
  question, 
  index 
}: { 
  questionId: string; 
  question: Question; 
  index: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: questionId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getQuestionTitle = (q: Question) => q.title || q.text || 'Untitled Question';
  const getQuestionType = (q: Question) => q.type || q.questionType || 'text';
  const getQuestionTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      'text': 'Short Text',
      'textarea': 'Long Text',
      'number': 'Number',
      'select': 'Single Choice',
      'multiselect': 'Multiple Choice',
      'boolean': 'Yes/No',
      'scale': 'Scale (1-10)',
      'date': 'Date',
      'time': 'Time',
    };
    return labels[type] || type;
  };
  const getCategoryLabel = (category: string) => {
    if (!category) return 'Uncategorized';
    return category
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-3 p-3 bg-gray-50 rounded-lg border-2 transition-all ${
        isDragging ? 'border-blue-400 shadow-lg bg-blue-50' : 'border-transparent hover:border-gray-200'
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing flex items-center justify-center w-10 h-10 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded transition-colors"
        title="Drag to reorder"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </div>
      <span className="text-sm font-medium text-gray-500 w-8">#{index + 1}</span>
      <div className="flex-1">
        <p className="font-medium text-gray-900">{getQuestionTitle(question)}</p>
        <p className="text-sm text-gray-600">
          {getQuestionTypeLabel(getQuestionType(question))} • {getCategoryLabel(question.category)}
        </p>
      </div>
    </div>
  );
}

export default function EditFormPage() {
  const router = useRouter();
  const params = useParams();
  const formId = (params?.id as string) || '';
  const { userProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'general',
    isActive: true,
    estimatedTime: 5
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

  // Fetch form and questions
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!userProfile?.uid) {
          console.error('No user profile found');
          return;
        }
        const coachId = userProfile.uid;
        
        // Fetch form
        const formResponse = await fetch(`/api/forms/${formId}`);
        if (formResponse.ok) {
          const formData = await formResponse.json();
          if (formData.success && formData.form) {
            const formDataObj = formData.form;
            setForm(formDataObj);
            setFormData({
              title: formDataObj.title || '',
              description: formDataObj.description || '',
              category: formDataObj.category || 'general',
              isActive: formDataObj.isActive !== undefined ? formDataObj.isActive : true,
              estimatedTime: formDataObj.estimatedTime || 5
            });
            // Set selected questions in the order they appear in the form
            setSelectedQuestions(formDataObj.questions || []);
          }
        }

        // Fetch all questions
        const questionsResponse = await fetch(`/api/questions?coachId=${coachId}`);
        if (questionsResponse.ok) {
          const questionsData = await questionsResponse.json();
          if (questionsData.success) {
            setQuestions(questionsData.questions || []);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        alert('Error loading form. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    if (userProfile?.uid && formId) {
      fetchData();
    }
  }, [userProfile?.uid, formId]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSelectedQuestions((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
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
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSaveForm = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      alert('Please fill in all form details');
      return;
    }
    if (selectedQuestions.length === 0) {
      alert('Please select at least one question');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/forms/${formId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          title: formData.title.trim(),
          description: formData.description.trim(),
          questionIds: selectedQuestions,
          coachId: userProfile?.uid
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update form');
      }

      const responseData = await response.json();

      if (responseData.success) {
        router.push('/forms?success=true&formId=' + formId);
      } else {
        throw new Error(responseData.message || 'Failed to update form');
      }
    } catch (error) {
      console.error('Error updating form:', error);
      alert('Error updating form. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getQuestionTitle = (question: Question) => {
    return question.title || question.text || 'Untitled Question';
  };

  const getQuestionType = (question: Question) => {
    return question.questionType || question.type || 'text';
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
      'Mental Health': 'Mental Health',
      'physical_health': 'Physical Health',
      'Health & Wellness': 'Health & Wellness',
      'Fitness & Exercise': 'Fitness & Exercise',
      'relationships': 'Relationships',
      'work': 'Work/Career',
      'lifestyle': 'Lifestyle',
      'Lifestyle': 'Lifestyle',
      'goals': 'Goals & Progress',
      'Goals & Progress': 'Goals & Progress',
      'Hormonal Health': 'Hormonal Health',
      'Nutrition & Diet': 'Nutrition & Diet',
      'Sleep & Recovery': 'Sleep & Recovery',
      'Self-Care': 'Self-Care',
      'Stress Management': 'Stress Management'
    };
    if (!categoryMap[category]) {
      return category
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    return categoryMap[category];
  };

  // Filter questions
  const filteredQuestions = questions.filter(question => {
    const searchMatch = searchTerm === '' || 
      getQuestionTitle(question).toLowerCase().includes(searchTerm.toLowerCase()) ||
      question.category?.toLowerCase().includes(searchTerm.toLowerCase());
    const categoryMatch = selectedCategoryFilter === 'all' || question.category === selectedCategoryFilter;
    const typeMatch = selectedTypeFilter === 'all' || getQuestionType(question) === selectedTypeFilter;
    return searchMatch && categoryMatch && typeMatch;
  });

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
                  placeholder="Enter form title"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description *
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Enter form description"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                >
                  {categories.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        const uniqueCategories = [...new Set(questions.map(q => q.category))].sort();
        const uniqueTypes = [...new Set(questions.map(q => getQuestionType(q)))].sort();

        return (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Step 2: Select Questions</h2>
            
            {/* Filters */}
            <div className="mb-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Search Questions</label>
                <input
                  type="text"
                  placeholder="Search by question text or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Category</label>
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Categories</option>
                    {uniqueCategories.map(category => (
                      <option key={category} value={category}>
                        {getCategoryLabel(category)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Type</label>
                  <select
                    value={selectedTypeFilter}
                    onChange={(e) => setSelectedTypeFilter(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Types</option>
                    {uniqueTypes.map(type => (
                      <option key={type} value={type}>
                        {getQuestionTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Questions List */}
            {filteredQuestions.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-xl">
                <p className="text-gray-500">No questions found. Create some questions first!</p>
                <Link
                  href="/questions/create"
                  className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Create Question
                </Link>
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {filteredQuestions.map((question) => (
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
                      <input
                        type="checkbox"
                        checked={selectedQuestions.includes(question.id)}
                        onChange={() => toggleQuestionSelection(question.id)}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded ml-4"
                      />
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
                <p className="text-sm text-gray-500 mb-4">Drag and drop to reorder questions</p>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={selectedQuestions}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {selectedQuestions.map((questionId, index) => {
                        const question = questions.find(q => q.id === questionId);
                        if (!question) return null;
                        
                        return (
                          <SortableQuestionItem
                            key={questionId}
                            questionId={questionId}
                            question={question}
                            index={index}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { number: 1, label: 'Form Details' },
      { number: 2, label: 'Select Questions' },
      { number: 3, label: 'Preview' }
    ];

    return (
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-200 ${
                  currentStep >= step.number
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {currentStep > step.number ? '✓' : step.number}
              </div>
              <span className={`mt-2 text-sm font-medium ${
                currentStep >= step.number ? 'text-blue-600' : 'text-gray-500'
              }`}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={`flex-1 h-1 mx-4 ${
                currentStep > step.number ? 'bg-blue-600' : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <RoleProtected requiredRole="coach">
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-800">Loading form...</p>
          </div>
        </div>
      </RoleProtected>
    );
  }

  if (!form) {
    return (
      <RoleProtected requiredRole="coach">
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-800 mb-4">Form not found</p>
            <Link
              href="/forms"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Forms
            </Link>
          </div>
        </div>
      </RoleProtected>
    );
  }

  return (
    <RoleProtected requiredRole="coach">
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
        {/* Navigation Sidebar */}
        <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl border-r border-gray-200 z-50">
          <div className="flex flex-col h-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Coach Portal</h2>
              <p className="text-sm text-gray-600">Edit Form</p>
            </div>

            <nav className="flex-1 p-4 space-y-2">
              <Link href="/dashboard" className="flex items-center px-4 py-3 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Dashboard
              </Link>
              <Link href="/forms" className="flex items-center px-4 py-3 bg-blue-50 text-blue-700 rounded-xl border-r-4 border-blue-600">
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Forms & Check-ins
              </Link>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="ml-64 flex-1 p-6">
          <div className="max-w-5xl mx-auto">
            {renderStepIndicator()}
            {renderStepContent()}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between mt-8">
              <button
                onClick={prevStep}
                disabled={currentStep === 1}
                className={`inline-flex items-center px-6 py-3 rounded-xl text-sm font-medium transition-colors ${
                  currentStep === 1
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
              >
                Previous
              </button>

              {currentStep < 3 ? (
                <button
                  onClick={nextStep}
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSaveForm}
                  disabled={isSaving}
                  className={`inline-flex items-center px-6 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isSaving
                      ? 'bg-gray-400 text-white cursor-not-allowed'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
}

