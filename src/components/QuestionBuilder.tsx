'use client';

import { useState } from 'react';
import { CustomQuestion } from '@/lib/types';

interface QuestionBuilderProps {
  onSave: (question: Omit<CustomQuestion, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  initialQuestion?: Partial<CustomQuestion>;
  coachId: string;
}

export default function QuestionBuilder({ onSave, onCancel, initialQuestion, coachId }: QuestionBuilderProps) {
  const [question, setQuestion] = useState<Partial<CustomQuestion>>({
    coachId,
    text: '',
    type: 'text',
    weight: 5,
    category: 'custom',
    required: false,
    options: [],
    scoring: {
      positive: 10,
      negative: 0,
      neutral: 5
    },
    tags: [],
    isActive: true,
    ...initialQuestion
  });

  const [newOption, setNewOption] = useState('');
  const [newTag, setNewTag] = useState('');

  const questionTypes = [
    { value: 'text', label: 'Text Input', description: 'Free text response' },
    { value: 'number', label: 'Number Input', description: 'Numeric response' },
    { value: 'scale', label: 'Scale (1-10)', description: 'Rating scale' },
    { value: 'select', label: 'Single Choice', description: 'One option from list' },
    { value: 'multiple-choice', label: 'Multiple Choice', description: 'Multiple options' },
    { value: 'checkbox', label: 'Checkbox', description: 'Yes/No response' }
  ];

  const categories = [
    { value: 'health', label: 'Health', color: 'bg-red-100 text-red-800' },
    { value: 'lifestyle', label: 'Lifestyle', color: 'bg-blue-100 text-blue-800' },
    { value: 'goals', label: 'Goals', color: 'bg-green-100 text-green-800' },
    { value: 'motivation', label: 'Motivation', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'risk', label: 'Risk Assessment', color: 'bg-purple-100 text-purple-800' },
    { value: 'custom', label: 'Custom', color: 'bg-gray-100 text-gray-800' }
  ];

  const handleSave = () => {
    if (!question.text || !question.type) {
      alert('Please fill in all required fields');
      return;
    }

    const questionData: Omit<CustomQuestion, 'id' | 'createdAt' | 'updatedAt'> = {
      coachId,
      text: question.text,
      type: question.type,
      weight: question.weight || 5,
      category: question.category || 'custom',
      required: question.required || false,
      options: question.options || [],
      scoring: question.scoring,
      tags: question.tags || [],
      isActive: question.isActive || true
    };

    onSave(questionData);
  };

  const addOption = () => {
    if (newOption.trim() && question.options) {
      setQuestion({
        ...question,
        options: [...question.options, newOption.trim()]
      });
      setNewOption('');
    }
  };

  const removeOption = (index: number) => {
    if (question.options) {
      setQuestion({
        ...question,
        options: question.options.filter((_, i) => i !== index)
      });
    }
  };

  const addTag = () => {
    if (newTag.trim() && question.tags) {
      setQuestion({
        ...question,
        tags: [...question.tags, newTag.trim()]
      });
      setNewTag('');
    }
  };

  const removeTag = (index: number) => {
    if (question.tags) {
      setQuestion({
        ...question,
        tags: question.tags.filter((_, i) => i !== index)
      });
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {initialQuestion ? 'Edit Question' : 'Create New Question'}
        </h2>
        <p className="text-gray-800">
          Build custom questions with weighted scoring for better client insights
        </p>
      </div>

      <div className="space-y-6">
        {/* Question Text */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Question Text *
          </label>
          <textarea
            value={question.text}
            onChange={(e) => setQuestion({ ...question, text: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            rows={3}
            placeholder="Enter your question here..."
          />
        </div>

        {/* Question Type */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Question Type *
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {questionTypes.map((type) => (
              <label
                key={type.value}
                className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${
                  question.type === type.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="questionType"
                  value={type.value}
                  checked={question.type === type.value}
                  onChange={(e) => setQuestion({ ...question, type: e.target.value as any })}
                  className="sr-only"
                />
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center">
                    <div className="text-sm">
                      <p className="font-medium text-gray-900">{type.label}</p>
                      <p className="text-gray-500">{type.description}</p>
                    </div>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Weight */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Question Weight: {question.weight || 5}/10
          </label>
          <input
            type="range"
            min="1"
            max="10"
            value={question.weight || 5}
            onChange={(e) => setQuestion({ ...question, weight: parseInt(e.target.value) })}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Low Impact</span>
            <span>High Impact</span>
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Category
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {categories.map((category) => (
              <button
                key={category.value}
                type="button"
                onClick={() => setQuestion({ ...question, category: category.value as any })}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  question.category === category.value
                    ? category.color
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>

        {/* Options for select/multiple-choice */}
        {(question.type === 'select' || question.type === 'multiple-choice') && (
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Options
            </label>
            <div className="space-y-2">
              {question.options?.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <span className="flex-1 px-3 py-2 bg-gray-50 rounded-md">{option}</span>
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  placeholder="Add new option..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={addOption}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scoring */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Scoring (for risk assessment)
          </label>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Positive Score</label>
              <input
                type="number"
                value={question.scoring?.positive || 10}
                onChange={(e) => setQuestion({
                  ...question,
                  scoring: { ...question.scoring, positive: parseInt(e.target.value) }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Neutral Score</label>
              <input
                type="number"
                value={question.scoring?.neutral || 5}
                onChange={(e) => setQuestion({
                  ...question,
                  scoring: { ...question.scoring, neutral: parseInt(e.target.value) }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Negative Score</label>
              <input
                type="number"
                value={question.scoring?.negative || 0}
                onChange={(e) => setQuestion({
                  ...question,
                  scoring: { ...question.scoring, negative: parseInt(e.target.value) }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Tags
          </label>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {question.tags?.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(index)}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add tag..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Required */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="required"
            checked={question.required || false}
            onChange={(e) => setQuestion({ ...question, required: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="required" className="ml-2 block text-sm text-gray-900">
            This question is required
          </label>
        </div>

        {/* Active */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="active"
            checked={question.isActive || true}
            onChange={(e) => setQuestion({ ...question, isActive: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="active" className="ml-2 block text-sm text-gray-900">
            This question is active
          </label>
        </div>
      </div>

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
          {initialQuestion ? 'Update Question' : 'Create Question'}
        </button>
      </div>
    </div>
  );
} 