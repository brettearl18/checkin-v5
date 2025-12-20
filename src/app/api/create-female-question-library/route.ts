import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/firebase-server';

interface QuestionData {
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

export const femaleFocusedQuestions: QuestionData[] = [
  // ========== HEALTH & FITNESS ==========
  {
    text: "How would you rate your overall energy levels over the past week?",
    type: 'scale',
    category: 'Health & Wellness',
    required: true,
    description: 'Rate your average energy from 1 (exhausted) to 10 (energized)',
    questionWeight: 9,
  },
  {
    text: "Did you engage in physical activity regularly over the past week?",
    type: 'boolean',
    category: 'Fitness & Exercise',
    required: true,
    description: 'Any form of movement or exercise counts',
    questionWeight: 8,
    yesIsPositive: true,
  },
  {
    text: "What type of physical activity did you primarily do over the past week?",
    type: 'select',
    category: 'Fitness & Exercise',
    required: false,
    description: 'Select your main activity type',
    questionWeight: 6,
    options: [
      { text: 'Cardio (running, cycling, swimming)', weight: 8 },
      { text: 'Strength training', weight: 9 },
      { text: 'Yoga or Pilates', weight: 7 },
      { text: 'Walking', weight: 6 },
      { text: 'Dancing', weight: 7 },
      { text: 'Stretching', weight: 5 },
      { text: 'None', weight: 1 },
    ],
  },
  {
    text: "How many minutes of physical activity did you average per day over the past week?",
    type: 'number',
    category: 'Fitness & Exercise',
    required: false,
    description: 'Average daily minutes of exercise',
    questionWeight: 5,
  },
  {
    text: "How would you rate your physical strength and endurance over the past week?",
    type: 'scale',
    category: 'Fitness & Exercise',
    required: true,
    description: 'Rate from 1 (very weak) to 10 (very strong)',
    questionWeight: 7,
  },
  {
    text: "Have you experienced any muscle soreness or pain over the past week?",
    type: 'boolean',
    category: 'Health & Wellness',
    required: true,
    description: 'Normal post-exercise soreness or concerning pain',
    questionWeight: 6,
    yesIsPositive: false,
  },

  // ========== MENTAL HEALTH ==========
  {
    text: "How would you rate your overall mood over the past week?",
    type: 'scale',
    category: 'Mental Health',
    required: true,
    description: 'Rate your average mood from 1 (very low) to 10 (excellent)',
    questionWeight: 10,
  },
  {
    text: "How would you rate your stress level over the past week?",
    type: 'scale',
    category: 'Mental Health',
    required: true,
    description: 'Rate from 1 (very relaxed) to 10 (extremely stressed)',
    questionWeight: 9,
  },
  {
    text: "Have you been feeling anxious or worried over the past week?",
    type: 'boolean',
    category: 'Mental Health',
    required: true,
    description: 'Any feelings of anxiety or worry',
    questionWeight: 8,
    yesIsPositive: false,
  },
  {
    text: "How would you rate your ability to cope with daily challenges over the past week?",
    type: 'scale',
    category: 'Mental Health',
    required: true,
    description: 'Rate from 1 (struggling) to 10 (handling well)',
    questionWeight: 8,
  },
  {
    text: "Did you take time for yourself regularly over the past week?",
    type: 'boolean',
    category: 'Mental Health',
    required: true,
    description: 'Any form of self-care or personal time',
    questionWeight: 7,
    yesIsPositive: true,
  },
  {
    text: "How would you rate your self-esteem and body image over the past week?",
    type: 'scale',
    category: 'Mental Health',
    required: true,
    description: 'Rate from 1 (very negative) to 10 (very positive)',
    questionWeight: 8,
  },
  {
    text: "Have you been feeling overwhelmed by your responsibilities over the past week?",
    type: 'boolean',
    category: 'Mental Health',
    required: true,
    description: 'Feeling like you have too much on your plate',
    questionWeight: 7,
    yesIsPositive: false,
  },
  {
    text: "How would you rate your emotional resilience over the past week?",
    type: 'scale',
    category: 'Mental Health',
    required: true,
    description: 'Ability to bounce back from setbacks',
    questionWeight: 7,
  },

  // ========== HORMONAL HEALTH ==========
  {
    text: "Have you experienced any hormonal symptoms over the past week?",
    type: 'boolean',
    category: 'Hormonal Health',
    required: true,
    description: 'PMS, menstrual symptoms, or other hormonal changes',
    questionWeight: 7,
    yesIsPositive: false,
  },
  {
    text: "How would you rate your hormonal balance over the past week?",
    type: 'scale',
    category: 'Hormonal Health',
    required: true,
    description: 'Rate from 1 (very imbalanced) to 10 (well balanced)',
    questionWeight: 8,
  },
  {
    text: "Have you experienced any menstrual cycle irregularities over the past week?",
    type: 'boolean',
    category: 'Hormonal Health',
    required: false,
    description: 'Irregular periods or cycle changes',
    questionWeight: 6,
    yesIsPositive: false,
  },
  {
    text: "How would you rate your PMS symptoms over the past week (if applicable)?",
    type: 'scale',
    category: 'Hormonal Health',
    required: false,
    description: 'Rate from 1 (severe) to 10 (none)',
    questionWeight: 6,
  },
  {
    text: "Have you experienced hot flashes or night sweats over the past week?",
    type: 'boolean',
    category: 'Hormonal Health',
    required: false,
    description: 'Common during perimenopause/menopause',
    questionWeight: 5,
    yesIsPositive: false,
  },

  // ========== NUTRITION ==========
  {
    text: "How would you rate your nutrition over the past week?",
    type: 'scale',
    category: 'Nutrition & Diet',
    required: true,
    description: 'Rate from 1 (poor) to 10 (excellent)',
    questionWeight: 9,
  },
  {
    text: "Did you eat at least 5 servings of fruits and vegetables most days over the past week?",
    type: 'boolean',
    category: 'Nutrition & Diet',
    required: true,
    description: 'Recommended daily intake',
    questionWeight: 8,
    yesIsPositive: true,
  },
  {
    text: "How many glasses of water did you average per day over the past week?",
    type: 'number',
    category: 'Nutrition & Diet',
    required: true,
    description: 'Average daily intake - aim for 8-10 glasses',
    questionWeight: 7,
  },
  {
    text: "Did you consume processed or fast food over the past week?",
    type: 'boolean',
    category: 'Nutrition & Diet',
    required: true,
    description: 'Processed foods, takeout, or fast food',
    questionWeight: 6,
    yesIsPositive: false,
  },
  {
    text: "How would you rate your meal planning and preparation over the past week?",
    type: 'scale',
    category: 'Nutrition & Diet',
    required: true,
    description: 'Rate from 1 (no planning) to 10 (well planned)',
    questionWeight: 6,
  },
  {
    text: "Are you following any specific dietary plan or restrictions?",
    type: 'select',
    category: 'Nutrition & Diet',
    required: false,
    description: 'Select if applicable',
    questionWeight: 4,
    options: [
      { text: 'No restrictions', weight: 5 },
      { text: 'Vegetarian', weight: 6 },
      { text: 'Vegan', weight: 6 },
      { text: 'Keto/Low-carb', weight: 5 },
      { text: 'Mediterranean', weight: 8 },
      { text: 'Gluten-free', weight: 5 },
      { text: 'Other', weight: 5 },
    ],
  },
  {
    text: "How would you rate your relationship with food over the past week?",
    type: 'scale',
    category: 'Nutrition & Diet',
    required: true,
    description: 'Rate from 1 (unhealthy) to 10 (very healthy)',
    questionWeight: 7,
  },

  // ========== SLEEP ==========
  {
    text: "How many hours of sleep did you average per night over the past week?",
    type: 'number',
    category: 'Sleep & Recovery',
    required: true,
    description: 'Average hours of sleep per night',
    questionWeight: 9,
  },
  {
    text: "How would you rate your sleep quality over the past week?",
    type: 'scale',
    category: 'Sleep & Recovery',
    required: true,
    description: 'Rate from 1 (very poor) to 10 (excellent)',
    questionWeight: 9,
  },
  {
    text: "Did you wake up feeling rested most mornings over the past week?",
    type: 'boolean',
    category: 'Sleep & Recovery',
    required: true,
    description: 'Feeling refreshed upon waking',
    questionWeight: 8,
    yesIsPositive: true,
  },
  {
    text: "How many times did you typically wake up during the night over the past week?",
    type: 'number',
    category: 'Sleep & Recovery',
    required: true,
    description: 'Average number of times you woke up per night',
    questionWeight: 6,
  },
  {
    text: "Did you use any sleep aids or medications over the past week?",
    type: 'boolean',
    category: 'Sleep & Recovery',
    required: false,
    description: 'Sleep medications, supplements, or aids',
    questionWeight: 5,
    yesIsPositive: false,
  },
  {
    text: "How would you rate your sleep routine consistency over the past week?",
    type: 'scale',
    category: 'Sleep & Recovery',
    required: true,
    description: 'Going to bed and waking at consistent times',
    questionWeight: 7,
  },

  // ========== LIFESTYLE ==========
  {
    text: "How would you rate your work-life balance over the past week?",
    type: 'scale',
    category: 'Lifestyle',
    required: true,
    description: 'Rate from 1 (poor balance) to 10 (excellent balance)',
    questionWeight: 8,
  },
  {
    text: "Did you spend quality time with friends or family over the past week?",
    type: 'boolean',
    category: 'Lifestyle',
    required: true,
    description: 'Meaningful social connections',
    questionWeight: 7,
    yesIsPositive: true,
  },
  {
    text: "How would you rate your ability to say 'no' when needed over the past week?",
    type: 'scale',
    category: 'Lifestyle',
    required: true,
    description: 'Setting healthy boundaries',
    questionWeight: 7,
  },
  {
    text: "Did you drink alcohol over the past week?",
    type: 'boolean',
    category: 'Lifestyle',
    required: true,
    description: 'Any alcohol consumption',
    questionWeight: 6,
    yesIsPositive: false,
  },
  {
    text: "How many alcoholic drinks did you have over the past week?",
    type: 'number',
    category: 'Lifestyle',
    required: false,
    description: 'Total number of standard drinks',
    questionWeight: 5,
  },
  {
    text: "Did you smoke or use tobacco products over the past week?",
    type: 'boolean',
    category: 'Lifestyle',
    required: true,
    description: 'Any tobacco use',
    questionWeight: 7,
    yesIsPositive: false,
  },
  {
    text: "How would you rate your time management skills over the past week?",
    type: 'scale',
    category: 'Lifestyle',
    required: true,
    description: 'Rate from 1 (poor) to 10 (excellent)',
    questionWeight: 6,
  },

  // ========== SELF-CARE ==========
  {
    text: "Did you engage in any self-care activities over the past week?",
    type: 'boolean',
    category: 'Self-Care',
    required: true,
    description: 'Activities that nurture your well-being',
    questionWeight: 8,
    yesIsPositive: true,
  },
  {
    text: "What type of self-care did you primarily practice over the past week?",
    type: 'select',
    category: 'Self-Care',
    required: false,
    description: 'Select your main self-care activity',
    questionWeight: 6,
    options: [
      { text: 'Meditation or mindfulness', weight: 8 },
      { text: 'Reading', weight: 7 },
      { text: 'Bath or spa time', weight: 7 },
      { text: 'Hobby or creative activity', weight: 7 },
      { text: 'Nature time', weight: 8 },
      { text: 'Journaling', weight: 7 },
      { text: 'Social connection', weight: 7 },
      { text: 'None', weight: 1 },
    ],
  },
  {
    text: "How would you rate your self-care routine over the past week?",
    type: 'scale',
    category: 'Self-Care',
    required: true,
    description: 'Rate from 1 (neglected) to 10 (excellent)',
    questionWeight: 8,
  },
  {
    text: "Did you take time to do something you enjoy over the past week?",
    type: 'boolean',
    category: 'Self-Care',
    required: true,
    description: 'Any activity that brings you joy',
    questionWeight: 7,
    yesIsPositive: true,
  },
  {
    text: "How would you rate your body image and self-acceptance over the past week?",
    type: 'scale',
    category: 'Self-Care',
    required: true,
    description: 'Rate from 1 (very negative) to 10 (very positive)',
    questionWeight: 7,
  },

  // ========== STRESS MANAGEMENT ==========
  {
    text: "How would you rate your ability to manage stress over the past week?",
    type: 'scale',
    category: 'Stress Management',
    required: true,
    description: 'Rate from 1 (poor) to 10 (excellent)',
    questionWeight: 8,
  },
  {
    text: "Did you use any stress management techniques over the past week?",
    type: 'boolean',
    category: 'Stress Management',
    required: true,
    description: 'Breathing, meditation, exercise, etc.',
    questionWeight: 7,
    yesIsPositive: true,
  },
  {
    text: "What stress management techniques did you primarily use over the past week?",
    type: 'select',
    category: 'Stress Management',
    required: false,
    description: 'Select your main technique',
    questionWeight: 6,
    options: [
      { text: 'Deep breathing', weight: 7 },
      { text: 'Meditation', weight: 8 },
      { text: 'Exercise', weight: 8 },
      { text: 'Yoga', weight: 8 },
      { text: 'Journaling', weight: 7 },
      { text: 'Talking to someone', weight: 7 },
      { text: 'Time in nature', weight: 8 },
      { text: 'None', weight: 1 },
    ],
  },
  {
    text: "Have you been feeling overwhelmed by your to-do list over the past week?",
    type: 'boolean',
    category: 'Stress Management',
    required: true,
    description: 'Feeling like you have too much to do',
    questionWeight: 7,
    yesIsPositive: false,
  },
  {
    text: "How would you rate your work-related stress over the past week?",
    type: 'scale',
    category: 'Stress Management',
    required: true,
    description: 'Rate from 1 (very low) to 10 (very high)',
    questionWeight: 7,
  },

  // ========== GOALS & PROGRESS ==========
  {
    text: "How would you rate your progress toward your health goals over the past week?",
    type: 'scale',
    category: 'Goals & Progress',
    required: true,
    description: 'Rate from 1 (no progress) to 10 (excellent progress)',
    questionWeight: 8,
  },
  {
    text: "Did you take action toward your goals over the past week?",
    type: 'boolean',
    category: 'Goals & Progress',
    required: true,
    description: 'Any step toward your health/wellness goals',
    questionWeight: 7,
    yesIsPositive: true,
  },
  {
    text: "How motivated do you feel to continue your wellness journey?",
    type: 'scale',
    category: 'Goals & Progress',
    required: true,
    description: 'Rate from 1 (not motivated) to 10 (very motivated)',
    questionWeight: 7,
  },
  {
    text: "Are you satisfied with your current progress?",
    type: 'boolean',
    category: 'Goals & Progress',
    required: true,
    description: 'Feeling good about your journey',
    questionWeight: 6,
    yesIsPositive: true,
  },

  // ========== PAIN & DISCOMFORT ==========
  {
    text: "Have you experienced any pain or discomfort over the past week?",
    type: 'boolean',
    category: 'Health & Wellness',
    required: true,
    description: 'Any physical pain or discomfort',
    questionWeight: 7,
    yesIsPositive: false,
  },
  {
    text: "How would you rate your pain level (if applicable)?",
    type: 'scale',
    category: 'Health & Wellness',
    required: false,
    description: 'Rate from 1 (mild) to 10 (severe)',
    questionWeight: 6,
  },
  {
    text: "What type of pain or discomfort are you experiencing?",
    type: 'select',
    category: 'Health & Wellness',
    required: false,
    description: 'Select if applicable',
    questionWeight: 5,
    options: [
      { text: 'Headache', weight: 3 },
      { text: 'Muscle soreness', weight: 4 },
      { text: 'Joint pain', weight: 3 },
      { text: 'Back pain', weight: 3 },
      { text: 'Menstrual cramps', weight: 4 },
      { text: 'Other', weight: 3 },
      { text: 'None', weight: 10 },
    ],
  },

  // ========== DIGESTIVE HEALTH ==========
  {
    text: "How would you rate your digestive health over the past week?",
    type: 'scale',
    category: 'Health & Wellness',
    required: true,
    description: 'Rate from 1 (poor) to 10 (excellent)',
    questionWeight: 6,
  },
  {
    text: "Have you experienced any digestive discomfort over the past week?",
    type: 'boolean',
    category: 'Health & Wellness',
    required: true,
    description: 'Bloating, gas, constipation, etc.',
    questionWeight: 5,
    yesIsPositive: false,
  },
  {
    text: "How would you rate your gut health over the past week?",
    type: 'scale',
    category: 'Health & Wellness',
    required: true,
    description: 'Rate from 1 (poor) to 10 (excellent)',
    questionWeight: 6,
  },

  // ========== SKIN HEALTH ==========
  {
    text: "How would you rate your skin health over the past week?",
    type: 'scale',
    category: 'Health & Wellness',
    required: false,
    description: 'Rate from 1 (poor) to 10 (excellent)',
    questionWeight: 5,
  },
  {
    text: "Have you experienced any skin issues over the past week?",
    type: 'boolean',
    category: 'Health & Wellness',
    required: false,
    description: 'Acne, dryness, irritation, etc.',
    questionWeight: 4,
    yesIsPositive: false,
  },

  // ========== GENERAL WELLNESS ==========
  {
    text: "How would you rate your overall health and wellness over the past week?",
    type: 'scale',
    category: 'Health & Wellness',
    required: true,
    description: 'Rate from 1 (poor) to 10 (excellent)',
    questionWeight: 10,
  },
  {
    text: "What is your main health and wellness priority right now?",
    type: 'textarea',
    category: 'Goals & Progress',
    required: false,
    description: 'Share what you\'re focusing on',
    questionWeight: 6,
  },
  {
    text: "What challenges are you facing in your wellness journey?",
    type: 'textarea',
    category: 'Goals & Progress',
    required: false,
    description: 'Share any obstacles or difficulties',
    questionWeight: 5,
  },
  {
    text: "What wins or successes did you experience this week?",
    type: 'textarea',
    category: 'Goals & Progress',
    required: false,
    description: 'Celebrate your achievements',
    questionWeight: 7,
  },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const coachId = body.coachId;
    
    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID is required'
      }, { status: 400 });
    }

    const db = getDb();
    const createdQuestions = [];
    const errors: string[] = [];
    
    for (let i = 0; i < femaleFocusedQuestions.length; i++) {
      try {
        const question = femaleFocusedQuestions[i];
        
        // Convert options format if needed
        let options = question.options;
        if (options && Array.isArray(options) && options.length > 0) {
          if (typeof options[0] === 'string') {
            // Convert string array to object array with default weights
            options = options.map((opt, index) => ({
              text: opt,
              weight: options!.length > 1 
                ? Math.round(1 + (index / (options!.length - 1)) * 9) 
                : 5 // Default weight if only one option
            }));
          }
        }
        
        // Ensure options is an array (even if empty)
        if (!options) {
          options = [];
        }
        
        // For scale questions, create options for 1-10 with weights if not already present
        if (question.type === 'scale' && options.length === 0) {
          options = Array.from({ length: 10 }, (_, i) => ({
            text: String(i + 1),
            weight: i + 1 // Default: weight equals the scale value (1 = 1, 2 = 2, etc.)
          }));
        }
        
        // For boolean questions with yesIsPositive, create default YES/NO options if weighting should be enabled
        let hasWeighting = false;
        if (question.type === 'boolean' && question.yesIsPositive !== undefined) {
          hasWeighting = true;
          if (options.length === 0) {
            options = [
              { text: 'YES', weight: question.yesIsPositive ? 9 : 2 },
              { text: 'NO', weight: question.yesIsPositive ? 2 : 9 }
            ];
          }
        } else if (question.type === 'scale' || question.type === 'select' || question.type === 'multiselect') {
          // Enable weighting if options have weights defined
          hasWeighting = options.length > 0 && options.some((opt: any) => opt.weight !== undefined);
        }
        
        // Create question data with both field name variations for compatibility
        const questionData: any = {
          // Primary fields
          text: question.text,
          title: question.text, // Also include as 'title' for compatibility
          type: question.type,
          questionType: question.type, // Also include as 'questionType' for compatibility
          category: question.category,
          options: options,
          required: question.required || false,
          isRequired: question.required || false, // Also include as 'isRequired' for compatibility
          questionWeight: question.questionWeight || 5,
          weight: question.questionWeight || 5, // Also include as 'weight' for compatibility
          hasWeighting: hasWeighting, // Enable weighting for scale, boolean, and select questions with weights
          coachId: coachId,
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true
        };
        
        // Only add optional fields if they exist
        if (question.description) {
          questionData.description = question.description;
        }
        if (question.yesIsPositive !== undefined) {
          questionData.yesIsPositive = question.yesIsPositive;
        }
        
        const docRef = await db.collection('questions').add(questionData);
        createdQuestions.push({
          id: docRef.id,
          ...questionData
        });
      } catch (questionError) {
        const errorMsg = `Error creating question ${i + 1} (${question.text.substring(0, 50)}...): ${questionError instanceof Error ? questionError.message : 'Unknown error'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
    
    if (createdQuestions.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Failed to create any questions',
        errors: errors
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: `Created ${createdQuestions.length} female-focused questions${errors.length > 0 ? ` (${errors.length} errors)` : ''}`,
      count: createdQuestions.length,
      errors: errors.length > 0 ? errors : undefined,
      categories: [...new Set(createdQuestions.map(q => q.category))]
    });
    
  } catch (error) {
    console.error('Error creating female question library:', error);
    return NextResponse.json({
      success: false,
      message: 'Error creating question library',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
