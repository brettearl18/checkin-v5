'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface QuestionFormData {
  text: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'scale' | 'boolean' | 'date' | 'time' | 'textarea';
  category: string;
  options?: Array<{ text: string; weight: number }>;
  required: boolean;
  description?: string;
  hasWeighting: boolean;
}

export default function CreateQuestionPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<QuestionFormData>({
    text: '',
    type: 'text',
    category: '',
    options: [],
    required: false,
    description: '',
    hasWeighting: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newOption, setNewOption] = useState('');
  const [newWeight, setNewWeight] = useState(5);

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

  const handleInputChange = (field: keyof QuestionFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
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
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to question library with success message
        router.push('/questions/library?success=true&questionId=' + data.questionId);
      } else {
        console.error('Error creating question:', data.message);
        alert('Failed to create question: ' + data.message);
      }
    } catch (error) {
      console.error('Error creating question:', error);
      alert('Failed to create question. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const showOptionsField = formData.type === 'select' || formData.type === 'multiselect' || formData.type === 'scale';
  const currentType = questionTypes.find(t => t.value === formData.type);
  const supportsWeighting = currentType?.supportsWeighting || false;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Create Question</h1>
              <p className="text-gray-600 mt-2">Build custom questions for your check-in forms</p>
            </div>
            <Link
              href="/questions/library"
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              ← Back to Library
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-8">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                required
              />
            </div>

            {/* Question Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Question Type *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {questionTypes.map((type) => (
                  <label
                    key={type.value}
                    className={`relative flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                      formData.type === type.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
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
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{type.icon}</span>
                      <div>
                        <div className="font-medium text-gray-900">{type.label}</div>
                        <div className="text-sm text-gray-500">{type.description}</div>
                        {type.supportsWeighting && (
                          <div className="text-xs text-green-600 font-medium">Supports weighting</div>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
            </div>

            {/* Answer Weighting Toggle */}
            {supportsWeighting && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-medium text-blue-900">Answer Weighting</h3>
                    <p className="text-sm text-blue-700">Assign importance values to answer options for scoring</p>
                  </div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.hasWeighting}
                      onChange={(e) => handleInputChange('hasWeighting', e.target.checked)}
                      className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-blue-900 font-medium">Enable weighting</span>
                  </label>
                </div>
                {formData.hasWeighting && (
                  <div className="text-xs text-blue-600 space-y-1">
                    <div>• <strong>1-3:</strong> Low importance/negative responses</div>
                    <div>• <strong>4-6:</strong> Medium importance/neutral responses</div>
                    <div>• <strong>7-10:</strong> High importance/positive responses</div>
                  </div>
                )}
              </div>
            )}

            {/* Options for select/multiselect/scale */}
            {showOptionsField && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  {formData.type === 'scale' ? 'Scale Options' : 'Answer Options'} *
                </label>
                
                {formData.type === 'scale' ? (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">
                      Scale will be from 1 to 10 with custom weights:
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <div key={num} className="text-center p-2 bg-gray-100 rounded">
                          {num}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Existing options */}
                    {formData.options && formData.options.length > 0 && (
                      <div className="space-y-2">
                        {formData.options.map((option, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <span className="flex-1 px-3 py-2 bg-gray-100 rounded-md">
                              {option.text}
                            </span>
                            {formData.hasWeighting && (
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-gray-500">Weight:</span>
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={option.weight}
                                  onChange={(e) => handleUpdateOptionWeight(index, parseInt(e.target.value) || 1)}
                                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveOption(index)}
                              className="px-2 py-1 text-red-600 hover:text-red-800"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Add new option */}
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newOption}
                        onChange={(e) => setNewOption(e.target.value)}
                        placeholder="Add new option..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          className="w-20 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                      <button
                        type="button"
                        onClick={handleAddOption}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Required field */}
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.required}
                  onChange={(e) => handleInputChange('required', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">This question is required</span>
              </label>
            </div>

            {/* Preview */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Question Preview</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {formData.text || 'Your question will appear here...'}
                    {formData.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  
                  {formData.type === 'text' && (
                    <input
                      type="text"
                      placeholder="Text input"
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                    />
                  )}
                  
                  {formData.type === 'textarea' && (
                    <textarea
                      placeholder="Long text input"
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                      rows={3}
                    />
                  )}
                  
                  {formData.type === 'number' && (
                    <input
                      type="number"
                      placeholder="Number input"
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                    />
                  )}
                  
                  {formData.type === 'select' && formData.options && (
                    <select disabled className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100">
                      <option>Select an option</option>
                      {formData.options.map((option, index) => (
                        <option key={index}>
                          {option.text}
                          {formData.hasWeighting && ` (Weight: ${option.weight})`}
                        </option>
                      ))}
                    </select>
                  )}
                  
                  {formData.type === 'multiselect' && formData.options && (
                    <div className="space-y-2">
                      {formData.options.map((option, index) => (
                        <label key={index} className="flex items-center">
                          <input
                            type="checkbox"
                            disabled
                            className="rounded border-gray-300 bg-gray-100"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            {option.text}
                            {formData.hasWeighting && (
                              <span className="text-xs text-gray-500 ml-1">(Weight: {option.weight})</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  
                  {formData.type === 'scale' && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">1</span>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        disabled
                        className="flex-1"
                      />
                      <span className="text-sm text-gray-600">10</span>
                    </div>
                  )}
                  
                  {formData.type === 'boolean' && (
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="preview"
                          disabled
                          className="rounded border-gray-300 bg-gray-100"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          Yes
                          {formData.hasWeighting && (
                            <span className="text-xs text-gray-500 ml-1">(Weight: 10)</span>
                          )}
                        </span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="preview"
                          disabled
                          className="rounded border-gray-300 bg-gray-100"
                        />
                        <span className="ml-2 text-sm text-gray-700">
                          No
                          {formData.hasWeighting && (
                            <span className="text-xs text-gray-500 ml-1">(Weight: 1)</span>
                          )}
                        </span>
                      </label>
                    </div>
                  )}
                  
                  {formData.type === 'date' && (
                    <input
                      type="date"
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                    />
                  )}
                  
                  {formData.type === 'time' && (
                    <input
                      type="time"
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-end space-x-4 pt-6 border-t">
              <Link
                href="/questions/library"
                className="px-6 py-3 text-gray-700 bg-gray-200 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting || !formData.text.trim()}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Creating...' : 'Create Question'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 