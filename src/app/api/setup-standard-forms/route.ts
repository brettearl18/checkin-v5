import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

// Function to create standard questions for men's health
async function createMensHealthQuestions(coachId: string) {
  const questions = [
    {
      id: `mens-q-${Date.now()}-1`,
      text: "How would you rate your current energy levels throughout the day?",
      type: "scale",
      options: ["Very Low", "Low", "Moderate", "High", "Very High"],
      category: "Energy & Vitality",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `mens-q-${Date.now()}-2`,
      text: "How many hours of quality sleep do you typically get per night?",
      type: "number",
      category: "Sleep Quality",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `mens-q-${Date.now()}-3`,
      text: "How often do you engage in strength training or resistance exercises?",
      type: "multiple_choice",
      options: ["Never", "1-2 times per week", "3-4 times per week", "5+ times per week"],
      category: "Physical Activity",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `mens-q-${Date.now()}-4`,
      text: "How would you describe your stress levels in the past week?",
      type: "scale",
      options: ["Very Low", "Low", "Moderate", "High", "Very High"],
      category: "Mental Health",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `mens-q-${Date.now()}-5`,
      text: "How satisfied are you with your current nutrition and eating habits?",
      type: "scale",
      options: ["Very Dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very Satisfied"],
      category: "Nutrition",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `mens-q-${Date.now()}-6`,
      text: "How often do you experience muscle soreness or joint discomfort?",
      type: "multiple_choice",
      options: ["Never", "Rarely", "Sometimes", "Often", "Always"],
      category: "Physical Health",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `mens-q-${Date.now()}-7`,
      text: "How would you rate your work-life balance currently?",
      type: "scale",
      options: ["Poor", "Fair", "Good", "Very Good", "Excellent"],
      category: "Lifestyle",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `mens-q-${Date.now()}-8`,
      text: "What is your primary health and fitness goal right now?",
      type: "text",
      category: "Goals",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const db = getDb();
  // Save questions to Firestore
  for (const question of questions) {
    await db.collection('questions').doc(question.id).set(question);
  }

  return questions;
}

// Function to create standard questions for women's health
async function createWomensHealthQuestions(coachId: string) {
  const questions = [
    {
      id: `womens-q-${Date.now()}-1`,
      text: "How would you rate your overall energy levels this week?",
      type: "scale",
      options: ["Very Low", "Low", "Moderate", "High", "Very High"],
      category: "Energy & Vitality",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `womens-q-${Date.now()}-2`,
      text: "How many hours of uninterrupted sleep do you typically get?",
      type: "number",
      category: "Sleep Quality",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `womens-q-${Date.now()}-3`,
      text: "How often do you participate in cardiovascular exercise?",
      type: "multiple_choice",
      options: ["Never", "1-2 times per week", "3-4 times per week", "5+ times per week"],
      category: "Physical Activity",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `womens-q-${Date.now()}-4`,
      text: "How would you describe your stress and anxiety levels recently?",
      type: "scale",
      options: ["Very Low", "Low", "Moderate", "High", "Very High"],
      category: "Mental Health",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `womens-q-${Date.now()}-5`,
      text: "How well do you feel you're meeting your nutritional needs?",
      type: "scale",
      options: ["Poorly", "Fairly", "Well", "Very Well", "Excellent"],
      category: "Nutrition",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `womens-q-${Date.now()}-6`,
      text: "How would you rate your hormonal balance and overall wellness?",
      type: "scale",
      options: ["Poor", "Fair", "Good", "Very Good", "Excellent"],
      category: "Hormonal Health",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `womens-q-${Date.now()}-7`,
      text: "How satisfied are you with your current self-care routine?",
      type: "scale",
      options: ["Very Dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very Satisfied"],
      category: "Self-Care",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: `womens-q-${Date.now()}-8`,
      text: "What is your main health and wellness priority at the moment?",
      type: "text",
      category: "Goals",
      coachId: coachId,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  const db = getDb();
  // Save questions to Firestore
  for (const question of questions) {
    await db.collection('questions').doc(question.id).set(question);
  }

  return questions;
}

// Function to create standard forms for a coach
async function createStandardForms(coachId: string) {
  const db = getDb();
  
  // Create men's health questions
  const mensQuestions = await createMensHealthQuestions(coachId);
  
  // Create women's health questions
  const womensQuestions = await createWomensHealthQuestions(coachId);

  // Create Men's Health Form
  const mensForm = {
    id: `mens-form-${Date.now()}`,
    title: "Men's Health Assessment",
    description: "Comprehensive health assessment form designed specifically for men's health and wellness goals.",
    category: "Health Assessment",
    questions: mensQuestions.map(q => q.id),
    estimatedTime: 10,
    coachId: coachId,
    isStandard: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Create Women's Health Form
  const womensForm = {
    id: `womens-form-${Date.now()}`,
    title: "Women's Health Assessment",
    description: "Comprehensive health assessment form designed specifically for women's health and wellness goals.",
    category: "Health Assessment",
    questions: womensQuestions.map(q => q.id),
    estimatedTime: 10,
    coachId: coachId,
    isStandard: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Save forms to Firestore
  await db.collection('forms').doc(mensForm.id).set(mensForm);
  await db.collection('forms').doc(womensForm.id).set(womensForm);

  return { mensForm, womensForm };
}

export async function POST(request: NextRequest) {
  try {
    const { coachId } = await request.json();

    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Coach ID is required'
      }, { status: 400 });
    }

    const db = getDb();

    // Check if coach already has standard forms
    const existingFormsSnapshot = await db.collection('forms')
      .where('coachId', '==', coachId)
      .where('isStandard', '==', true)
      .get();

    if (!existingFormsSnapshot.empty) {
      return NextResponse.json({
        success: false,
        message: 'Coach already has standard forms'
      }, { status: 409 });
    }

    // Create standard forms
    const forms = await createStandardForms(coachId);

    return NextResponse.json({
      success: true,
      message: 'Standard forms created successfully',
      forms
    });

  } catch (error) {
    console.error('Error creating standard forms:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create standard forms', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 