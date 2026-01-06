// Onboarding Questionnaire Questions - 10 Sections
// This file contains all onboarding questions organized by section
// Section 10: Letter to Your Future Self - A motivational note to help clients stay connected to their goals

export interface OnboardingQuestion {
  id: string;
  section: number;
  sectionName: string;
  order: number;
  questionText: string;
  questionType: 'number' | 'text' | 'textarea' | 'multiple_choice' | 'scale' | 'yes_no';
  required: boolean;
  options?: string[];
  scaleConfig?: {
    min: number;
    max: number;
    labelMin?: string;
    labelMax?: string;
  };
  conditionalLogic?: {
    dependsOn: string; // questionId
    condition: 'equals' | 'contains' | 'greater_than' | 'less_than';
    value: any;
  };
  followUpQuestion?: {
    questionText: string;
    questionType: 'number' | 'text' | 'textarea' | 'multiple_choice';
    options?: string[];
  };
}

export const ONBOARDING_SECTIONS = [
  { id: 1, name: 'Personal Information & Demographics', icon: '👤' },
  { id: 2, name: 'Health History & Current Status', icon: '🏥' },
  { id: 3, name: 'Fitness & Activity Levels', icon: '💪' },
  { id: 4, name: 'Nutrition & Eating Habits', icon: '🍎' },
  { id: 5, name: 'Goals & Objectives', icon: '🎯' },
  { id: 6, name: 'Motivation & Mindset', icon: '💭' },
  { id: 7, name: 'Lifestyle Factors', icon: '🌱' },
  { id: 8, name: 'Preferences & Communication', icon: '📱' },
  { id: 9, name: 'Barriers & Challenges', icon: '🚧' },
  { id: 10, name: 'Letter to Your Future Self', icon: '💌' },
];

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  // SECTION 1: Personal Information & Demographics
  {
    id: 'q1-1',
    section: 1,
    sectionName: 'Personal Information & Demographics',
    order: 1,
    questionText: 'What is your age?',
    questionType: 'number',
    required: true,
  },
  {
    id: 'q1-2',
    section: 1,
    sectionName: 'Personal Information & Demographics',
    order: 2,
    questionText: 'What is your gender?',
    questionType: 'multiple_choice',
    required: true,
    options: ['Male', 'Female', 'Non-binary', 'Prefer not to say'],
  },
  {
    id: 'q1-3',
    section: 1,
    sectionName: 'Personal Information & Demographics',
    order: 3,
    questionText: 'What is your occupation?',
    questionType: 'text',
    required: false,
  },
  {
    id: 'q1-4',
    section: 1,
    sectionName: 'Personal Information & Demographics',
    order: 4,
    questionText: 'What best describes your work schedule?',
    questionType: 'multiple_choice',
    required: true,
    options: ['9-5 Office', 'Work from Home', 'Stay at Home', 'Shift Work', 'Remote/FIFO', 'Retired', 'Other'],
  },
  {
    id: 'q1-5',
    section: 1,
    sectionName: 'Personal Information & Demographics',
    order: 5,
    questionText: 'Do you have dependents (children, elderly parents, etc.)?',
    questionType: 'yes_no',
    required: true,
    followUpQuestion: {
      questionText: 'How many dependents?',
      questionType: 'number',
    },
  },

  // SECTION 2: Health History & Current Status
  {
    id: 'q2-1',
    section: 2,
    sectionName: 'Health History & Current Status',
    order: 1,
    questionText: 'Do you have any current health conditions or medical diagnoses?',
    questionType: 'yes_no',
    required: true,
    followUpQuestion: {
      questionText: 'Please list your health conditions:',
      questionType: 'textarea',
    },
  },
  {
    id: 'q2-2',
    section: 2,
    sectionName: 'Health History & Current Status',
    order: 2,
    questionText: 'Are you currently taking any medications or supplements?',
    questionType: 'yes_no',
    required: true,
    followUpQuestion: {
      questionText: 'Please list medications/supplements:',
      questionType: 'textarea',
    },
  },
  {
    id: 'q2-3',
    section: 2,
    sectionName: 'Health History & Current Status',
    order: 3,
    questionText: 'Have you had any major surgeries or injuries in the past 2 years?',
    questionType: 'yes_no',
    required: true,
    followUpQuestion: {
      questionText: 'Please describe:',
      questionType: 'textarea',
    },
  },
  {
    id: 'q2-4',
    section: 2,
    sectionName: 'Health History & Current Status',
    order: 4,
    questionText: 'Is there a family history of any of the following? (Select all that apply)',
    questionType: 'multiple_choice',
    required: true,
    options: ['Diabetes', 'Heart Disease', 'High Blood Pressure', 'Obesity', 'Mental Health Issues', 'Cancer', 'None', 'Prefer not to say'],
  },
  {
    id: 'q2-5',
    section: 2,
    sectionName: 'Health History & Current Status',
    order: 5,
    questionText: 'Do you experience any chronic pain or physical limitations?',
    questionType: 'yes_no',
    required: true,
    followUpQuestion: {
      questionText: 'Please describe:',
      questionType: 'textarea',
    },
  },
  {
    id: 'q2-6',
    section: 2,
    sectionName: 'Health History & Current Status',
    order: 6,
    questionText: 'How would you rate your overall energy levels?',
    questionType: 'scale',
    required: true,
    scaleConfig: {
      min: 1,
      max: 10,
      labelMin: 'Very Low Energy',
      labelMax: 'Very High Energy',
    },
  },
  {
    id: 'q2-7',
    section: 2,
    sectionName: 'Health History & Current Status',
    order: 7,
    questionText: 'How many hours of sleep do you typically get per night?',
    questionType: 'number',
    required: true,
  },
  {
    id: 'q2-8',
    section: 2,
    sectionName: 'Health History & Current Status',
    order: 8,
    questionText: 'How would you rate your sleep quality?',
    questionType: 'scale',
    required: true,
    scaleConfig: {
      min: 1,
      max: 10,
      labelMin: 'Very Poor',
      labelMax: 'Excellent',
    },
  },

  // SECTION 3: Fitness & Activity Levels
  {
    id: 'q3-1',
    section: 3,
    sectionName: 'Fitness & Activity Levels',
    order: 1,
    questionText: 'How would you describe your current activity level?',
    questionType: 'multiple_choice',
    required: true,
    options: ['Sedentary (little to no exercise)', 'Lightly Active (1-3 days/week)', 'Moderately Active (3-5 days/week)', 'Very Active (6-7 days/week)', 'Extremely Active (physical job + exercise)'],
  },
  {
    id: 'q3-2',
    section: 3,
    sectionName: 'Fitness & Activity Levels',
    order: 2,
    questionText: 'What types of exercise do you currently do? (Select all that apply)',
    questionType: 'multiple_choice',
    required: true,
    options: ['Cardio (running, cycling, etc.)', 'Strength Training', 'Yoga/Pilates', 'Sports', 'Walking', 'Swimming', 'Dancing', 'None', 'Other'],
  },
  {
    id: 'q3-3',
    section: 3,
    sectionName: 'Fitness & Activity Levels',
    order: 3,
    questionText: 'How many days per week do you currently exercise?',
    questionType: 'number',
    required: true,
  },
  {
    id: 'q3-4',
    section: 3,
    sectionName: 'Fitness & Activity Levels',
    order: 4,
    questionText: 'How long is your typical workout session?',
    questionType: 'multiple_choice',
    required: true,
    options: ['Less than 30 minutes', '30-45 minutes', '45-60 minutes', '60-90 minutes', 'More than 90 minutes', "I don't currently exercise"],
  },
  {
    id: 'q3-5',
    section: 3,
    sectionName: 'Fitness & Activity Levels',
    order: 5,
    questionText: 'What is your experience level with fitness?',
    questionType: 'multiple_choice',
    required: true,
    options: ['Complete Beginner', 'Some Experience', 'Intermediate', 'Advanced', 'Very Advanced'],
  },
  {
    id: 'q3-6',
    section: 3,
    sectionName: 'Fitness & Activity Levels',
    order: 6,
    questionText: 'Where do you prefer to exercise? (Select all that apply)',
    questionType: 'multiple_choice',
    required: true,
    options: ['Gym', 'Home', 'Outdoors', 'Group Classes', 'Online/App-based', 'No preference'],
  },

  // SECTION 4: Nutrition & Eating Habits
  {
    id: 'q4-1',
    section: 4,
    sectionName: 'Nutrition & Eating Habits',
    order: 1,
    questionText: 'How many meals do you typically eat per day?',
    questionType: 'number',
    required: true,
  },
  {
    id: 'q4-2',
    section: 4,
    sectionName: 'Nutrition & Eating Habits',
    order: 2,
    questionText: 'Do you follow any specific dietary preferences or restrictions? (Select all that apply)',
    questionType: 'multiple_choice',
    required: true,
    options: ['None', 'Vegetarian', 'Vegan', 'Paleo', 'Keto', 'Gluten-free', 'Dairy-free', 'Halal', 'Kosher', 'Food Allergies', 'Other'],
  },
  {
    id: 'q4-3',
    section: 4,
    sectionName: 'Nutrition & Eating Habits',
    order: 3,
    questionText: 'How would you rate your current nutrition knowledge?',
    questionType: 'scale',
    required: true,
    scaleConfig: {
      min: 1,
      max: 10,
      labelMin: 'No Knowledge',
      labelMax: 'Expert Level',
    },
  },
  {
    id: 'q4-4',
    section: 4,
    sectionName: 'Nutrition & Eating Habits',
    order: 4,
    questionText: 'How often do you cook meals at home?',
    questionType: 'multiple_choice',
    required: true,
    options: ['Never', '1-2 times per week', '3-4 times per week', '5-6 times per week', 'Every day'],
  },
  {
    id: 'q4-5',
    section: 4,
    sectionName: 'Nutrition & Eating Habits',
    order: 5,
    questionText: 'How often do you eat out or order takeout?',
    questionType: 'multiple_choice',
    required: true,
    options: ['Never', '1-2 times per week', '3-4 times per week', '5-6 times per week', 'Every day'],
  },
  {
    id: 'q4-6',
    section: 4,
    sectionName: 'Nutrition & Eating Habits',
    order: 6,
    questionText: 'How many litres of water per day do you drink?',
    questionType: 'number',
    required: true,
  },
  {
    id: 'q4-7',
    section: 4,
    sectionName: 'Nutrition & Eating Habits',
    order: 7,
    questionText: 'What is your biggest challenge with nutrition? (Select all that apply)',
    questionType: 'multiple_choice',
    required: true,
    options: ['Time to prepare meals', 'Knowing what to eat', 'Cost of healthy food', 'Cravings', 'Eating out frequently', 'Lack of motivation', 'No challenges', 'Other'],
  },
  {
    id: 'q4-8',
    section: 4,
    sectionName: 'Nutrition & Eating Habits',
    order: 8,
    questionText: 'Are there any foods you are allergic to? or is a 100% no to eating?',
    questionType: 'textarea',
    required: false,
  },

  // SECTION 5: Goals & Objectives
  {
    id: 'q5-1',
    section: 5,
    sectionName: 'Goals & Objectives',
    order: 1,
    questionText: 'What is your PRIMARY health and wellness goal? (Select one)',
    questionType: 'multiple_choice',
    required: true,
    options: ['Weight Loss', 'Muscle Gain', 'Improve Fitness/Endurance', 'Better Health Markers (blood pressure, cholesterol, etc.)', 'Increase Energy', 'Improve Sleep', 'Reduce Stress', 'General Health & Wellness', 'Injury Recovery', 'Other'],
  },
  {
    id: 'q5-2',
    section: 5,
    sectionName: 'Goals & Objectives',
    order: 2,
    questionText: 'What are your SECONDARY goals? (Select all that apply)',
    questionType: 'multiple_choice',
    required: true,
    options: ['Weight Loss', 'Muscle Gain', 'Improve Fitness/Endurance', 'Better Health Markers', 'Increase Energy', 'Improve Sleep', 'Reduce Stress', 'General Health & Wellness', 'Injury Recovery', 'None'],
  },
  {
    id: 'q5-3',
    section: 5,
    sectionName: 'Goals & Objectives',
    order: 3,
    questionText: 'What is your target timeframe for achieving your primary goal?',
    questionType: 'multiple_choice',
    required: true,
    options: ['1-3 months', '3-6 months', '6-12 months', '12+ months', 'Ongoing lifestyle change'],
  },
  {
    id: 'q5-4',
    section: 5,
    sectionName: 'Goals & Objectives',
    order: 4,
    questionText: 'What is your main motivation for making this change? (select all that apply)',
    questionType: 'multiple_choice',
    required: true,
    options: ['Health reasons', 'Appearance/confidence', 'Performance/athletic goals', 'Life event (wedding, vacation, etc.)', "Doctor's recommendation", 'Family/relationships', 'General self-improvement', 'Other'],
  },
  {
    id: 'q5-5',
    section: 5,
    sectionName: 'Goals & Objectives',
    order: 5,
    questionText: 'Have you tried to achieve similar goals before?',
    questionType: 'yes_no',
    required: true,
    followUpQuestion: {
      questionText: 'What worked or did not work in the past?',
      questionType: 'textarea',
    },
  },

  // SECTION 6: Motivation & Mindset
  {
    id: 'q6-1',
    section: 6,
    sectionName: 'Motivation & Mindset',
    order: 1,
    questionText: 'On a scale of 1-10, how confident are you that you can achieve your goals?',
    questionType: 'scale',
    required: true,
    scaleConfig: {
      min: 1,
      max: 10,
      labelMin: 'Not Confident',
      labelMax: 'Very Confident',
    },
  },
  {
    id: 'q6-2',
    section: 6,
    sectionName: 'Motivation & Mindset',
    order: 2,
    questionText: 'What motivates you most?',
    questionType: 'multiple_choice',
    required: true,
    options: ['Seeing progress/results', 'Feeling better physically', 'Support from others', 'Achieving milestones', 'Proving to myself I can do it', 'Health improvements', 'Other'],
  },
  {
    id: 'q6-3',
    section: 6,
    sectionName: 'Motivation & Mindset',
    order: 3,
    questionText: 'What is your biggest fear or concern about starting this journey?',
    questionType: 'textarea',
    required: false,
  },
  {
    id: 'q6-4',
    section: 6,
    sectionName: 'Motivation & Mindset',
    order: 4,
    questionText: 'How would you describe your support system?',
    questionType: 'multiple_choice',
    required: true,
    options: ['Very Supportive', 'Somewhat Supportive', 'Neutral', 'Somewhat Unsupportive', 'Very Unsupportive', 'No Support System'],
  },

  // SECTION 7: Lifestyle Factors
  {
    id: 'q7-1',
    section: 7,
    sectionName: 'Lifestyle Factors',
    order: 1,
    questionText: 'How would you rate your work-life balance?',
    questionType: 'scale',
    required: true,
    scaleConfig: {
      min: 1,
      max: 10,
      labelMin: 'Poor Balance',
      labelMax: 'Excellent Balance',
    },
  },
  {
    id: 'q7-2',
    section: 7,
    sectionName: 'Lifestyle Factors',
    order: 2,
    questionText: 'How would you rate your current stress levels?',
    questionType: 'scale',
    required: true,
    scaleConfig: {
      min: 1,
      max: 10,
      labelMin: 'No Stress',
      labelMax: 'Extremely Stressed',
    },
  },
  {
    id: 'q7-3',
    section: 7,
    sectionName: 'Lifestyle Factors',
    order: 3,
    questionText: 'What are your main sources of stress? (Select all that apply)',
    questionType: 'multiple_choice',
    required: true,
    options: ['Work', 'Family', 'Financial', 'Health', 'Relationships', 'Time management', 'Other', 'No significant stress'],
  },
  {
    id: 'q7-4',
    section: 7,
    sectionName: 'Lifestyle Factors',
    order: 4,
    questionText: 'How much time can you realistically commit to exercise per week?',
    questionType: 'multiple_choice',
    required: true,
    options: ['Less than 2 hours', '2-4 hours', '4-6 hours', '6-8 hours', 'More than 8 hours'],
  },
  {
    id: 'q7-5',
    section: 7,
    sectionName: 'Lifestyle Factors',
    order: 5,
    questionText: 'How much time can you realistically commit to meal preparation per week?',
    questionType: 'multiple_choice',
    required: true,
    options: ['Less than 2 hours', '2-4 hours', '4-6 hours', '6-8 hours', 'More than 8 hours'],
  },
  {
    id: 'q7-6',
    section: 7,
    sectionName: 'Lifestyle Factors',
    order: 6,
    questionText: 'Do you travel frequently for work or leisure?',
    questionType: 'yes_no',
    required: true,
    followUpQuestion: {
      questionText: 'How often?',
      questionType: 'multiple_choice',
      options: ['Weekly', 'Monthly', 'Quarterly', 'Rarely'],
    },
  },

  // SECTION 8: Preferences & Communication
  {
    id: 'q8-1',
    section: 8,
    sectionName: 'Preferences & Communication',
    order: 1,
    questionText: 'What communication style works best for you?',
    questionType: 'multiple_choice',
    required: true,
    options: ['Direct and straightforward', 'Encouraging and supportive', 'Data-driven and analytical', 'Balanced approach'],
  },
  {
    id: 'q8-2',
    section: 8,
    sectionName: 'Preferences & Communication',
    order: 2,
    questionText: 'Write a short statement to your coach about what you promise them and how committed you are to the journey.',
    questionType: 'textarea',
    required: false,
  },

  // SECTION 9: Barriers & Challenges
  {
    id: 'q9-1',
    section: 9,
    sectionName: 'Barriers & Challenges',
    order: 1,
    questionText: 'What do you think will be your biggest obstacle to success? (Select all that apply)',
    questionType: 'multiple_choice',
    required: true,
    options: ['Lack of time', 'Lack of motivation', 'Lack of knowledge', 'Financial constraints', 'Work schedule', 'Family commitments', 'Stress', 'Previous failures', 'No major obstacles', 'Other'],
  },
  {
    id: 'q9-2',
    section: 9,
    sectionName: 'Barriers & Challenges',
    order: 2,
    questionText: 'What has prevented you from achieving these goals in the past? (Select all that apply)',
    questionType: 'multiple_choice',
    required: true,
    options: ['Lack of time', 'Lack of motivation', 'Lack of knowledge', 'Financial constraints', 'Work schedule', 'Family commitments', 'Stress', 'Injury/illness', 'Lack of support', 'Other'],
  },
  {
    id: 'q9-3',
    section: 9,
    sectionName: 'Barriers & Challenges',
    order: 3,
    questionText: 'What is your monthly budget for health and wellness? (food, gym, supplements, etc.)',
    questionType: 'multiple_choice',
    required: true,
    options: ['Less than $100', '$100-$300', '$300-$500', '$500-$1000', 'More than $1000', 'Prefer not to say'],
  },

  // SECTION 10: Letter to Your Future Self
  {
    id: 'q10-1',
    section: 10,
    sectionName: 'Letter to Your Future Self',
    order: 1,
    questionText: 'Write a note to your future self, thanking yourself for doing the hard work and reaching your goals. This is a powerful way to stay motivated and remind yourself why you started this journey.',
    questionType: 'textarea',
    required: false,
  },

];

// Helper function to get questions by section
export function getQuestionsBySection(section: number): OnboardingQuestion[] {
  return ONBOARDING_QUESTIONS.filter(q => q.section === section).sort((a, b) => a.order - b.order);
}

// Helper function to get total questions count
export function getTotalQuestionsCount(): number {
  return ONBOARDING_QUESTIONS.length;
}

// Helper function to get questions count by section
export function getQuestionsCountBySection(section: number): number {
  return ONBOARDING_QUESTIONS.filter(q => q.section === section).length;
}



