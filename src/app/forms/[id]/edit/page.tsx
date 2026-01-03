'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
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
  index,
  returnUrl
}: { 
  questionId: string; 
  question: Question; 
  index: number;
  returnUrl?: string;
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
  const getCategoryLabel = (category: string | undefined) => {
    if (!category || typeof category !== 'string') return 'Uncategorized';
    const categoryStr = String(category).trim();
    if (!categoryStr) return 'Uncategorized';
    return categoryStr
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const editUrl = returnUrl 
    ? `/questions/edit/${questionId}?returnUrl=${encodeURIComponent(returnUrl)}`
    : `/questions/edit/${questionId}`;

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
      <Link
        href={editUrl}
        className="flex items-center justify-center px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200 transition-all duration-200 whitespace-nowrap"
        onClick={(e) => {
          // Don't trigger drag when clicking edit
          e.stopPropagation();
        }}
      >
        <svg className="w-3.5 h-3.5 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Edit
      </Link>
    </div>
  );
}

export default function EditFormPage() {
  const router = useRouter();
  const [showScoringInfo, setShowScoringInfo] = useState(false);
  const [previewThresholds, setPreviewThresholds] = useState({ redMax: 33, orangeMax: 80 });
  const params = useParams();
  const searchParams = useSearchParams();
  const formId = (params?.id as string) || '';
  const { userProfile } = useAuth();
  const [currentStep, setCurrentStep] = useState(() => {
    // Check if step is in URL (for returning from edit)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const step = params.get('step');
      return step ? parseInt(step) : 1;
    }
    return 1;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false); // Track if initial data has been loaded
  
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

  // Fetch form and questions (only on initial load)
  useEffect(() => {
    // Only fetch if we haven't loaded initial data yet
    if (hasLoadedInitialData) {
      return;
    }

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
            // Load thresholds from form if they exist, otherwise use defaults
            if (formDataObj.thresholds?.redMax !== undefined && formDataObj.thresholds?.orangeMax !== undefined) {
              setPreviewThresholds({
                redMax: formDataObj.thresholds.redMax,
                orangeMax: formDataObj.thresholds.orangeMax
              });
            } else {
              // Default to lifestyle thresholds
              setPreviewThresholds({ redMax: 33, orangeMax: 80 });
            }
            // Set selected questions in the order they appear in the form
            // Handle both cases: questions as IDs (strings) or as objects
            const questionIds = (formDataObj.questions || []).map((q: any) => 
              typeof q === 'string' ? q : q.id
            );
            setSelectedQuestions(questionIds);
            setHasLoadedInitialData(true); // Mark as loaded
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
  }, [userProfile?.uid, formId, hasLoadedInitialData]);

  // Refresh questions when returning from edit page
  useEffect(() => {
    const questionUpdated = searchParams?.get('questionUpdated');
    const step = searchParams?.get('step');
    
    if (questionUpdated === 'true' && userProfile?.uid) {
      // Refresh questions list
      fetch(`/api/questions?coachId=${userProfile.uid}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setQuestions(data.questions || []);
          }
        })
        .catch(err => console.error('Error refreshing questions:', err));
      
      // Return to the step that was specified, or stay on current step
      if (step) {
        setCurrentStep(parseInt(step));
        // Remove the questionUpdated parameter but keep step
        router.replace(`/forms/${formId}/edit?step=${step}`);
      } else {
        // Remove the query parameter from URL
        router.replace(`/forms/${formId}/edit`);
      }
    }
  }, [searchParams, userProfile?.uid, formId, router]);

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // Calculate new order
      let newOrder: string[] = [];
      
      setSelectedQuestions((prev) => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        newOrder = arrayMove(prev, oldIndex, newIndex);
        return newOrder;
      });

      // Autosave the new order immediately (after state update)
      // Use a small delay to ensure state has updated
      setTimeout(async () => {
        try {
          const payload = {
            ...formData,
            title: formData.title.trim(),
            description: formData.description.trim(),
            questionIds: newOrder, // Save the new order
            coachId: userProfile?.uid,
            thresholds: {
              redMax: previewThresholds.redMax,
              orangeMax: previewThresholds.orangeMax
            }
          };

          const response = await fetch(`/api/forms/${formId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            const responseData = await response.json();
            if (responseData.success) {
              console.log('Question order autosaved successfully');
            } else {
              console.error('Autosave failed:', responseData.message);
            }
          } else {
            console.error('Autosave failed with status:', response.status);
          }
        } catch (error) {
          console.error('Error autosaving question order:', error);
          // Don't show alert for autosave failures - it's a background operation
        }
      }, 100);
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
      const payload = {
        ...formData,
        title: formData.title.trim(),
        description: formData.description.trim(),
        questionIds: selectedQuestions,
        coachId: userProfile?.uid,
        thresholds: {
          redMax: previewThresholds.redMax,
          orangeMax: previewThresholds.orangeMax
        }
      };

      console.log('Saving form with questionIds:', selectedQuestions.length, 'questions');
      
      const response = await fetch(`/api/forms/${formId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to update form. Response:', errorText);
        throw new Error(`Failed to update form: ${response.status} ${response.statusText}`);
      }

      const responseData = await response.json();

      if (responseData.success) {
        console.log('Form saved successfully with', selectedQuestions.length, 'questions');
        router.push('/forms?success=true&formId=' + formId);
      } else {
        console.error('Form save returned success: false', responseData);
        throw new Error(responseData.message || 'Failed to update form');
      }
    } catch (error) {
      console.error('Error updating form:', error);
      alert(`Error updating form: ${error instanceof Error ? error.message : 'Please try again.'}`);
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

  const getCategoryLabel = (category: string | undefined) => {
    if (!category || typeof category !== 'string') return 'Uncategorized';
    
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
    if (categoryMap[category]) {
      return categoryMap[category];
    }
    // Safe split - ensure category is a string before splitting
    const categoryStr = String(category).trim();
    if (!categoryStr) return 'Uncategorized';
    return categoryStr
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
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
        const uniqueCategories = [...new Set(questions.map(q => q.category).filter(cat => cat != null && cat !== ''))].sort();
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
                      <div className="ml-4 flex items-center gap-2">
                        <Link
                          href={`/questions/edit/${question.id}?returnUrl=${encodeURIComponent(`/forms/${formId}/edit`)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors flex items-center gap-1"
                          title="Edit question"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </Link>
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
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-gray-900">Selected Questions:</h4>
                    <p className="text-sm text-gray-500 mt-1">Drag and drop to reorder questions</p>
                  </div>
                </div>
                
                {/* Scoring Formula & Traffic Light Info */}
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg border border-purple-200 p-4 mb-4">
                  <button
                    onClick={() => setShowScoringInfo(!showScoringInfo)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <h5 className="text-sm font-bold text-gray-900">How Scoring Works</h5>
                        <p className="text-xs text-gray-600">Learn about the scoring formula and traffic light system</p>
                      </div>
                    </div>
                    <svg 
                      className={`w-4 h-4 text-gray-400 transition-transform ${showScoringInfo ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showScoringInfo && (
                  <div className="mt-4 pt-4 border-t border-purple-200 space-y-4">
                    {/* Scoring Formula */}
                    <div>
                      <h6 className="text-xs font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <span>📊</span>
                        Scoring Formula
                      </h6>
                      <div className="bg-white rounded-lg p-3 space-y-2">
                        <div className="text-xs text-gray-700">
                          <p className="font-semibold mb-1">Each question contributes to the final score:</p>
                          <div className="bg-gray-50 rounded p-2 font-mono text-xs border border-gray-200">
                            <div className="mb-1">weightedScore = questionScore × questionWeight</div>
                            <div>totalScore = (Σ weightedScores / (Σ weights × 10)) × 100</div>
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 space-y-0.5">
                          <p>• <strong>Question Weight (1-10):</strong> Importance of the question</p>
                          <p>• <strong>Question Score (1-10):</strong> Answer converted to a score</p>
                          <p>• <strong>Final Score (0-100%):</strong> Weighted average</p>
                        </div>
                      </div>
                    </div>

                    {/* Answer Scoring */}
                    <div>
                      <h6 className="text-xs font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <span>✅</span>
                        How Answers Are Scored
                      </h6>
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                        <div className="bg-white rounded-lg p-2">
                          <p className="font-semibold mb-0.5">Scale (1-10):</p>
                          <p className="text-gray-600">Direct value</p>
                        </div>
                        <div className="bg-white rounded-lg p-2">
                          <p className="font-semibold mb-0.5">Yes/No:</p>
                          <p className="text-gray-600">Yes = 8/10, No = 3/10</p>
                        </div>
                        <div className="bg-white rounded-lg p-2">
                          <p className="font-semibold mb-0.5">Single/Multiple Choice:</p>
                          <p className="text-gray-600">Uses option weights</p>
                        </div>
                        <div className="bg-white rounded-lg p-2">
                          <p className="font-semibold mb-0.5">Text Questions:</p>
                          <p className="text-gray-600">Neutral 5/10</p>
                        </div>
                      </div>
                    </div>

                    {/* Form Math Calculation */}
                    {selectedQuestions.length > 0 && (() => {
                      const selectedQData = selectedQuestions.map(qId => {
                        const q = questions.find(q => q.id === qId);
                        return q;
                      }).filter(Boolean);
                      
                      const totalWeight = selectedQData.reduce((sum, q) => {
                        const weight = q?.questionWeight || q?.weight || 5;
                        return sum + weight;
                      }, 0);
                      
                      const maxPossibleScore = totalWeight * 10;
                      
                      // Example calculation with average scores
                      const exampleScores = {
                        perfect: maxPossibleScore,
                        good: Math.round(maxPossibleScore * 0.75),
                        average: Math.round(maxPossibleScore * 0.5),
                        poor: Math.round(maxPossibleScore * 0.25)
                      };
                      
                      return (
                        <div>
                          <h6 className="text-xs font-bold text-gray-900 mb-2 flex items-center gap-2">
                            <span>🧮</span>
                            Form Calculation Preview
                          </h6>
                          <div className="bg-white rounded-lg p-3 space-y-3">
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div className="bg-gray-50 rounded p-2">
                                <p className="font-semibold text-gray-700 mb-1">Total Questions</p>
                                <p className="text-lg font-bold text-gray-900">{selectedQuestions.length}</p>
                              </div>
                              <div className="bg-gray-50 rounded p-2">
                                <p className="font-semibold text-gray-700 mb-1">Total Weight</p>
                                <p className="text-lg font-bold text-gray-900">{totalWeight}</p>
                              </div>
                              <div className="bg-gray-50 rounded p-2">
                                <p className="font-semibold text-gray-700 mb-1">Max Possible Score</p>
                                <p className="text-lg font-bold text-gray-900">{maxPossibleScore}</p>
                              </div>
                              <div className="bg-gray-50 rounded p-2">
                                <p className="font-semibold text-gray-700 mb-1">Formula</p>
                                <p className="text-xs text-gray-600">Score = (Σ weighted / {maxPossibleScore}) × 100</p>
                              </div>
                            </div>
                            
                            {/* Question Breakdown */}
                            <div>
                              <p className="text-xs font-semibold text-gray-700 mb-2">Question Weights:</p>
                              <div className="max-h-32 overflow-y-auto space-y-1">
                                {selectedQData.slice(0, 5).map((q, idx) => {
                                  const weight = q?.questionWeight || q?.weight || 5;
                                  const title = q?.text || q?.title || `Question ${idx + 1}`;
                                  return (
                                    <div key={q?.id || idx} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1">
                                      <span className="text-gray-700 truncate flex-1">{title.substring(0, 40)}{title.length > 40 ? '...' : ''}</span>
                                      <span className="font-bold text-gray-900 ml-2">Weight: {weight}</span>
                                    </div>
                                  );
                                })}
                                {selectedQData.length > 5 && (
                                  <p className="text-xs text-gray-500 italic">+ {selectedQData.length - 5} more questions</p>
                                )}
                              </div>
                            </div>
                            
                            {/* Example Scores */}
                            <div>
                              <p className="text-xs font-semibold text-gray-700 mb-2">Example Score Calculations:</p>
                              <div className="space-y-1.5">
                                {[
                                  { label: 'Perfect (all 10s)', score: exampleScores.perfect, color: 'green' },
                                  { label: 'Good (avg 7.5)', score: exampleScores.good, color: 'orange' },
                                  { label: 'Average (avg 5)', score: exampleScores.average, color: 'orange' },
                                  { label: 'Poor (avg 2.5)', score: exampleScores.poor, color: 'red' }
                                ].map((example, idx) => {
                                  const percentage = Math.round((example.score / maxPossibleScore) * 100);
                                  const status = percentage <= previewThresholds.redMax ? 'red' : 
                                                percentage <= previewThresholds.orangeMax ? 'orange' : 'green';
                                  return (
                                    <div key={idx} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1.5">
                                      <span className="text-gray-700">{example.label}:</span>
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-900">{example.score}/{maxPossibleScore}</span>
                                        <span className="font-bold text-gray-900">= {percentage}%</span>
                                        <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                                          status === 'red' ? 'bg-red-100 text-red-700' :
                                          status === 'orange' ? 'bg-orange-100 text-orange-700' :
                                          'bg-green-100 text-green-700'
                                        }`}>
                                          {status === 'red' ? '🔴' : status === 'orange' ? '🟠' : '🟢'}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Traffic Light Thresholds - Adjustable */}
                    <div>
                      <h6 className="text-xs font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <span>🚦</span>
                        Traffic Light Zones (Adjustable)
                      </h6>
                      <div className="bg-white rounded-lg p-3 space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-red-50 rounded p-2 border border-red-200">
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-sm">🔴</span>
                              <span className="font-bold text-red-700 text-xs">Red Zone</span>
                            </div>
                            <div className="flex items-center gap-1 mb-0.5">
                              <input
                                type="number"
                                min="0"
                                max="99"
                                value={previewThresholds.redMax}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  if (val < previewThresholds.orangeMax) {
                                    setPreviewThresholds({ ...previewThresholds, redMax: val });
                                  }
                                }}
                                className="w-12 px-1 py-0.5 text-xs border border-red-300 rounded text-gray-900"
                              />
                              <span className="text-xs text-gray-600">% max</span>
                            </div>
                            <p className="text-xs font-semibold text-gray-900">0 - {previewThresholds.redMax}%</p>
                            <p className="text-xs text-gray-600">Needs Attention</p>
                          </div>
                          <div className="bg-orange-50 rounded p-2 border border-orange-200">
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-sm">🟠</span>
                              <span className="font-bold text-orange-700 text-xs">Orange Zone</span>
                            </div>
                            <div className="flex items-center gap-1 mb-0.5">
                              <input
                                type="number"
                                min={previewThresholds.redMax + 1}
                                max="99"
                                value={previewThresholds.orangeMax}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 80;
                                  if (val > previewThresholds.redMax && val <= 99) {
                                    setPreviewThresholds({ ...previewThresholds, orangeMax: val });
                                  }
                                }}
                                className="w-12 px-1 py-0.5 text-xs border border-orange-300 rounded text-gray-900"
                              />
                              <span className="text-xs text-gray-600">% max</span>
                            </div>
                            <p className="text-xs font-semibold text-gray-900">{previewThresholds.redMax + 1} - {previewThresholds.orangeMax}%</p>
                            <p className="text-xs text-gray-600">On Track</p>
                          </div>
                          <div className="bg-green-50 rounded p-2 border border-green-200">
                            <div className="flex items-center gap-1 mb-1">
                              <span className="text-sm">🟢</span>
                              <span className="font-bold text-green-700 text-xs">Green Zone</span>
                            </div>
                            <p className="text-xs font-semibold text-gray-900 mb-1">{previewThresholds.orangeMax + 1} - 100%</p>
                            <p className="text-xs text-gray-600">Excellent</p>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-gray-200">
                          <p className="text-xs text-gray-600 italic mb-2">
                            Adjust thresholds to preview how scores will be categorized. These are defaults - actual thresholds are set per client profile.
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setPreviewThresholds({ redMax: 33, orangeMax: 80 })}
                              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                            >
                              Lifestyle
                            </button>
                            <button
                              onClick={() => setPreviewThresholds({ redMax: 75, orangeMax: 89 })}
                              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                            >
                              High Performance
                            </button>
                            <button
                              onClick={() => setPreviewThresholds({ redMax: 60, orangeMax: 85 })}
                              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                            >
                              Moderate
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  )}
                </div>
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
                        
                        // Create return URL to come back to this form preview
                        const formId = params?.id as string || '';
                        // Use pathname only to avoid double query params
                        const returnUrl = `/forms/${formId}/edit?step=3`;
                        
                        return (
                          <SortableQuestionItem
                            key={questionId}
                            questionId={questionId}
                            question={question}
                            index={index}
                            returnUrl={returnUrl}
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

