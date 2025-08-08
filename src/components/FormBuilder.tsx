'use client';

import { useState, useEffect } from 'react';
import { CustomForm, CustomQuestion } from '@/lib/types';

interface FormBuilderProps {
  onSave: (form: Omit<CustomForm, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  initialForm?: Partial<CustomForm>;
  coachId: string;
  questions: CustomQuestion[];
}

export default function FormBuilder({ onSave, onCancel, initialForm, coachId, questions }: FormBuilderProps) {
  const [form, setForm] = useState<Partial<CustomForm>>({
    coachId,
    name: '',
    description: '',
    questions: [],
    totalWeight: 0,
    estimatedTime: 10,
    isActive: true,
    ...initialForm
  });

  const [selectedQuestions, setSelectedQuestions] = useState<string[]>(
    initialForm?.questions?.map(q => q.id) || []
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Filter questions based on search and category
  const filteredQuestions = questions.filter(question => {
    const matchesSearch = question.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         question.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || question.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Update form questions when selection changes
  useEffect(() => {
    const selectedQuestionObjects = questions.filter(q => selectedQuestions.includes(q.id));
    const totalWeight = selectedQuestionObjects.reduce((sum, q) => sum + q.weight, 0);
    const estimatedTime = Math.ceil(selectedQuestionObjects.length * 1.5); // 1.5 minutes per question

    setForm(prev => ({
      ...prev,
      questions: selectedQuestionObjects,
      totalWeight,
      estimatedTime
    }));
  }, [selectedQuestions, questions]);

  const handleSave = () => {
    if (!form.name || !form.description || form.questions?.length === 0) {
      alert('Please fill in all required fields and select at least one question');
      return;
    }

    const formData: Omit<CustomForm, 'id' | 'createdAt' | 'updatedAt'> = {
      coachId,
      name: form.name,
      description: form.description,
      questions: form.questions || [],
      totalWeight: form.totalWeight || 0,
      estimatedTime: form.estimatedTime || 10,
      isActive: form.isActive || true
    };

    onSave(formData);
  };

  const toggleQuestion = (questionId: string) => {
    setSelectedQuestions(prev => 
      prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
  };

  const moveQuestion = (fromIndex: number, toIndex: number) => {
    const newQuestions = [...(form.questions || [])];
    const [movedQuestion] = newQuestions.splice(fromIndex, 1);
    newQuestions.splice(toIndex, 0, movedQuestion);
    setForm(prev => ({ ...prev, questions: newQuestions }));
  };

  const removeQuestion = (questionId: string) => {
    setSelectedQuestions(prev => prev.filter(id => id !== questionId));
  };

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'health', label: 'Health' },
    { value: 'lifestyle', label: 'Lifestyle' },
    { value: 'goals', label: 'Goals' },
    { value: 'motivation', label: 'Motivation' },
    { value: 'risk', label: 'Risk Assessment' },
    { value: 'custom', label: 'Custom' }
  ];

  const getCategoryColor = (category: string) => {
    const colors = {
      health: 'bg-red-100 text-red-800',
      lifestyle: 'bg-blue-100 text-blue-800',
      goals: 'bg-green-100 text-green-800',
      motivation: 'bg-yellow-100 text-yellow-800',
      risk: 'bg-purple-100 text-purple-800',
      custom: 'bg-gray-100 text-gray-800'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {initialForm ? 'Edit Form' : 'Create New Form'}
        </h2>
        <p className="text-gray-800">
          Build custom forms by selecting and ordering questions from your library
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form Details */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Form Details</h3>
          
          {/* Form Name */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Form Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Weight Loss Initial Assessment"
            />
          </div>

          {/* Form Description */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Description *
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="Describe what this form is for..."
            />
          </div>

          {/* Form Stats */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Form Statistics</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Total Questions</p>
                <p className="text-lg font-semibold text-gray-900">{form.questions?.length || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Weight</p>
                <p className="text-lg font-semibold text-gray-900">{form.totalWeight || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Estimated Time</p>
                <p className="text-lg font-semibold text-gray-900">{form.estimatedTime || 0} min</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Average Weight</p>
                <p className="text-lg font-semibold text-gray-900">
                  {form.questions?.length ? Math.round((form.totalWeight || 0) / form.questions.length) : 0}
                </p>
              </div>
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="formActive"
              checked={form.isActive || true}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="formActive" className="ml-2 block text-sm text-gray-900">
              This form is active
            </label>
          </div>
        </div>

        {/* Question Selection */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Select Questions</h3>
          
          {/* Search and Filter */}
          <div className="space-y-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search questions..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {categories.map(category => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          {/* Question List */}
          <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
            {filteredQuestions.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No questions found. Create some questions first!
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredQuestions.map(question => (
                  <div
                    key={question.id}
                    className={`p-4 cursor-pointer hover:bg-gray-50 ${
                      selectedQuestions.includes(question.id) ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                    onClick={() => toggleQuestion(question.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <input
                            type="checkbox"
                            checked={selectedQuestions.includes(question.id)}
                            onChange={() => toggleQuestion(question.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(question.category)}`}>
                            {question.category}
                          </span>
                          <span className="text-xs text-gray-500">Weight: {question.weight}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{question.text}</p>
                        <div className="flex items-center space-x-2 mt-2">
                          <span className="text-xs text-gray-500">{question.type}</span>
                          {question.required && (
                            <span className="text-xs text-red-600 font-medium">Required</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selected Questions Order */}
      {form.questions && form.questions.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Question Order</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="space-y-2">
              {form.questions.map((question, index) => (
                <div key={question.id} className="flex items-center space-x-3 p-3 bg-white rounded border">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(question.category)}`}>
                      {question.category}
                    </span>
                    <span className="text-xs text-gray-500">Weight: {question.weight}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{question.text}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {index > 0 && (
                      <button
                        onClick={() => moveQuestion(index, index - 1)}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        ↑
                      </button>
                    )}
                    {index < form.questions!.length - 1 && (
                      <button
                        onClick={() => moveQuestion(index, index + 1)}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        ↓
                      </button>
                    )}
                    <button
                      onClick={() => removeQuestion(question.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-900 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
        >
          {initialForm ? 'Update Form' : 'Create Form'}
        </button>
      </div>
    </div>
  );
} 