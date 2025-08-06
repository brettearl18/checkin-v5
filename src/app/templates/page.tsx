'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Template {
  id: string;
  title: string;
  description: string;
  category: string;
  estimatedTime: string;
  questionCount: number;
  tags: string[];
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  isPopular: boolean;
  preview: string[];
}

const templates: Template[] = [
  {
    id: 'weekly-wellness',
    title: 'Weekly Wellness Check-in',
    description: 'Comprehensive weekly health and wellness assessment covering nutrition, exercise, sleep, and stress levels.',
    category: 'Wellness',
    estimatedTime: '5-7 minutes',
    questionCount: 12,
    tags: ['nutrition', 'exercise', 'sleep', 'stress', 'weekly'],
    difficulty: 'Beginner',
    isPopular: true,
    preview: [
      'How would you rate your overall energy level this week?',
      'Did you meet your nutrition goals this week?',
      'How many days did you exercise this week?',
      'How would you rate your sleep quality?'
    ]
  },
  {
    id: 'nutrition-focus',
    title: 'Nutrition & Hydration Tracker',
    description: 'Detailed nutrition assessment focusing on meal planning, hydration, and dietary adherence.',
    category: 'Nutrition',
    estimatedTime: '8-10 minutes',
    questionCount: 15,
    tags: ['nutrition', 'hydration', 'meal-planning', 'dietary-adherence'],
    difficulty: 'Intermediate',
    isPopular: false,
    preview: [
      'How many glasses of water did you drink today?',
      'Did you follow your meal plan today?',
      'How would you rate your hunger levels throughout the day?',
      'Did you consume your recommended protein intake?'
    ]
  },
  {
    id: 'fitness-progress',
    title: 'Fitness Progress Assessment',
    description: 'Track fitness goals, workout consistency, strength gains, and performance metrics.',
    category: 'Fitness',
    estimatedTime: '6-8 minutes',
    questionCount: 14,
    tags: ['fitness', 'strength', 'performance', 'workout-consistency'],
    difficulty: 'Intermediate',
    isPopular: true,
    preview: [
      'How many workouts did you complete this week?',
      'Did you achieve your strength training goals?',
      'How would you rate your workout intensity?',
      'Are you experiencing any muscle soreness or fatigue?'
    ]
  },
  {
    id: 'stress-management',
    title: 'Stress & Recovery Monitor',
    description: 'Assess stress levels, recovery quality, and mental wellness indicators.',
    category: 'Mental Health',
    estimatedTime: '4-6 minutes',
    questionCount: 10,
    tags: ['stress', 'recovery', 'mental-health', 'wellness'],
    difficulty: 'Beginner',
    isPopular: false,
    preview: [
      'How would you rate your stress level this week?',
      'Did you practice any stress management techniques?',
      'How would you rate your mood overall?',
      'Did you take time for self-care activities?'
    ]
  },
  {
    id: 'sleep-quality',
    title: 'Sleep Quality Assessment',
    description: 'Comprehensive sleep tracking including duration, quality, and factors affecting sleep.',
    category: 'Sleep',
    estimatedTime: '3-5 minutes',
    questionCount: 8,
    tags: ['sleep', 'recovery', 'wellness', 'health'],
    difficulty: 'Beginner',
    isPopular: false,
    preview: [
      'How many hours did you sleep last night?',
      'How would you rate your sleep quality?',
      'Did you follow your bedtime routine?',
      'Were there any factors that disturbed your sleep?'
    ]
  },
  {
    id: 'goal-progress',
    title: 'Goal Progress Review',
    description: 'Track progress toward specific health and fitness goals with detailed metrics.',
    category: 'Goal Tracking',
    estimatedTime: '7-9 minutes',
    questionCount: 16,
    tags: ['goals', 'progress', 'metrics', 'tracking'],
    difficulty: 'Advanced',
    isPopular: true,
    preview: [
      'How would you rate your progress toward your main goal?',
      'What obstacles did you encounter this week?',
      'Did you complete your weekly action items?',
      'What adjustments do you need to make to stay on track?'
    ]
  },
  {
    id: 'lifestyle-habits',
    title: 'Lifestyle Habits Check',
    description: 'Monitor daily habits, routines, and lifestyle factors affecting overall health.',
    category: 'Lifestyle',
    estimatedTime: '5-7 minutes',
    questionCount: 11,
    tags: ['habits', 'lifestyle', 'routines', 'daily-practices'],
    difficulty: 'Beginner',
    isPopular: false,
    preview: [
      'Did you maintain your morning routine today?',
      'How many steps did you take today?',
      'Did you limit screen time before bed?',
      'Did you practice any mindfulness or meditation?'
    ]
  },
  {
    id: 'injury-prevention',
    title: 'Injury Prevention & Mobility',
    description: 'Assess mobility, flexibility, and identify potential injury risk factors.',
    category: 'Injury Prevention',
    estimatedTime: '6-8 minutes',
    questionCount: 13,
    tags: ['mobility', 'flexibility', 'injury-prevention', 'recovery'],
    difficulty: 'Intermediate',
    isPopular: false,
    preview: [
      'How would you rate your overall mobility today?',
      'Are you experiencing any pain or discomfort?',
      'Did you complete your mobility/stretching routine?',
      'How would you rate your flexibility compared to last week?'
    ]
  }
];

const categories = ['All', 'Wellness', 'Nutrition', 'Fitness', 'Mental Health', 'Sleep', 'Goal Tracking', 'Lifestyle', 'Injury Prevention'];
const difficulties = ['All', 'Beginner', 'Intermediate', 'Advanced'];

export default function TemplatesPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredTemplates, setFilteredTemplates] = useState(templates);

  useEffect(() => {
    let filtered = templates;

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(template => template.category === selectedCategory);
    }

    // Filter by difficulty
    if (selectedDifficulty !== 'All') {
      filtered = filtered.filter(template => template.difficulty === selectedDifficulty);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(template =>
        template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredTemplates(filtered);
  }, [selectedCategory, selectedDifficulty, searchTerm]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'bg-green-100 text-green-800';
      case 'Intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'Advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      'Wellness': 'bg-blue-100 text-blue-800',
      'Nutrition': 'bg-green-100 text-green-800',
      'Fitness': 'bg-purple-100 text-purple-800',
      'Mental Health': 'bg-pink-100 text-pink-800',
      'Sleep': 'bg-indigo-100 text-indigo-800',
      'Goal Tracking': 'bg-orange-100 text-orange-800',
      'Lifestyle': 'bg-teal-100 text-teal-800',
      'Injury Prevention': 'bg-red-100 text-red-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">📋 Form Templates</h1>
              <p className="text-gray-600 mt-2">Pre-built templates to help you create check-in forms quickly</p>
            </div>
            <Link
              href="/forms/create"
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create Custom Form
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-2xl font-bold text-blue-600">{templates.length}</div>
              <div className="text-sm text-gray-600">Total Templates</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-2xl font-bold text-green-600">{templates.filter(t => t.isPopular).length}</div>
              <div className="text-sm text-gray-600">Popular Templates</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-2xl font-bold text-purple-600">{categories.length - 1}</div>
              <div className="text-sm text-gray-600">Categories</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="text-2xl font-bold text-orange-600">{templates.reduce((sum, t) => sum + t.questionCount, 0)}</div>
              <div className="text-sm text-gray-600">Total Questions</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Templates</label>
              <input
                type="text"
                placeholder="Search by title, description, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            {/* Difficulty Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {difficulties.map(difficulty => (
                  <option key={difficulty} value={difficulty}>{difficulty}</option>
                ))}
              </select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSelectedCategory('All');
                  setSelectedDifficulty('All');
                  setSearchTerm('');
                }}
                className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <div key={template.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
              {/* Template Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{template.title}</h3>
                    <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                  </div>
                  {template.isPopular && (
                    <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                      Popular
                    </span>
                  )}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(template.category)}`}>
                    {template.category}
                  </span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyColor(template.difficulty)}`}>
                    {template.difficulty}
                  </span>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>⏱️ {template.estimatedTime}</span>
                  <span>❓ {template.questionCount} questions</span>
                </div>
              </div>

              {/* Template Preview */}
              <div className="p-6">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Sample Questions:</h4>
                <ul className="space-y-2 mb-4">
                  {template.preview.map((question, index) => (
                    <li key={index} className="text-sm text-gray-600 flex items-start">
                      <span className="text-gray-400 mr-2">•</span>
                      <span className="line-clamp-2">{question}</span>
                    </li>
                  ))}
                </ul>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <button className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors">
                    Use Template
                  </button>
                  <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-md transition-colors">
                    Preview
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* No Results */}
        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
            <p className="text-gray-600">Try adjusting your filters or search terms.</p>
          </div>
        )}
      </div>
    </div>
  );
} 