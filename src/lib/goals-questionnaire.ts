// 2026 Goals Questionnaire Questions
// This file contains all goal-setting questions organized by section

export interface GoalsQuestionnaireQuestion {
  id: string;
  section: number;
  sectionName: string;
  order: number;
  questionText: string;
  questionType: 'number' | 'text' | 'textarea' | 'multiple_choice' | 'scale' | 'yes_no';
  required: boolean;
  options?: string[];
  conditionalLogic?: {
    dependsOn: string; // questionId
    condition: 'equals' | 'contains' | 'selected';
    value: any;
  };
  placeholder?: string;
}

export const GOALS_QUESTIONNAIRE_SECTIONS = [
  { id: 1, name: 'Your 2026 Vision', icon: '🎯', description: 'What do you want to achieve this year?' },
  { id: 2, name: 'Fitness Goals', icon: '💪', description: 'Set your fitness targets' },
  { id: 3, name: 'Nutrition Goals', icon: '🍎', description: 'Plan your nutrition journey' },
  { id: 4, name: 'Wellness Goals', icon: '🧘', description: 'Focus on mental health & wellbeing' },
  { id: 5, name: 'Your Commitment', icon: '💝', description: 'What will keep you motivated?' },
  { id: 6, name: 'Take the Next Steps', icon: '🚀', description: 'Ready to start your journey?' },
];

export const GOALS_QUESTIONNAIRE_QUESTIONS: GoalsQuestionnaireQuestion[] = [
  // SECTION 1: Your 2026 Vision
  {
    id: 'vision-1',
    section: 1,
    sectionName: 'Your 2026 Vision',
    order: 1,
    questionText: 'What areas do you want to focus on in 2026?',
    questionType: 'multiple_choice',
    required: true,
    options: [
      'Weight management (lose/gain/maintain)',
      'Strength & muscle building',
      'Cardiovascular fitness',
      'Nutrition & eating habits',
      'Mental health & stress management',
      'Sleep quality',
      'Energy & vitality',
      'Flexibility & mobility',
      'General wellness & lifestyle',
    ],
  },
  {
    id: 'vision-2',
    section: 1,
    sectionName: 'Your 2026 Vision',
    order: 2,
    questionText: 'What would success look like for you by the end of 2026?',
    questionType: 'textarea',
    required: true,
    placeholder: 'Describe your vision of yourself in December 2026. What will you have achieved? How will you feel? What will be different?',
  },
  {
    id: 'vision-3',
    section: 1,
    sectionName: 'Your 2026 Vision',
    order: 3,
    questionText: 'Why are these goals important to you?',
    questionType: 'textarea',
    required: true,
    placeholder: 'What deeper reason drives you to achieve these goals? What will achieving them mean for your life?',
  },

  // SECTION 2: Fitness Goals (shown if fitness-related options selected)
  {
    id: 'fitness-1',
    section: 2,
    sectionName: 'Fitness Goals',
    order: 1,
    questionText: 'What is your primary fitness goal?',
    questionType: 'multiple_choice',
    required: false,
    options: [
      'Lose weight',
      'Gain weight/muscle',
      'Improve strength',
      'Improve endurance/cardio',
      'Improve flexibility',
      'Maintain current fitness level',
    ],
    conditionalLogic: {
      dependsOn: 'vision-1',
      condition: 'contains',
      value: ['Weight management (lose/gain/maintain)', 'Strength & muscle building', 'Cardiovascular fitness', 'Flexibility & mobility'],
    },
  },
  {
    id: 'fitness-2',
    section: 2,
    sectionName: 'Fitness Goals',
    order: 2,
    questionText: 'What is your target?',
    questionType: 'text',
    required: false,
    placeholder: 'e.g., "Lose 10kg", "Run 5km in 25 minutes", "Bench press 100kg"',
    conditionalLogic: {
      dependsOn: 'fitness-1',
      condition: 'selected',
      value: true,
    },
  },
  {
    id: 'fitness-3',
    section: 2,
    sectionName: 'Fitness Goals',
    order: 3,
    questionText: 'What is your current starting point?',
    questionType: 'text',
    required: false,
    placeholder: 'e.g., "Currently 85kg", "Can run 3km in 20 minutes", "Can bench press 70kg"',
    conditionalLogic: {
      dependsOn: 'fitness-2',
      condition: 'selected',
      value: true,
    },
  },
  {
    id: 'fitness-4',
    section: 2,
    sectionName: 'Fitness Goals',
    order: 4,
    questionText: 'By when do you want to achieve this goal?',
    questionType: 'text',
    required: false,
    placeholder: 'e.g., "June 2026", "End of year", "3 months from now"',
    conditionalLogic: {
      dependsOn: 'fitness-2',
      condition: 'selected',
      value: true,
    },
  },

  // SECTION 3: Nutrition Goals (shown if nutrition selected)
  {
    id: 'nutrition-1',
    section: 3,
    sectionName: 'Nutrition Goals',
    order: 1,
    questionText: 'What is your primary nutrition goal?',
    questionType: 'multiple_choice',
    required: false,
    options: [
      'Eat healthier/more balanced meals',
      'Meal planning/consistency',
      'Increase protein intake',
      'Reduce processed foods',
      'Increase vegetables/fruits',
      'Portion control',
      'Improve hydration',
    ],
    conditionalLogic: {
      dependsOn: 'vision-1',
      condition: 'contains',
      value: 'Nutrition & eating habits',
    },
  },
  {
    id: 'nutrition-2',
    section: 3,
    sectionName: 'Nutrition Goals',
    order: 2,
    questionText: 'What is your specific target?',
    questionType: 'text',
    required: false,
    placeholder: 'e.g., "Eat 5 servings of vegetables per day", "Drink 2L of water daily", "Eat 150g protein per day"',
    conditionalLogic: {
      dependsOn: 'nutrition-1',
      condition: 'selected',
      value: true,
    },
  },
  {
    id: 'nutrition-3',
    section: 3,
    sectionName: 'Nutrition Goals',
    order: 3,
    questionText: 'What is your current starting point?',
    questionType: 'text',
    required: false,
    placeholder: 'e.g., "Currently eat 2 servings of vegetables", "Drink 1L water daily"',
    conditionalLogic: {
      dependsOn: 'nutrition-2',
      condition: 'selected',
      value: true,
    },
  },
  {
    id: 'nutrition-4',
    section: 3,
    sectionName: 'Nutrition Goals',
    order: 4,
    questionText: 'By when do you want to achieve this goal?',
    questionType: 'text',
    required: false,
    placeholder: 'e.g., "June 2026", "End of year"',
    conditionalLogic: {
      dependsOn: 'nutrition-2',
      condition: 'selected',
      value: true,
    },
  },

  // SECTION 4: Wellness Goals (shown if mental health/sleep/energy selected)
  {
    id: 'wellness-1',
    section: 4,
    sectionName: 'Wellness Goals',
    order: 1,
    questionText: 'What is your primary wellness goal?',
    questionType: 'multiple_choice',
    required: false,
    options: [
      'Reduce stress levels',
      'Improve mood/mental wellbeing',
      'Better work-life balance',
      'Practice mindfulness/meditation',
      'Improve sleep quality',
      'Increase energy levels',
      'Improve self-care routine',
    ],
    conditionalLogic: {
      dependsOn: 'vision-1',
      condition: 'contains',
      value: ['Mental health & stress management', 'Sleep quality', 'Energy & vitality'],
    },
  },
  {
    id: 'wellness-2',
    section: 4,
    sectionName: 'Wellness Goals',
    order: 2,
    questionText: 'What is your specific target?',
    questionType: 'text',
    required: false,
    placeholder: 'e.g., "Meditate 30 minutes per week", "Sleep 8 hours per night", "Keep stress level below 5/10"',
    conditionalLogic: {
      dependsOn: 'wellness-1',
      condition: 'selected',
      value: true,
    },
  },
  {
    id: 'wellness-3',
    section: 4,
    sectionName: 'Wellness Goals',
    order: 3,
    questionText: 'What is your current starting point?',
    questionType: 'text',
    required: false,
    placeholder: 'e.g., "Currently sleep 6 hours", "Stress level is 8/10"',
    conditionalLogic: {
      dependsOn: 'wellness-2',
      condition: 'selected',
      value: true,
    },
  },
  {
    id: 'wellness-4',
    section: 4,
    sectionName: 'Wellness Goals',
    order: 4,
    questionText: 'By when do you want to achieve this goal?',
    questionType: 'text',
    required: false,
    placeholder: 'e.g., "June 2026", "End of year"',
    conditionalLogic: {
      dependsOn: 'wellness-2',
      condition: 'selected',
      value: true,
    },
  },

  // SECTION 5: Your Commitment
  {
    id: 'commitment-1',
    section: 5,
    sectionName: 'Your Commitment',
    order: 1,
    questionText: 'On a scale of 1-10, how committed are you to achieving these goals?',
    questionType: 'scale',
    required: true,
  },
  {
    id: 'commitment-2',
    section: 5,
    sectionName: 'Your Commitment',
    order: 2,
    questionText: 'What are the biggest challenges you anticipate?',
    questionType: 'textarea',
    required: false,
    placeholder: 'Time constraints, motivation, knowledge, support, etc.',
  },
  {
    id: 'commitment-3',
    section: 5,
    sectionName: 'Your Commitment',
    order: 3,
    questionText: 'What support do you need from your coach?',
    questionType: 'textarea',
    required: false,
    placeholder: 'How can your coach best help you achieve these goals?',
  },

  // SECTION 6: Take the Next Steps
  {
    id: 'nextsteps-1',
    section: 6,
    sectionName: 'Take the Next Steps',
    order: 1,
    questionText: 'What is your first action step to get started?',
    questionType: 'textarea',
    required: true,
    placeholder: 'Describe the first concrete action you will take in the next week to start working toward these goals.',
  },
  {
    id: 'nextsteps-2',
    section: 6,
    sectionName: 'Take the Next Steps',
    order: 2,
    questionText: 'When will you take this first step?',
    questionType: 'text',
    required: true,
    placeholder: 'e.g., "This Saturday", "Monday morning", "Within 3 days"',
  },
  {
    id: 'nextsteps-3',
    section: 6,
    sectionName: 'Take the Next Steps',
    order: 3,
    questionText: 'What might get in your way, and how will you handle it?',
    questionType: 'textarea',
    required: false,
    placeholder: 'Think about potential obstacles and your plan to overcome them.',
  },
  {
    id: 'nextsteps-4',
    section: 6,
    sectionName: 'Take the Next Steps',
    order: 4,
    questionText: 'How will you celebrate small wins along the way?',
    questionType: 'textarea',
    required: false,
    placeholder: 'Rewards and celebrations help maintain motivation. How will you acknowledge your progress?',
  },
];

// Helper function to get questions by section
export function getGoalsQuestionsBySection(section: number, responses: Record<string, any> = {}): GoalsQuestionnaireQuestion[] {
  let questions = GOALS_QUESTIONNAIRE_QUESTIONS.filter(q => q.section === section);
  
  // Filter by conditional logic
  questions = questions.filter(question => {
    if (!question.conditionalLogic) return true;
    
    const { dependsOn, condition, value } = question.conditionalLogic;
    const dependentValue = responses[dependsOn];
    
    if (!dependentValue) return false;
    
    switch (condition) {
      case 'contains':
        if (Array.isArray(dependentValue)) {
          if (Array.isArray(value)) {
            return value.some(v => dependentValue.includes(v));
          }
          // Check if the string value is in the array
          return dependentValue.includes(value);
        }
        // If dependentValue is a string, check if it equals the value
        if (typeof dependentValue === 'string' && typeof value === 'string') {
          return dependentValue === value;
        }
        return false;
      case 'selected':
        return dependentValue !== undefined && dependentValue !== null && dependentValue !== '';
      case 'equals':
        return dependentValue === value;
      default:
        return true;
    }
  });
  
  return questions.sort((a, b) => a.order - b.order);
}

// Helper to extract numeric value and unit from text
export function parseGoalTarget(text: string): { value: number | null; unit: string; description: string } {
  if (!text) return { value: null, unit: '', description: text };
  
  // Try to extract number and unit patterns
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(kg|kgm|kilograms|lbs|pounds|lb)/i,
    /(\d+(?:\.\d+)?)\s*(km|kilometers|miles|mi|meters?|m)/i,
    /(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?|days?)/i,
    /(\d+(?:\/\d+)?)\s*(reps?|sets?|times?|servings?)/i,
    /(\d+(?:\.\d+)?)\s*(l|liters?|litres?|ml|milliliters?|cups?|glasses?)/i,
    /(\d+(?:\.\d+)?)\s*(g|grams?)/i,
    /(\d+(?:\.\d+)?)\s*(\/10|\/100|percent|%)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1].replace('/', '.'));
      const unit = match[2].toLowerCase();
      return { value, unit, description: text };
    }
  }
  
  // Fallback: try to extract just a number
  const numberMatch = text.match(/(\d+(?:\.\d+)?)/);
  if (numberMatch) {
    return { value: parseFloat(numberMatch[1]), unit: '', description: text };
  }
  
  return { value: null, unit: '', description: text };
}

