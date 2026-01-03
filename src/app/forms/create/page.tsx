'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import { DEFAULT_CHECK_IN_WINDOW } from '@/lib/checkin-window-utils';
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

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
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
  const getCategoryLabel = (category: string) => {
    // Simple category label - just return the category or format it nicely
    if (!category) return 'Uncategorized';
    return category
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

function CreateFormPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userProfile, logout } = useAuth();
  const [currentStep, setCurrentStep] = useState(() => {
    // Check if step is in URL (for returning from edit)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const step = params.get('step');
      return step ? parseInt(step) : 1;
    }
    return 1;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showScoringInfo, setShowScoringInfo] = useState(false);
  const [previewThresholds, setPreviewThresholds] = useState({ redMax: 33, orangeMax: 80 });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [clients, setCliients] = useState<Client[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [editFormData, setEditFormData] = useState<any>(null);
  
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
  const [allocationData, setAllocationData] = useState({
    frequency: 'weekly',
    duration: 4,
    startDate: new Date().toISOString().split('T')[0],
    dueTime: '09:00',
    checkInWindow: DEFAULT_CHECK_IN_WINDOW
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
        if (!userProfile?.uid) {
          console.error('No user profile found');
          return;
        }
        const coachId = userProfile.uid;
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
        router.replace(`/forms/create?step=${step}`);
      } else {
        // Remove the query parameter from URL
        router.replace('/forms/create');
      }
    }
  }, [searchParams, userProfile?.uid, router]);

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

  const toggleClientSelection = (clientId: string) => {
    setSelectedClients(prev => {
      const newSelection = prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId];
      return newSelection;
    });
  };

  const openEditModal = async (question: Question) => {
    try {
      // Fetch full question data
      const response = await fetch(`/api/questions/${question.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.question) {
          const q = data.question;
          
          // Prepare form data similar to question edit page
          let options: Array<{ text: string; weight: number }> = [];
          if (q.options && Array.isArray(q.options)) {
            options = q.options.map((opt: any) => ({
              text: typeof opt === 'string' ? opt : (opt.text || opt.value || String(opt)),
              weight: opt.weight || opt.value || 5
            }));
          }
          
          // For scale questions, ensure we have all 10 options
          if ((q.type === 'scale' || q.questionType === 'scale') && options.length < 10) {
            const existingOptions = new Map(options.map(opt => [opt.text, opt.weight]));
            options = Array.from({ length: 10 }, (_, i) => {
              const num = String(i + 1);
              return {
                text: num,
                weight: existingOptions.get(num) || (i + 1)
              };
            });
          }

          setEditFormData({
            text: q.text || q.title || '',
            type: q.type || q.questionType || 'text',
            category: q.category || '',
            options: options,
            required: q.required || q.isRequired || false,
            description: q.description || '',
            hasWeighting: q.hasWeighting !== undefined ? q.hasWeighting : (options.length > 0 && options.some(opt => opt.weight !== undefined && opt.weight !== 5)),
            questionWeight: q.questionWeight || q.weight || 5,
            yesIsPositive: q.yesIsPositive !== undefined ? q.yesIsPositive : true
          });
          
          setEditingQuestion(q);
          setEditModalOpen(true);
        }
      }
    } catch (error) {
      console.error('Error loading question:', error);
      alert('Failed to load question data');
    }
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditingQuestion(null);
    setEditFormData(null);
  };

  const handleSaveOver = async () => {
    if (!editingQuestion || !editFormData) return;
    
    if (!editFormData.text.trim()) {
      alert('Please enter a question text');
      return;
    }

    setIsSavingQuestion(true);
    try {
      const questionData: any = {
        text: editFormData.text.trim(),
        title: editFormData.text.trim(),
        type: editFormData.type,
        questionType: editFormData.type,
        category: editFormData.category || 'General',
        required: editFormData.required || false,
        isRequired: editFormData.required || false,
        questionWeight: editFormData.questionWeight || 5,
        weight: editFormData.questionWeight || 5,
        hasWeighting: editFormData.hasWeighting
      };

      if (editFormData.description) {
        questionData.description = editFormData.description;
      }

      if (editFormData.yesIsPositive !== undefined) {
        questionData.yesIsPositive = editFormData.yesIsPositive;
      }

      if (editFormData.options && editFormData.options.length > 0) {
        questionData.options = editFormData.options;
      }

      const response = await fetch(`/api/questions/${editingQuestion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(questionData)
      });

      const data = await response.json();
      if (data.success) {
        // Refresh questions list
        const questionsResponse = await fetch(`/api/questions?coachId=${userProfile?.uid}`);
        if (questionsResponse.ok) {
          const questionsData = await questionsResponse.json();
          if (questionsData.success) {
            setQuestions(questionsData.questions || []);
          }
        }
        closeEditModal();
        alert('Question updated successfully!');
      } else {
        alert('Failed to update question: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating question:', error);
      alert('Failed to update question. Please try again.');
    } finally {
      setIsSavingQuestion(false);
    }
  };

  const handleSaveAsNew = async () => {
    if (!editFormData) return;
    
    if (!editFormData.text.trim()) {
      alert('Please enter a question text');
      return;
    }

    setIsSavingQuestion(true);
    try {
      const questionData: any = {
        text: editFormData.text.trim(),
        title: editFormData.text.trim(),
        type: editFormData.type,
        questionType: editFormData.type,
        category: editFormData.category || 'General',
        required: editFormData.required || false,
        isRequired: editFormData.required || false,
        questionWeight: editFormData.questionWeight || 5,
        weight: editFormData.questionWeight || 5,
        hasWeighting: editFormData.hasWeighting,
        coachId: userProfile?.uid
      };

      if (editFormData.description) {
        questionData.description = editFormData.description;
      }

      if (editFormData.yesIsPositive !== undefined) {
        questionData.yesIsPositive = editFormData.yesIsPositive;
      }

      if (editFormData.options && editFormData.options.length > 0) {
        questionData.options = editFormData.options;
      }

      const response = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(questionData)
      });

      const data = await response.json();
      if (data.success) {
        // Refresh questions list
        const questionsResponse = await fetch(`/api/questions?coachId=${userProfile?.uid}`);
        if (questionsResponse.ok) {
          const questionsData = await questionsResponse.json();
          if (questionsData.success) {
            setQuestions(questionsData.questions || []);
            // Auto-select the new question
            if (data.questionId) {
              setSelectedQuestions(prev => [...prev, data.questionId]);
            }
          }
        }
        closeEditModal();
        alert('New question created successfully!');
      } else {
        alert('Failed to create question: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating question:', error);
      alert('Failed to create question. Please try again.');
    } finally {
      setIsSavingQuestion(false);
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
        coachId: userProfile?.uid,
        thresholds: {
          redMax: previewThresholds.redMax,
          orangeMax: previewThresholds.orangeMax
        }
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
        thresholds: {
          redMax: previewThresholds.redMax,
          orangeMax: previewThresholds.orangeMax
        },
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
    // If not in map, format the category nicely (capitalize words)
    if (!categoryMap[category]) {
      return category
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    }
    return categoryMap[category];
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
                  value={formData.estimatedTime || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    handleInputChange('estimatedTime', value === '' ? 5 : parseInt(value) || 5);
                  }}
                  min="1"
                  max="60"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        // Get unique categories and types from questions
        const uniqueCategories = [...new Set(questions.map(q => q.category))].sort();
        const uniqueTypes = [...new Set(questions.map(q => getQuestionType(q)))].sort();
        
        // Filter questions based on selected filters
        const filteredQuestions = questions.filter(question => {
          const categoryMatch = selectedCategoryFilter === 'all' || question.category === selectedCategoryFilter;
          const typeMatch = selectedTypeFilter === 'all' || getQuestionType(question) === selectedTypeFilter;
          const searchMatch = searchTerm === '' || 
            getQuestionTitle(question).toLowerCase().includes(searchTerm.toLowerCase()) ||
            (question.description && question.description.toLowerCase().includes(searchTerm.toLowerCase()));
          
          return categoryMatch && typeMatch && searchMatch;
        });
        
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

            {/* Filters */}
            {questions.length > 0 && (
              <div className="mb-6 space-y-4">
                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Questions
                  </label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by question text or description..."
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  />
                </div>

                {/* Category and Type Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Filter by Category
                    </label>
                    <select
                      value={selectedCategoryFilter}
                      onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                    >
                      <option value="all">All Categories ({questions.length})</option>
                      {uniqueCategories.map(category => {
                        const count = questions.filter(q => q.category === category).length;
                        return (
                          <option key={category} value={category}>
                            {getCategoryLabel(category)} ({count})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Filter by Type
                    </label>
                    <select
                      value={selectedTypeFilter}
                      onChange={(e) => setSelectedTypeFilter(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                    >
                      <option value="all">All Types ({questions.length})</option>
                      {uniqueTypes.map(type => {
                        const count = questions.filter(q => getQuestionType(q) === type).length;
                        return (
                          <option key={type} value={type}>
                            {getQuestionTypeLabel(type)} ({count})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Active Filters Display */}
                {(selectedCategoryFilter !== 'all' || selectedTypeFilter !== 'all' || searchTerm) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-600">Active filters:</span>
                    {selectedCategoryFilter !== 'all' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Category: {getCategoryLabel(selectedCategoryFilter)}
                        <button
                          onClick={() => setSelectedCategoryFilter('all')}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          ×
                        </button>
                      </span>
                    )}
                    {selectedTypeFilter !== 'all' && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Type: {getQuestionTypeLabel(selectedTypeFilter)}
                        <button
                          onClick={() => setSelectedTypeFilter('all')}
                          className="ml-2 text-green-600 hover:text-green-800"
                        >
                          ×
                        </button>
                      </span>
                    )}
                    {searchTerm && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Search: "{searchTerm}"
                        <button
                          onClick={() => setSearchTerm('')}
                          className="ml-2 text-purple-600 hover:text-purple-800"
                        >
                          ×
                        </button>
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setSelectedCategoryFilter('all');
                        setSelectedTypeFilter('all');
                        setSearchTerm('');
                      }}
                      className="text-sm text-gray-600 hover:text-gray-900 underline"
                    >
                      Clear all
                    </button>
                  </div>
                )}

                {/* Results Count */}
                <div className="text-sm text-gray-600">
                  Showing {filteredQuestions.length} of {questions.length} questions
                </div>
              </div>
            )}

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
            ) : filteredQuestions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No questions match your filters</h3>
                <p className="text-gray-500 mb-6">Try adjusting your search or filter criteria.</p>
                <button
                  onClick={() => {
                    setSelectedCategoryFilter('all');
                    setSelectedTypeFilter('all');
                    setSearchTerm('');
                  }}
                  className="inline-flex items-center px-6 py-3 bg-gray-600 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="space-y-4">
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
                          href={`/questions/edit/${question.id}?returnUrl=${encodeURIComponent('/forms/create')}`}
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
                        // Use pathname only to avoid double query params
                        const returnUrl = '/forms/create?step=3';
                        
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

      {/* Edit Question Modal */}
      {editModalOpen && editFormData && editingQuestion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Edit Question</h2>
              <button
                onClick={closeEditModal}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Question Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Question Text *
                </label>
                <textarea
                  value={editFormData.text}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, text: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  rows={3}
                  required
                />
              </div>

              {/* Question Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Question Type
                </label>
                <select
                  value={editFormData.type}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  disabled
                >
                  <option value="text">Short Text</option>
                  <option value="textarea">Long Text</option>
                  <option value="number">Number</option>
                  <option value="select">Single Choice</option>
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="scale">Scale (1-10)</option>
                  <option value="boolean">Yes/No</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Question type cannot be changed when editing</p>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={editFormData.category}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                >
                  <option value="">Select a category</option>
                  <option value="Health & Wellness">Health & Wellness</option>
                  <option value="Fitness & Exercise">Fitness & Exercise</option>
                  <option value="Nutrition & Diet">Nutrition & Diet</option>
                  <option value="Mental Health">Mental Health</option>
                  <option value="Sleep & Recovery">Sleep & Recovery</option>
                  <option value="Stress Management">Stress Management</option>
                  <option value="Goals & Progress">Goals & Progress</option>
                  <option value="Lifestyle">Lifestyle</option>
                  <option value="Medical History">Medical History</option>
                  <option value="General">General</option>
                  <option value="Vana Check In">Vana Check In</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={editFormData.description || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  rows={2}
                />
              </div>

              {/* Question Weight */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Question Weight: {editFormData.questionWeight}/10
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={editFormData.questionWeight}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, questionWeight: parseInt(e.target.value) }))}
                  className="w-full"
                />
              </div>

              {/* Boolean-specific: Yes is Positive */}
              {editFormData.type === 'boolean' && (
                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editFormData.yesIsPositive}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, yesIsPositive: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Yes is a positive response</span>
                  </label>
                </div>
              )}

              {/* Options for select/multiple_choice/scale */}
              {(editFormData.type === 'select' || editFormData.type === 'multiple_choice' || editFormData.type === 'scale') && editFormData.options && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Options
                  </label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {editFormData.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                        <input
                          type="text"
                          value={option.text}
                          onChange={(e) => {
                            const newOptions = [...editFormData.options];
                            newOptions[index] = { ...option, text: e.target.value };
                            setEditFormData(prev => ({ ...prev, options: newOptions }));
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded text-gray-900"
                        />
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={option.weight}
                          onChange={(e) => {
                            const newOptions = [...editFormData.options];
                            newOptions[index] = { ...option, weight: parseInt(e.target.value) || 5 };
                            setEditFormData(prev => ({ ...prev, options: newOptions }));
                          }}
                          className="w-20 px-3 py-2 border border-gray-300 rounded text-gray-900"
                          placeholder="Weight"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newOptions = editFormData.options.filter((_, i) => i !== index);
                            setEditFormData(prev => ({ ...prev, options: newOptions }));
                          }}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAsNew}
                  disabled={isSavingQuestion}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                >
                  {isSavingQuestion ? 'Saving...' : 'Save as New Question'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveOver}
                  disabled={isSavingQuestion}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                >
                  {isSavingQuestion ? 'Saving...' : 'Save Over'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </RoleProtected>
  );
}

export default function CreateFormPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <CreateFormPageContent />
    </Suspense>
  );
} 