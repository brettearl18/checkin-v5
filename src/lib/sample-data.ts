import { getDb } from './firebase-server';
import { Client, Form, CheckIn, CheckInResponse, FormTemplate, CustomQuestion, CustomForm } from './types';

// Sample client data
const sampleClients: Omit<Client, 'id'>[] = [
  {
    name: 'Sarah Johnson',
    email: 'sarah.johnson@email.com',
    phone: '+1-555-0101',
    joinDate: new Date('2024-01-15'),
    status: 'active',
    goals: [
      { id: '1', title: 'Lose 20 pounds', targetDate: new Date('2024-06-15'), progress: 65, category: 'weight' },
      { id: '2', title: 'Run a 5K', targetDate: new Date('2024-05-01'), progress: 80, category: 'fitness' }
    ],
    notes: [
      { id: '1', content: 'Great progress on weight loss goals', date: new Date('2024-03-15'), type: 'progress' },
      { id: '2', content: 'Struggling with evening snacking', date: new Date('2024-03-10'), type: 'challenge' }
    ],
    checkInStats: {
      totalCheckIns: 45,
      currentStreak: 12,
      longestStreak: 18,
      averageMood: 7.2,
      averageEnergy: 6.8,
      lastCheckIn: new Date('2024-03-20')
    },
    riskScore: 15,
    tags: ['weight-loss', 'fitness', 'motivated']
  },
  {
    name: 'Mike Chen',
    email: 'mike.chen@email.com',
    phone: '+1-555-0102',
    joinDate: new Date('2024-02-01'),
    status: 'active',
    goals: [
      { id: '1', title: 'Build muscle mass', targetDate: new Date('2024-08-01'), progress: 40, category: 'strength' },
      { id: '2', title: 'Improve sleep quality', targetDate: new Date('2024-05-15'), progress: 30, category: 'lifestyle' }
    ],
    notes: [
      { id: '1', content: 'Consistent with workouts', date: new Date('2024-03-18'), type: 'progress' },
      { id: '2', content: 'Sleep still inconsistent', date: new Date('2024-03-12'), type: 'challenge' }
    ],
    checkInStats: {
      totalCheckIns: 38,
      currentStreak: 8,
      longestStreak: 15,
      averageMood: 6.5,
      averageEnergy: 7.1,
      lastCheckIn: new Date('2024-03-19')
    },
    riskScore: 25,
    tags: ['strength-training', 'sleep', 'consistent']
  },
  {
    name: 'Emily Rodriguez',
    email: 'emily.rodriguez@email.com',
    phone: '+1-555-0103',
    joinDate: new Date('2024-01-20'),
    status: 'at-risk',
    goals: [
      { id: '1', title: 'Reduce stress levels', targetDate: new Date('2024-06-30'), progress: 20, category: 'mental-health' },
      { id: '2', title: 'Establish morning routine', targetDate: new Date('2024-04-15'), progress: 15, category: 'lifestyle' }
    ],
    notes: [
      { id: '1', content: 'High stress at work affecting progress', date: new Date('2024-03-16'), type: 'challenge' },
      { id: '2', content: 'Missed several check-ins', date: new Date('2024-03-08'), type: 'concern' }
    ],
    checkInStats: {
      totalCheckIns: 22,
      currentStreak: 0,
      longestStreak: 8,
      averageMood: 4.8,
      averageEnergy: 5.2,
      lastCheckIn: new Date('2024-03-05')
    },
    riskScore: 75,
    tags: ['stress-management', 'needs-support', 'work-life-balance']
  },
  {
    name: 'David Thompson',
    email: 'david.thompson@email.com',
    phone: '+1-555-0104',
    joinDate: new Date('2024-02-15'),
    status: 'active',
    goals: [
      { id: '1', title: 'Complete marathon training', targetDate: new Date('2024-10-01'), progress: 55, category: 'endurance' },
      { id: '2', title: 'Improve nutrition habits', targetDate: new Date('2024-07-01'), progress: 70, category: 'nutrition' }
    ],
    notes: [
      { id: '1', content: 'Excellent progress on marathon training', date: new Date('2024-03-20'), type: 'progress' },
      { id: '2', content: 'Nutrition plan working well', date: new Date('2024-03-15'), type: 'progress' }
    ],
    checkInStats: {
      totalCheckIns: 52,
      currentStreak: 20,
      longestStreak: 20,
      averageMood: 8.5,
      averageEnergy: 8.2,
      lastCheckIn: new Date('2024-03-20')
    },
    riskScore: 10,
    tags: ['marathon', 'nutrition', 'high-performer']
  },
  {
    name: 'Lisa Wang',
    email: 'lisa.wang@email.com',
    phone: '+1-555-0105',
    joinDate: new Date('2024-01-10'),
    status: 'inactive',
    goals: [
      { id: '1', title: 'Improve flexibility', targetDate: new Date('2024-05-01'), progress: 25, category: 'flexibility' },
      { id: '2', title: 'Reduce back pain', targetDate: new Date('2024-06-01'), progress: 10, category: 'health' }
    ],
    notes: [
      { id: '1', content: 'Back pain limiting progress', date: new Date('2024-02-28'), type: 'challenge' },
      { id: '2', content: 'Considering physical therapy', date: new Date('2024-02-20'), type: 'concern' }
    ],
    checkInStats: {
      totalCheckIns: 15,
      currentStreak: 0,
      longestStreak: 5,
      averageMood: 5.0,
      averageEnergy: 4.5,
      lastCheckIn: new Date('2024-02-25')
    },
    riskScore: 90,
    tags: ['injury', 'needs-support', 'physical-therapy']
  }
];

// Weekly check-in form questions
const weeklyCheckInQuestions = [
  { id: '1', question: 'How would you rate your mood today?', type: 'scale', required: true },
  { id: '2', question: 'How would you rate your energy level?', type: 'scale', required: true },
  { id: '3', question: 'Did you complete your planned workouts this week?', type: 'yes-no', required: true },
  { id: '4', question: 'How well did you stick to your nutrition plan?', type: 'scale', required: true },
  { id: '5', question: 'What was your biggest challenge this week?', type: 'text', required: false },
  { id: '6', question: 'What was your biggest win this week?', type: 'text', required: false }
];

// Generate check-in responses
function generateCheckInResponses(clientId: string, date: Date): CheckInResponse[] {
  const responses: CheckInResponse[] = [];
  
  // Generate mood and energy (scale 1-10)
  const mood = Math.floor(Math.random() * 4) + 6; // 6-9 range for most clients
  const energy = Math.floor(Math.random() * 4) + 6; // 6-9 range for most clients
  
  responses.push({ questionId: '1', answer: mood.toString() });
  responses.push({ questionId: '2', answer: energy.toString() });
  
  // Generate workout completion (mostly yes)
  const completedWorkouts = Math.random() > 0.2 ? 'yes' : 'no';
  responses.push({ questionId: '3', answer: completedWorkouts });
  
  // Generate nutrition adherence (scale 1-10)
  const nutritionAdherence = Math.floor(Math.random() * 4) + 6; // 6-9 range
  responses.push({ questionId: '4', answer: nutritionAdherence.toString() });
  
  // Generate challenge and win responses
  const challenges = [
    'Finding time to exercise',
    'Sticking to meal plan',
    'Getting enough sleep',
    'Managing stress',
    'Staying motivated'
  ];
  
  const wins = [
    'Completed all planned workouts',
    'Stuck to nutrition plan',
    'Improved sleep quality',
    'Felt more energetic',
    'Made progress on goals'
  ];
  
  responses.push({ 
    questionId: '5', 
    answer: challenges[Math.floor(Math.random() * challenges.length)] 
  });
  
  responses.push({ 
    questionId: '6', 
    answer: wins[Math.floor(Math.random() * wins.length)] 
  });
  
  return responses;
}

// Generate client data with check-ins
async function generateClientData() {
  const db = getDb();
  const clientsRef = db.collection('clients');
  const formsRef = db.collection('forms');
  const checkInsRef = db.collection('checkIns');
  
  // Create weekly check-in form
  const form: Omit<Form, 'id'> = {
    title: 'Weekly Check-in',
    description: 'Weekly progress and wellness check-in',
    questions: weeklyCheckInQuestions,
    schedule: {
      frequency: 'weekly',
      dayOfWeek: 1, // Monday
      time: '09:00',
      timezone: 'America/New_York'
    },
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01')
  };
  
  const formDoc = await formsRef.add(form);
  const formId = formDoc.id;
  
  // Create clients
  const clientDocs = await Promise.all(
    sampleClients.map(client => clientsRef.add(client))
  );
  
  // Generate check-ins for each client
  const checkIns: Omit<CheckIn, 'id'>[] = [];
  
  for (let i = 0; i < clientDocs.length; i++) {
    const clientId = clientDocs[i].id;
    const client = sampleClients[i];
    
    // Generate check-ins for the past 8 weeks
    for (let week = 0; week < 8; week++) {
      const checkInDate = new Date();
      checkInDate.setDate(checkInDate.getDate() - (week * 7));
      
      // Skip if client is inactive and check-in is too old
      if (client.status === 'inactive' && checkInDate < new Date('2024-02-25')) {
        continue;
      }
      
      const responses = generateCheckInResponses(clientId, checkInDate);
      
      checkIns.push({
        clientId,
        formId,
        responses,
        mood: parseInt(responses.find(r => r.questionId === '1')?.answer || '7'),
        energy: parseInt(responses.find(r => r.questionId === '2')?.answer || '7'),
        date: checkInDate,
        completed: true,
        analysis: {
          sentiment: 'positive',
          keyInsights: ['Good energy levels', 'Consistent with workouts'],
          recommendations: ['Keep up the great work', 'Consider adding more variety to workouts']
        }
      });
    }
  }
  
  // Add check-ins to database
  await Promise.all(checkIns.map(checkIn => checkInsRef.add(checkIn)));
  
  console.log(`Created ${clientDocs.length} clients, 1 form, and ${checkIns.length} check-ins`);
  
  return {
    clients: clientDocs.length,
    forms: 1,
    checkIns: checkIns.length
  };
}

// Sample Form Templates
const sampleFormTemplates: Omit<FormTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: "Weight Loss Initial Assessment",
    description: "Comprehensive assessment for weight loss clients covering health, goals, and lifestyle",
    category: "weight-loss",
    questions: [
      {
        coachId: "template",
        text: "What is your primary weight loss goal?",
        type: "select",
        weight: 9,
        category: "goals",
        required: true,
        options: ["Lose 10-20 pounds", "Lose 20-50 pounds", "Lose 50+ pounds", "Maintain current weight", "Build muscle while losing fat"],
        scoring: { positive: 10, negative: 0, neutral: 5 },
        tags: ["weight-loss", "goals"],
        isActive: true
      },
      {
        coachId: "template",
        text: "How would you rate your current stress level?",
        type: "scale",
        weight: 8,
        category: "health",
        required: true,
        options: [],
        scoring: { positive: 0, negative: 10, neutral: 5 },
        tags: ["stress", "health"],
        isActive: true
      },
      {
        coachId: "template",
        text: "How many hours do you sleep per night on average?",
        type: "number",
        weight: 7,
        category: "lifestyle",
        required: true,
        options: [],
        scoring: { positive: 10, negative: 0, neutral: 5 },
        tags: ["sleep", "lifestyle"],
        isActive: true
      },
      {
        coachId: "template",
        text: "What is your current exercise routine?",
        type: "text",
        weight: 6,
        category: "lifestyle",
        required: false,
        options: [],
        scoring: { positive: 10, negative: 0, neutral: 5 },
        tags: ["exercise", "lifestyle"],
        isActive: true
      },
      {
        coachId: "template",
        text: "Do you have any medical conditions that affect your weight loss?",
        type: "checkbox",
        weight: 10,
        category: "health",
        required: true,
        options: [],
        scoring: { positive: 0, negative: 10, neutral: 5 },
        tags: ["medical", "health"],
        isActive: true
      }
    ],
    totalWeight: 40,
    estimatedTime: 8,
    isPublic: true,
    createdBy: "system",
    usageCount: 156
  },
  {
    name: "Fitness Assessment",
    description: "Assessment for fitness and strength training clients",
    category: "fitness",
    questions: [
      {
        coachId: "template",
        text: "What is your current fitness level?",
        type: "select",
        weight: 9,
        category: "health",
        required: true,
        options: ["Beginner", "Intermediate", "Advanced", "Athlete"],
        scoring: { positive: 10, negative: 0, neutral: 5 },
        tags: ["fitness", "assessment"],
        isActive: true
      },
      {
        coachId: "template",
        text: "Do you have any injuries or physical limitations?",
        type: "checkbox",
        weight: 10,
        category: "health",
        required: true,
        options: [],
        scoring: { positive: 0, negative: 10, neutral: 5 },
        tags: ["injuries", "health"],
        isActive: true
      },
      {
        coachId: "template",
        text: "How many days per week can you commit to exercise?",
        type: "number",
        weight: 8,
        category: "lifestyle",
        required: true,
        options: [],
        scoring: { positive: 10, negative: 0, neutral: 5 },
        tags: ["commitment", "lifestyle"],
        isActive: true
      },
      {
        coachId: "template",
        text: "What are your primary fitness goals?",
        type: "multiple-choice",
        weight: 7,
        category: "goals",
        required: true,
        options: ["Build muscle", "Improve strength", "Increase endurance", "Lose fat", "Improve flexibility", "Better overall health"],
        scoring: { positive: 10, negative: 0, neutral: 5 },
        tags: ["goals", "fitness"],
        isActive: true
      }
    ],
    totalWeight: 34,
    estimatedTime: 6,
    isPublic: true,
    createdBy: "system",
    usageCount: 89
  },
  {
    name: "Mental Health & Wellness Check",
    description: "Assessment for mental health and wellness coaching",
    category: "mental-health",
    questions: [
      {
        coachId: "template",
        text: "How would you rate your overall mood this week?",
        type: "scale",
        weight: 9,
        category: "health",
        required: true,
        options: [],
        scoring: { positive: 10, negative: 0, neutral: 5 },
        tags: ["mood", "mental-health"],
        isActive: true
      },
      {
        coachId: "template",
        text: "How many hours do you spend on self-care activities weekly?",
        type: "number",
        weight: 7,
        category: "lifestyle",
        required: false,
        options: [],
        scoring: { positive: 10, negative: 0, neutral: 5 },
        tags: ["self-care", "lifestyle"],
        isActive: true
      },
      {
        coachId: "template",
        text: "What are your biggest sources of stress?",
        type: "text",
        weight: 8,
        category: "risk",
        required: true,
        options: [],
        scoring: { positive: 0, negative: 10, neutral: 5 },
        tags: ["stress", "risk"],
        isActive: true
      },
      {
        coachId: "template",
        text: "Do you have a support system in place?",
        type: "checkbox",
        weight: 6,
        category: "lifestyle",
        required: false,
        options: [],
        scoring: { positive: 10, negative: 0, neutral: 5 },
        tags: ["support", "lifestyle"],
        isActive: true
      }
    ],
    totalWeight: 30,
    estimatedTime: 7,
    isPublic: true,
    createdBy: "system",
    usageCount: 67
  }
];

// Sample Custom Questions for Demo Coach
const sampleCustomQuestions: Omit<CustomQuestion, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    coachId: "coach-001",
    text: "What is your relationship with food?",
    type: "text",
    weight: 9,
    category: "health",
    required: true,
    options: [],
    scoring: { positive: 10, negative: 0, neutral: 5 },
    tags: ["food", "health", "weight-loss"],
    isActive: true
  },
  {
    coachId: "coach-001",
    text: "How do you handle emotional eating?",
    type: "select",
    weight: 8,
    category: "lifestyle",
    required: true,
    options: ["I don't experience emotional eating", "I sometimes eat when stressed", "I frequently eat when emotional", "I'm working on this"],
    scoring: { positive: 10, negative: 0, neutral: 5 },
    tags: ["emotional-eating", "lifestyle"],
    isActive: true
  },
  {
    coachId: "coach-001",
    text: "What motivates you to achieve your health goals?",
    type: "text",
    weight: 7,
    category: "motivation",
    required: false,
    options: [],
    scoring: { positive: 10, negative: 0, neutral: 5 },
    tags: ["motivation", "goals"],
    isActive: true
  },
  {
    coachId: "coach-001",
    text: "Rate your current energy level throughout the day",
    type: "scale",
    weight: 6,
    category: "health",
    required: true,
    options: [],
    scoring: { positive: 10, negative: 0, neutral: 5 },
    tags: ["energy", "health"],
    isActive: true
  }
];

// Sample Custom Forms for Demo Coach
const sampleCustomForms: Omit<CustomForm, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    coachId: "coach-001",
    name: "My Weight Loss Assessment",
    description: "Custom assessment for weight loss clients with focus on emotional eating",
    questions: sampleCustomQuestions,
    totalWeight: 30,
    estimatedTime: 6,
    isActive: true
  }
];

async function populateFormTemplates() {
  const db = getDb();
  
  for (const template of sampleFormTemplates) {
    await db.collection('formTemplates').add({
      ...template,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
  
  console.log('✅ Form templates populated');
}

async function populateCustomQuestions() {
  const db = getDb();
  
  for (const question of sampleCustomQuestions) {
    await db.collection('customQuestions').add({
      ...question,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
  
  console.log('✅ Custom questions populated');
}

async function populateCustomForms() {
  const db = getDb();
  
  for (const form of sampleCustomForms) {
    await db.collection('customForms').add({
      ...form,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }
  
  console.log('✅ Custom forms populated');
}

export async function populateSampleData() {
  try {
    console.log('🚀 Starting sample data population...');
    
    await generateClientData();
    await generateCheckInData();
    await generateFormData();
    await populateFormTemplates();
    await populateCustomQuestions();
    await populateCustomForms();
    
    console.log('✅ All sample data populated successfully!');
    return { success: true, message: 'Sample data populated successfully!' };
  } catch (error) {
    console.error('❌ Error populating sample data:', error);
    throw new Error(`Failed to populate sample data: ${error}`);
  }
} 