import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');

    if (!coachId) {
      return NextResponse.json({ success: false, message: 'Coach ID is required' }, { status: 400 });
    }

    const db = getDb();
    let formsSnapshot;

    try {
      // Try with orderBy first
      formsSnapshot = await db.collection('forms')
        .where('coachId', '==', coachId)
        .orderBy('createdAt', 'desc')
        .get();
    } catch (error: any) {
      console.log('Index error, falling back to simple query:', error.message);
      // Fallback without orderBy
      formsSnapshot = await db.collection('forms')
        .where('coachId', '==', coachId)
        .get();
    }

    const forms = formsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        description: data.description,
        category: data.category,
        questions: data.questions || [],
        estimatedTime: data.estimatedTime,
        isStandard: data.isStandard || false,
        isActive: data.isActive !== undefined ? data.isActive : true, // Default to true if not set
        isArchived: data.isArchived || false,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
      };
    });

    console.log(`Found ${forms.length} forms for coachId: ${coachId}`);

    return NextResponse.json({ success: true, forms });

  } catch (error) {
    console.error('Error fetching forms:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch forms', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.json();
    
    // Validate required fields
    // Accept both 'questions' and 'questionIds' for compatibility
    const { title, description, category, questions, questionIds, estimatedTime, coachId, isCopyingStandard } = formData;
    
    if (!title || !description || !category || !coachId) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: title, description, category, coachId'
      }, { status: 400 });
    }

    const db = getDb();
    
    // Use questionIds if provided, otherwise use questions
    const questionList = questionIds || questions || [];
    
    // If copying a standard form, we need to copy the questions too
    if (isCopyingStandard && questionList && questionList.length > 0) {
      const newQuestions = [];
      
      for (const questionId of questionList) {
        // Fetch the original question
        const questionDoc = await db.collection('questions').doc(questionId).get();
        if (questionDoc.exists) {
          const originalQuestion = questionDoc.data();
          
          // Create a new question with a new ID
          const newQuestionId = `q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const newQuestion = {
            ...originalQuestion,
            id: newQuestionId,
            coachId: coachId,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          // Save the new question
          await db.collection('questions').doc(newQuestionId).set(newQuestion);
          newQuestions.push(newQuestionId);
        }
      }
      
      // Update the question list with new question IDs
      questionList.length = 0;
      questionList.push(...newQuestions);
    }

    // Generate unique form ID
    const formId = `form-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create form object
    const form = {
      id: formId,
      title,
      description,
      category,
      questions: questionList, // Use the processed question list
      estimatedTime: estimatedTime || 5,
      coachId,
      isStandard: false, // Always false for copied forms
      isActive: formData.isActive !== undefined ? formData.isActive : true, // Default to active
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Save to Firestore
    await db.collection('forms').doc(formId).set(form);
    
    return NextResponse.json({
      success: true,
      message: 'Form created successfully',
      formId: formId,
      form: { ...form, id: formId }
    });
    
  } catch (error) {
    console.error('Error creating form:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create form', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
