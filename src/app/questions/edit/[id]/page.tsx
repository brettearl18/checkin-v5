'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';

interface QuestionFormData {
  text: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'scale' | 'boolean' | 'date' | 'time' | 'textarea';
  category: string;
  options?: Array<{ text: string; weight: number }>;
  required: boolean;
  description?: string;
  hasWeighting: boolean;
  questionWeight: number;
  yesIsPositive?: boolean;
}

export default function EditQuestionPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const questionId = params.id as string;
  const returnUrlParam = searchParams?.get('returnUrl');
  const [returnUrl] = useState<string | null>(() => {
    return returnUrlParam ? decodeURIComponent(returnUrlParam) : null;
  });
  const { userProfile, logout } = useAuth();
  const [formData, setFormData] = useState<QuestionFormData>({
    text: '',
    type: 'text',
    category: '',
    options: [],
    required: false,
    description: '',
    hasWeighting: false,
    questionWeight: 5,
    yesIsPositive: true
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newOption, setNewOption] = useState('');
  const [newWeight, setNewWeight] = useState(5);
  const [error, setError] = useState('');

  const questionTypes = [
    { value: 'text', label: 'Short Text', icon: '📝', description: 'Single line text input', supportsWeighting: false },
    { value: 'textarea', label: 'Long Text', icon: '📄', description: 'Multi-line text input', supportsWeighting: false },
    { value: 'number', label: 'Number', icon: '🔢', description: 'Numeric input', supportsWeighting: false },
    { value: 'select', label: 'Single Choice', icon: '📋', description: 'Choose one option', supportsWeighting: true },
    { value: 'multiselect', label: 'Multiple Choice', icon: '☑️', description: 'Choose multiple options', supportsWeighting: true },
    { value: 'scale', label: 'Scale/Rating', icon: '📊', description: 'Rating scale (1-10)', supportsWeighting: true },
    { value: 'boolean', label: 'Yes/No', icon: '✅', description: 'Boolean choice', supportsWeighting: true },
    { value: 'date', label: 'Date', icon: '📅', description: 'Date picker', supportsWeighting: false },
    { value: 'time', label: 'Time', icon: '⏰', description: 'Time picker', supportsWeighting: false }
  ];

  const categories = [
    'Health & Wellness',
    'Fitness & Exercise',
    'Nutrition & Diet',
    'Mental Health',
    'Sleep & Recovery',
    'Stress Management',
    'Goals & Progress',
    'Lifestyle',
    'Medical History',
    'General'
  ];

  // Log returnUrl for debugging
  useEffect(() => {
    if (returnUrl) {
      console.log('Return URL detected:', returnUrl);
    } else {
      console.log('No return URL found in search params');
    }
  }, [returnUrl]);

  // Fetch question data on mount
  useEffect(() => {
    const fetchQuestion = async () => {
      try {
        const response = await fetch(`/api/questions/${questionId}`);
        const data = await response.json();

        if (data.success && data.question) {
          const question = data.question;
          
          // Convert options format if needed
          let options: Array<{ text: string; weight: number }> = [];
          
          // For scale questions, create options for 1-10 if they don't exist
          if ((question.type === 'scale' || question.questionType === 'scale') && (!question.options || question.options.length === 0)) {
            // Create default scale options 1-10 with default weights
            options = Array.from({ length: 10 }, (_, i) => ({
              text: String(i + 1),
              weight: i + 1 // Default: weight equals the scale value
            }));
          } else if (question.options) {
            if (Array.isArray(question.options)) {
              if (question.options.length > 0) {
                if (typeof question.options[0] === 'string') {
                  // Convert string array to object array
                  options = question.options.map((opt: string, index: number) => ({
                    text: opt,
                    weight: 5 // Default weight
                  }));
                } else {
                  // Already in object format
                  options = question.options.map((opt: any) => ({
                    text: opt.text || String(opt) || String(opt.value) || '',
                    weight: opt.weight || opt.value || 5
                  }));
                }
              }
            }
          }
          
          // For scale questions, ensure we have all 10 options
          if ((question.type === 'scale' || question.questionType === 'scale') && options.length < 10) {
            const existingOptions = new Map(options.map(opt => [opt.text, opt.weight]));
            options = Array.from({ length: 10 }, (_, i) => {
              const num = String(i + 1);
              return {
                text: num,
                weight: existingOptions.get(num) || (i + 1) // Use existing weight or default to scale value
              };
            });
          }

          // Determine if weighting is enabled (has options with weights or hasWeighting flag)
          const hasWeighting = question.hasWeighting !== undefined 
            ? question.hasWeighting 
            : (options.length > 0 && options.some(opt => opt.weight !== undefined && opt.weight !== 5));

          setFormData({
            text: question.text || question.title || '',
            type: question.type || question.questionType || 'text',
            category: question.category || '',
            options: options,
            required: question.required || question.isRequired || false,
            description: question.description || '',
            hasWeighting: hasWeighting,
            // Text and textarea questions default to weight 0 (don't contribute to scoring)
        questionWeight: (question.type === 'text' || question.questionType === 'text' || question.type === 'textarea' || question.questionType === 'textarea') 
          ? (question.questionWeight || question.weight || 0)
          : (question.questionWeight || question.weight || 5),
            yesIsPositive: question.yesIsPositive !== undefined ? question.yesIsPositive : true
          });
        } else {
          setError('Question not found');
        }
      } catch (error) {
        console.error('Error fetching question:', error);
        setError('Failed to load question');
      } finally {
        setIsLoading(false);
      }
    };

    if (questionId) {
      fetchQuestion();
    }
  }, [questionId]);

  const handleInputChange = (field: keyof QuestionFormData, value: any) => {
    setFormData(prev => {
      const updated = {
        ...prev,
        [field]: value
      };
      
      // If changing to text or textarea, set questionWeight to 0 (they don't contribute to scoring)
      if (field === 'type' && (value === 'text' || value === 'textarea')) {
        updated.questionWeight = 0;
      }
      // If changing from text/textarea to a scorable type, set default weight to 5
      else if (field === 'type' && value !== 'text' && value !== 'textarea' && (prev.type === 'text' || prev.type === 'textarea') && prev.questionWeight === 0) {
        updated.questionWeight = 5;
      }
      
      return updated;
    });
  };

  const handleAddOption = () => {
    if (newOption.trim() && formData.options) {
      setFormData(prev => ({
        ...prev,
        options: [...(prev.options || []), { text: newOption.trim(), weight: newWeight }]
      }));
      setNewOption('');
      setNewWeight(5);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (formData.options) {
      setFormData(prev => ({
        ...prev,
        options: prev.options?.filter((_, i) => i !== index)
      }));
    }
  };

  const handleUpdateOptionWeight = (index: number, weight: number) => {
    if (formData.options) {
      setFormData(prev => ({
        ...prev,
        options: prev.options?.map((option, i) => 
          i === index ? { ...option, weight } : option
        )
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.text.trim()) {
      alert('Please enter a question text');
      return;
    }

    // Validate options for select/multiselect types
    if (showOptionsField && (!formData.options || formData.options.length === 0)) {
      alert('Please add at least one answer option');
      return;
    }

    // For scale questions, ensure we have all 10 options (1-10) with weights
    if (formData.type === 'scale') {
      const scaleOptions = Array.from({ length: 10 }, (_, i) => {
        const num = String(i + 1);
        const existingOption = formData.options?.find(opt => opt.text === num);
        return {
          text: num,
          weight: existingOption?.weight ?? (i + 1) // Use existing weight or default to scale value
        };
      });
      formData.options = scaleOptions;
    }

    // For boolean questions, ensure we have default options if weighting is enabled
    if (formData.type === 'boolean' && formData.hasWeighting && (!formData.options || formData.options.length === 0)) {
      formData.options = [
        { text: 'YES', weight: formData.yesIsPositive ? 9 : 2 },
        { text: 'NO', weight: formData.yesIsPositive ? 2 : 9 }
      ];
    }

    setIsSubmitting(true);

    try {
      // Prepare question data
      const questionData: any = {
        text: formData.text.trim(),
        title: formData.text.trim(),
        type: formData.type,
        questionType: formData.type,
        category: formData.category || 'General',
        required: formData.required || false,
        isRequired: formData.required || false,
        // Text and textarea questions should have weight 0 (don't contribute to scoring)
        questionWeight: (formData.type === 'text' || formData.type === 'textarea') ? 0 : (formData.questionWeight || 5),
        weight: (formData.type === 'text' || formData.type === 'textarea') ? 0 : (formData.questionWeight || 5),
        hasWeighting: formData.hasWeighting
      };

      // Add optional fields only if they have values
      if (formData.description) {
        questionData.description = formData.description;
      }

      if (formData.yesIsPositive !== undefined) {
        questionData.yesIsPositive = formData.yesIsPositive;
      }

      // Add options if they exist
      if (formData.options && formData.options.length > 0) {
        questionData.options = formData.options;
      }

      console.log('Updating question data:', questionData);

      const response = await fetch(`/api/questions/${questionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(questionData)
      });

      const data = await response.json();

      if (data.success) {
        // Redirect back to returnUrl if provided, otherwise to question library
        if (returnUrl) {
          console.log('Redirecting back to:', returnUrl);
          // Properly append questionUpdated parameter
          const separator = returnUrl.includes('?') ? '&' : '?';
          router.push(`${returnUrl}${separator}questionUpdated=true`);
        } else {
          console.log('No returnUrl found, redirecting to library');
          router.push('/questions/library?success=true&updated=true');
        }
      } else {
        console.error('Error updating question:', data.message, data);
        alert('Failed to update question: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating question:', error);
      alert('Failed to update question. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const showOptionsField = formData.type === 'select' || formData.type === 'multiselect' || formData.type === 'scale';
  const currentType = questionTypes.find(t => t.value === formData.type);
  const supportsWeighting = currentType?.supportsWeighting || false;

  if (isLoading) {
    return (
      <RoleProtected requiredRole="coach">
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-800">Loading question...</p>
          </div>
        </div>
      </RoleProtected>
    );
  }

  if (error) {
    return (
      <RoleProtected requiredRole="coach">
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link
              href="/questions/library"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium"
            >
              Back to Library
            </Link>
          </div>
        </div>
      </RoleProtected>
    );
  }

  // Copy the rest of the form JSX from create page - I'll need to read more of it
  return (
    <RoleProtected requiredRole="coach">
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 flex">
        {/* Sidebar - same as create page */}
        <div className="w-64 bg-white shadow-xl border-r border-gray-100">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 px-6 py-8">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h1 className="text-white font-bold text-lg">Coach Hub</h1>
                <p className="text-blue-100 text-sm">Edit Question</p>
              </div>
            </div>
          </div>
          {/* Navigation - simplified for now */}
          <nav className="px-4 py-6">
            <Link
              href="/questions/library"
              className="flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 hover:text-blue-700 rounded-xl font-medium transition-all duration-200"
            >
              ← Back to Library
            </Link>
          </nav>
        </div>

        {/* Main Content - I'll copy the form from create page */}
        <div className="flex-1 p-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    Edit Question
                  </h1>
                  <p className="text-gray-600 mt-2 text-lg">Update your question details</p>
                </div>
                <Link
                  href="/questions/library"
                  className="bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  ← Back to Library
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-8 py-6 border-b border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900">Question Details</h2>
              </div>

              <div className="p-8">
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Question Text */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Question Text *
                    </label>
                    <textarea
                      value={formData.text}
                      onChange={(e) => handleInputChange('text', e.target.value)}
                      placeholder="Enter your question here..."
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder-gray-500"
                      rows={3}
                      required
                    />
                  </div>

                  {/* Question Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-4">
                      Question Type *
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {questionTypes.map((type) => (
                        <label
                          key={type.value}
                          className={`relative flex items-center p-6 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                            formData.type === type.value
                              ? 'border-blue-500 bg-blue-50 shadow-lg'
                              : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                          }`}
                        >
                          <input
                            type="radio"
                            name="type"
                            value={type.value}
                            checked={formData.type === type.value}
                            onChange={(e) => handleInputChange('type', e.target.value)}
                            className="sr-only"
                          />
                          <div className="flex items-center space-x-4">
                            <span className="text-3xl">{type.icon}</span>
                            <div>
                              <div className="font-semibold text-gray-900">{type.label}</div>
                              <div className="text-sm text-gray-600">{type.description}</div>
                              {type.supportsWeighting && (
                                <div className="text-xs text-green-600 font-medium mt-1">Supports weighting</div>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => handleInputChange('category', e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 bg-white"
                    >
                      <option value="">Select a category</option>
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Add a description or context for this question..."
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder-gray-500"
                      rows={2}
                    />
                  </div>

                  {/* Question Weight - Hidden for text/textarea questions (they don't contribute to scoring) */}
                  {(formData.type !== 'text' && formData.type !== 'textarea') && (
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-200">
                      <label className="block text-sm font-medium text-purple-900 mb-4">
                        Question Weight: {formData.questionWeight}/10
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={formData.questionWeight}
                        onChange={(e) => handleInputChange('questionWeight', parseInt(e.target.value))}
                        className="w-full h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-purple-700 mt-2">
                        <span>Low Impact (1)</span>
                        <span>High Impact (10)</span>
                      </div>
                      <p className="text-xs text-purple-600 mt-2">
                        This determines how much this question contributes to the overall score
                      </p>
                    </div>
                  )}
                  
                  {/* Info message for text/textarea questions */}
                  {(formData.type === 'text' || formData.type === 'textarea') && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <p className="text-sm text-gray-600">
                        <strong>Note:</strong> Text and Long Text questions do not contribute to scoring. They are used for context and feedback only.
                      </p>
                    </div>
                  )}

                  {/* Boolean Question Settings */}
                  {formData.type === 'boolean' && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
                      <label className="block text-sm font-medium text-green-900 mb-4">
                        Boolean Answer Scoring
                      </label>
                      <div className="space-y-3">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="yesIsPositive"
                            checked={formData.yesIsPositive === true}
                            onChange={() => handleInputChange('yesIsPositive', true)}
                            className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300"
                          />
                          <span className="ml-3 text-sm text-green-900">
                            <strong>YES is Positive</strong> (e.g., "Do you feel happy?" - YES = good score)
                          </span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="yesIsPositive"
                            checked={formData.yesIsPositive === false}
                            onChange={() => handleInputChange('yesIsPositive', false)}
                            className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300"
                          />
                          <span className="ml-3 text-sm text-green-900">
                            <strong>YES is Negative</strong> (e.g., "Do you feel anxious?" - YES = bad score)
                          </span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Answer Weighting Toggle */}
                  {supportsWeighting && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-blue-900">Answer Weighting</h3>
                          <p className="text-sm text-blue-700">Assign importance values to answer options for scoring</p>
                        </div>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.hasWeighting}
                            onChange={(e) => handleInputChange('hasWeighting', e.target.checked)}
                            className="h-5 w-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500 transition-all duration-200"
                          />
                          <span className="ml-3 text-sm text-blue-900 font-medium">Enable weighting</span>
                        </label>
                      </div>
                      {formData.hasWeighting && (
                        <div className="text-sm text-blue-600 space-y-2">
                          <div>• <strong>1-3:</strong> Low importance/negative responses</div>
                          <div>• <strong>4-6:</strong> Medium importance/neutral responses</div>
                          <div>• <strong>7-10:</strong> High importance/positive responses</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Options for select/multiselect/scale */}
                  {showOptionsField && (
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <label className="block text-sm font-medium text-gray-700 mb-4">
                        {formData.type === 'scale' ? 'Scale Options' : 'Answer Options'} *
                      </label>
                      
                      {formData.type === 'scale' ? (
                        <div className="space-y-4">
                          <div className="text-sm text-gray-600 mb-4">
                            Scale will be from 1 to 10. {formData.hasWeighting && 'Set custom weights for each value:'}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                              const optionIndex = formData.options?.findIndex(opt => opt.text === String(num)) ?? -1;
                              const option = optionIndex >= 0 ? formData.options![optionIndex] : { text: String(num), weight: num };
                              
                              return (
                                <div key={num} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                                  <div className="text-center mb-2">
                                    <span className="text-lg font-bold text-gray-900">{num}</span>
                                  </div>
                                  {formData.hasWeighting && (
                                    <div className="mt-2">
                                      <label className="block text-xs text-gray-600 mb-1">Weight:</label>
                                      <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={option.weight}
                                        onChange={(e) => {
                                          const weight = parseInt(e.target.value) || 1;
                                          if (optionIndex >= 0) {
                                            handleUpdateOptionWeight(optionIndex, weight);
                                          } else {
                                            // Add new option if it doesn't exist
                                            setFormData(prev => ({
                                              ...prev,
                                              options: [...(prev.options || []), { text: String(num), weight }]
                                            }));
                                          }
                                        }}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {!formData.hasWeighting && (
                            <p className="text-xs text-gray-500 mt-2">
                              Enable weighting above to set custom weights for each scale value
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Existing options */}
                          {formData.options && formData.options.length > 0 && (
                            <div className="space-y-3">
                              {formData.options.map((option, index) => (
                                <div key={index} className="flex items-center space-x-3">
                                  <span className="flex-1 px-4 py-3 bg-gray-100 rounded-lg text-gray-900 font-medium">
                                    {option.text}
                                  </span>
                                  {formData.hasWeighting && (
                                    <div className="flex items-center space-x-2">
                                      <span className="text-sm text-gray-700">Weight:</span>
                                      <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={option.weight}
                                        onChange={(e) => handleUpdateOptionWeight(index, parseInt(e.target.value) || 1)}
                                        className="w-20 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                                      />
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOption(index)}
                                    className="px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Add new option */}
                          <div className="flex space-x-3">
                            <input
                              type="text"
                              value={newOption}
                              onChange={(e) => setNewOption(e.target.value)}
                              placeholder="Add new option..."
                              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder-gray-500"
                              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption())}
                            />
                            {formData.hasWeighting && (
                              <input
                                type="number"
                                min="1"
                                max="10"
                                value={newWeight}
                                onChange={(e) => setNewWeight(parseInt(e.target.value) || 1)}
                                placeholder="Weight"
                                className="w-24 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder-gray-500"
                              />
                            )}
                            <button
                              type="button"
                              onClick={handleAddOption}
                              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Required field */}
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.required}
                      onChange={(e) => handleInputChange('required', e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-all duration-200"
                    />
                    <span className="ml-3 text-sm text-gray-900">This question is required</span>
                  </div>

                  {/* Submit Button */}
                  <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
                    <Link
                      href="/questions/library"
                      className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-all duration-200"
                    >
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      disabled={isSubmitting || !formData.text.trim()}
                      className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      {isSubmitting ? 'Updating...' : 'Update Question'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
}

