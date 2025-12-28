export interface QuestionData {
  text: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'scale' | 'boolean' | 'date' | 'time' | 'textarea';
  category: string;
  options?: Array<{ text: string; weight: number }> | string[];
  required: boolean;
  description?: string;
  questionWeight: number;
  yesIsPositive?: boolean;
  coachId?: string;
}

export const vanaCheckInQuestions: QuestionData[] = [
  {
    text: "Any Digestive Issues?",
    type: 'select',
    category: 'Vana Check In',
    required: true,
    description: 'Select any digestive issues experienced',
    questionWeight: 6,
    options: [
      { text: 'Period cramps', weight: 3 },
      { text: 'Bloating', weight: 3 },
      { text: 'Constipation', weight: 3 },
      { text: 'Diarrhea', weight: 3 },
      { text: 'Gas', weight: 4 },
      { text: 'None', weight: 10 },
      { text: 'Other', weight: 3 },
    ],
  },
  {
    text: "Are you taking your supplements?",
    type: 'boolean',
    category: 'Vana Check In',
    required: true,
    description: 'Consistency with supplement intake',
    questionWeight: 7,
    yesIsPositive: true,
  },
  {
    text: "What day of your cycle are you in?",
    type: 'number',
    category: 'Vana Check In',
    required: false,
    description: 'Current day in menstrual cycle',
    questionWeight: 5,
  },
  {
    text: "How would you rate PMS over the past week?",
    type: 'select',
    category: 'Vana Check In',
    required: false,
    description: 'Rate your PMS symptoms',
    questionWeight: 6,
    options: [
      { text: 'Low', weight: 8 },
      { text: 'Medium', weight: 5 },
      { text: 'High', weight: 3 },
      { text: 'Severe', weight: 1 },
      { text: 'None', weight: 10 },
    ],
  },
  {
    text: "How are your stress levels over the past week?",
    type: 'select',
    category: 'Vana Check In',
    required: true,
    description: 'Rate your overall stress levels',
    questionWeight: 8,
    options: [
      { text: 'Low', weight: 9 },
      { text: 'Medium', weight: 6 },
      { text: 'High', weight: 3 },
      { text: 'Very High', weight: 1 },
    ],
  },
  {
    text: "Why did you give it that rating?",
    type: 'textarea',
    category: 'Vana Check In',
    required: false,
    description: 'Provide context for your rating (scoring: positive context = higher weight, negative context = lower weight)',
    questionWeight: 5,
  },
  {
    text: "How are your energy levels over the past week?",
    type: 'select',
    category: 'Vana Check In',
    required: true,
    description: 'Rate your overall energy',
    questionWeight: 8,
    options: [
      { text: 'Low', weight: 2 },
      { text: 'Average', weight: 5 },
      { text: 'Good', weight: 8 },
      { text: 'High', weight: 10 },
    ],
  },
  {
    text: "How would you rate your wins and achievements over the past week?",
    type: 'scale',
    category: 'Vana Check In',
    required: false,
    description: 'Rate the quality and quantity of your wins (1 = no wins, 10 = many significant wins)',
    questionWeight: 7,
  },
  {
    text: "Are you happy with your progress?",
    type: 'boolean',
    category: 'Vana Check In',
    required: true,
    description: 'Overall satisfaction with progress',
    questionWeight: 8,
    yesIsPositive: true,
  },
  {
    text: "Please, explain your answer above.",
    type: 'textarea',
    category: 'Vana Check In',
    required: false,
    description: 'Provide more detail about your progress (scoring: positive explanation = higher weight, negative explanation = lower weight)',
    questionWeight: 6,
  },
  {
    text: "How committed are you to your non-negotiables for next week?",
    type: 'scale',
    category: 'Vana Check In',
    required: false,
    description: 'Rate your commitment level to your priorities (1 = not committed, 10 = very committed)',
    questionWeight: 7,
  },
  {
    text: "Do you need any help from your coach?",
    type: 'boolean',
    category: 'Vana Check In',
    required: false,
    description: 'Request support or guidance (Yes = needs help, No = doing well independently)',
    questionWeight: 6,
    yesIsPositive: false, // Needing help indicates challenges, which is less positive
  },
  {
    text: "Did you complete all your training sessions?",
    type: 'boolean',
    category: 'Vana Check In',
    required: true,
    description: 'Training consistency',
    questionWeight: 9,
    yesIsPositive: true,
  },
  {
    text: "Did you hit your step/cardio goals?",
    type: 'select',
    category: 'Vana Check In',
    required: true,
    description: 'Cardio and step goal achievement',
    questionWeight: 7,
    options: [
      { text: 'No', weight: 2 },
      { text: 'Average', weight: 5 },
      { text: 'Yes', weight: 8 },
      { text: 'Exceeded', weight: 10 },
    ],
  },
  {
    text: "Did you sleep less than 7 hours a night?",
    type: 'select',
    category: 'Vana Check In',
    required: true,
    description: 'Sleep duration assessment',
    questionWeight: 8,
    options: [
      { text: 'No', weight: 10 },
      { text: 'Average', weight: 6 },
      { text: 'Yes', weight: 3 },
      { text: 'Always', weight: 1 },
    ],
  },
  {
    text: "How accurate were you at tracking your macros over the past week?",
    type: 'select',
    category: 'Vana Check In',
    required: true,
    description: 'Macro tracking consistency',
    questionWeight: 7,
    options: [
      { text: 'Not Good', weight: 2 },
      { text: 'Average', weight: 5 },
      { text: 'Good', weight: 8 },
      { text: 'Excellent', weight: 10 },
    ],
  },
  {
    text: "Did you hit your protein target daily?",
    type: 'boolean',
    category: 'Vana Check In',
    required: true,
    description: 'Daily protein goal achievement',
    questionWeight: 8,
    yesIsPositive: true,
  },
  {
    text: "Did you have any slip ups?",
    type: 'boolean',
    category: 'Vana Check In',
    required: true,
    description: 'Any deviations from plan',
    questionWeight: 6,
    yesIsPositive: false, // Slip ups are negative
  },
  {
    text: "How significant was the slip up?",
    type: 'scale',
    category: 'Vana Check In',
    required: false,
    description: 'Rate the severity of any slip ups (1 = minor, 10 = major) - lower score is better',
    questionWeight: 5,
  },
  {
    text: "Describe Slip up (optional details)",
    type: 'textarea',
    category: 'Vana Check In',
    required: false,
    description: 'Additional details about any slip ups (for context only, not scored)',
    questionWeight: 0, // Not scored, just for context
  },
  {
    text: "How many serves of vegetables did you have a day on average over the past week? (Goal - 5)",
    type: 'select',
    category: 'Vana Check In',
    required: true,
    description: 'Daily vegetable intake (aim for 5+ serves)',
    questionWeight: 7,
    options: [
      { text: '0-1 serves', weight: 2 },
      { text: '2-3 serves', weight: 4 },
      { text: '4 serves', weight: 6 },
      { text: '5 serves', weight: 8 },
      { text: '6-7 serves', weight: 9 },
      { text: '8+ serves', weight: 10 },
    ],
  },
  {
    text: "How many alcoholic drinks did you have over the past week?",
    type: 'select',
    category: 'Vana Check In',
    required: true,
    description: 'Total alcoholic drinks consumed (lower is better)',
    questionWeight: 5,
    options: [
      { text: '0 drinks', weight: 10 },
      { text: '1-3 drinks', weight: 8 },
      { text: '4-7 drinks', weight: 6 },
      { text: '8-12 drinks', weight: 4 },
      { text: '13-20 drinks', weight: 2 },
      { text: '21+ drinks', weight: 1 },
    ],
  },
  {
    text: "How are your hunger levels over the past week?",
    type: 'select',
    category: 'Vana Check In',
    required: true,
    description: 'Rate your hunger levels',
    questionWeight: 6,
    options: [
      { text: 'Low', weight: 7 },
      { text: 'Good', weight: 9 },
      { text: 'High', weight: 4 },
      { text: 'Very High', weight: 2 },
    ],
  },
  {
    text: "Did you have a week free from cravings?",
    type: 'boolean',
    category: 'Vana Check In',
    required: true,
    description: 'Cravings management',
    questionWeight: 6,
    yesIsPositive: true,
  },
  {
    text: "How regular are your bowel movements?",
    type: 'select',
    category: 'Vana Check In',
    required: true,
    description: 'Digestive regularity',
    questionWeight: 6,
    options: [
      { text: 'Regular', weight: 9 },
      { text: 'Irregular', weight: 4 },
      { text: 'Constipated', weight: 2 },
      { text: 'Diarrhea', weight: 3 },
    ],
  },
  {
    text: "Do you need a new meal plan or changes to your current plan?",
    type: 'boolean',
    category: 'Vana Check In',
    required: false,
    description: 'Meal plan adjustments needed (Yes = needs changes, No = current plan working)',
    questionWeight: 5,
    yesIsPositive: false, // Needing changes suggests current plan isn't optimal
  },
  {
    text: "Body Weight",
    type: 'number',
    category: 'Vana Check In',
    required: false,
    description: 'Current body weight (for tracking purposes, not scored)',
    questionWeight: 0, // Not scored, just for tracking
  },
  {
    text: "Current Meal Plan",
    type: 'textarea',
    category: 'Vana Check In',
    required: false,
    description: 'Current meal plan details (for reference, not scored)',
    questionWeight: 0, // Not scored, just for reference
  },
];










