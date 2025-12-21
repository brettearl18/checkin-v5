import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';

export const dynamic = 'force-dynamic';

/**
 * POST /api/seed-client-checkins
 * Seeds 4 check-ins for a client with responses showing improvement over time
 * Body: { clientId: string }
 */
export async function POST(request: NextRequest) {
  const db = getDb();
  try {
    const { clientId, clientEmail } = await request.json();

    if (!clientId && !clientEmail) {
      return NextResponse.json({
        success: false,
        message: 'Client ID or email is required'
      }, { status: 400 });
    }

    // Get client data to find coach - try multiple methods
    let clientDoc: any = null;
    let clientData = null;
    let actualClientId: string | null = null;

    // Try by document ID first
    if (clientId) {
      const doc = await db.collection('clients').doc(clientId).get();
      if (doc.exists) {
        clientDoc = doc;
        actualClientId = doc.id;
      }
    }

    // If not found by document ID, try by email
    if (!clientDoc && clientEmail) {
      try {
        const queryByEmail = await db.collection('clients')
          .where('email', '==', clientEmail)
          .limit(1)
          .get();
        
        if (!queryByEmail.empty) {
          clientDoc = queryByEmail.docs[0];
          actualClientId = clientDoc.id;
        }
      } catch (queryError) {
        console.log('Error querying by email:', queryError);
      }
    }

    // If still not found and we have clientId, try by authUid or id field
    if (!clientDoc && clientId) {
      try {
        const queryByAuthUid = await db.collection('clients')
          .where('authUid', '==', clientId)
          .limit(1)
          .get();
        
        if (!queryByAuthUid.empty) {
          clientDoc = queryByAuthUid.docs[0];
          actualClientId = clientDoc.id;
        } else {
          const queryById = await db.collection('clients')
            .where('id', '==', clientId)
            .limit(1)
            .get();
          
          if (!queryById.empty) {
            clientDoc = queryById.docs[0];
            actualClientId = clientDoc.id;
          } else {
            // Try checking if it's a user UID - maybe client was created with this as document ID
            // Check users collection first
            try {
              const userDoc = await db.collection('users').doc(clientId).get();
              if (userDoc.exists) {
                const userData = userDoc.data();
                // Try to find client by email from user
                if (userData?.email) {
                  const clientByEmail = await db.collection('clients')
                    .where('email', '==', userData.email)
                    .limit(1)
                    .get();
                  
                  if (!clientByEmail.empty) {
                    clientDoc = clientByEmail.docs[0];
                    actualClientId = clientDoc.id;
                  } else {
                    // User exists but no client document - create one
                    console.log('User exists but no client document, creating one...');
                    const newClientData = {
                      id: clientId,
                      authUid: clientId,
                      email: userData.email || '',
                      firstName: userData.profile?.firstName || userData.firstName || 'Client',
                      lastName: userData.profile?.lastName || userData.lastName || '',
                      coachId: userData.metadata?.invitedBy || coachId || '',
                      status: 'active',
                      createdAt: new Date(),
                      updatedAt: new Date()
                    };
                    
                    await db.collection('clients').doc(clientId).set(newClientData);
                    clientDoc = await db.collection('clients').doc(clientId).get();
                    actualClientId = clientId;
                    console.log('Created client document for user:', clientId);
                  }
                }
              }
            } catch (userError) {
              console.log('Error checking users collection:', userError);
            }
          }
        }
      } catch (queryError) {
        console.log('Error querying client:', queryError);
      }
    }

    if (!clientDoc) {
      return NextResponse.json({
        success: false,
        message: `Client not found. Searched with: ${clientId ? 'ID: ' + clientId : ''} ${clientEmail ? 'Email: ' + clientEmail : ''}`
      }, { status: 404 });
    }

    // Get data from document
    clientData = clientDoc.data();
    if (!actualClientId) {
      actualClientId = clientDoc.id;
    }

    clientData = clientDoc.data();
    const coachId = clientData?.coachId;
    
    if (!coachId) {
      return NextResponse.json({
        success: false,
        message: 'Client has no assigned coach'
      }, { status: 400 });
    }

    // Get a form for this coach (or use the first one)
    const formsSnapshot = await db.collection('forms')
      .where('coachId', '==', coachId)
      .limit(1)
      .get();

    if (formsSnapshot.empty) {
      return NextResponse.json({
        success: false,
        message: 'No forms found for this coach'
      }, { status: 404 });
    }

    const formDoc = formsSnapshot.docs[0];
    const formId = formDoc.id;
    const formData = formDoc.data();
    const formTitle = formData.title || 'Weekly Check-in';
    let questionIds = formData.questions || [];

    // If form has no questions, create some sample questions
    if (questionIds.length === 0) {
      console.log('Form has no questions, creating sample questions...');
      
      const sampleQuestions = [
        {
          text: 'How would you rate your energy level today?',
          type: 'scale',
          category: 'wellness',
          coachId: coachId,
          questionWeight: 8,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          text: 'Did you get enough sleep last night?',
          type: 'boolean',
          category: 'wellness',
          coachId: coachId,
          questionWeight: 7,
          yesIsPositive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          text: 'How many hours of sleep did you get?',
          type: 'number',
          category: 'wellness',
          coachId: coachId,
          questionWeight: 6,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          text: 'How would you rate your stress level?',
          type: 'scale',
          category: 'wellness',
          coachId: coachId,
          questionWeight: 9,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          text: 'Did you exercise today?',
          type: 'boolean',
          category: 'fitness',
          coachId: coachId,
          questionWeight: 7,
          yesIsPositive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      // Create questions and add to form
      const batch = db.batch();
      const createdQuestionIds: string[] = [];

      for (const question of sampleQuestions) {
        const qRef = db.collection('questions').doc();
        batch.set(qRef, question);
        createdQuestionIds.push(qRef.id);
      }

      // Update form with new questions
      const formRef = db.collection('forms').doc(formId);
      batch.update(formRef, {
        questions: createdQuestionIds,
        updatedAt: new Date()
      });

      await batch.commit();
      questionIds = createdQuestionIds;
      console.log(`Created ${createdQuestionIds.length} sample questions for form`);
    }

    // Fetch question details to create realistic responses
    const questions: any[] = [];
    for (const qId of questionIds.slice(0, 5)) { // Limit to 5 questions for simplicity
      try {
        const qDoc = await db.collection('questions').doc(qId).get();
        if (qDoc.exists) {
          questions.push({
            id: qDoc.id,
            ...qDoc.data()
          });
        }
      } catch (error) {
        console.log(`Error fetching question ${qId}:`, error);
      }
    }

    if (questions.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No questions found or created for this form'
      }, { status: 400 });
    }

    const clientName = `${clientData.firstName || ''} ${clientData.lastName || ''}`.trim() || 'Client';

    // Create 4 check-ins over 4 weeks (oldest to newest, showing improvement)
    const now = new Date();
    const checkIns = [];
    const responses = [];

    for (let week = 0; week < 4; week++) {
      // Week 0 = 4 weeks ago (oldest, lowest score)
      // Week 3 = this week (newest, highest score)
      const weeksAgo = 4 - week; // 4, 3, 2, 1 weeks ago
      const weekDate = new Date(now);
      weekDate.setDate(now.getDate() - (weeksAgo * 7));
      
      const assignedDate = new Date(weekDate);
      assignedDate.setDate(weekDate.getDate() - 2); // Assigned 2 days before due
      
      const completedDate = new Date(weekDate);
      completedDate.setHours(10, 0, 0, 0); // Completed at 10 AM

      // Create assignment
      const weekNumber = week + 1; // Week 1, 2, 3, 4
      const assignmentId = `assignment-${actualClientId}-week-${weekNumber}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const assignment = {
        id: assignmentId,
        formId: formId,
        formTitle: formTitle,
        clientId: actualClientId, // Use the actual document ID
        clientName: clientName,
        clientEmail: clientData.email || '',
        coachId: coachId,
        assignedBy: coachId,
        assignedAt: assignedDate,
        dueDate: weekDate,
        completedAt: completedDate,
        status: 'completed',
        isRecurring: true,
        recurringWeek: weekNumber, // Week 1 (oldest) to Week 4 (newest)
        totalWeeks: 4,
        checkInWindow: {
          enabled: true,
          startDay: 'friday',
          startTime: '10:00',
          endDay: 'monday',
          endTime: '22:00'
        }
      };

      // Create responses with improving scores
      // Week 1 (oldest, week=0): Lower scores (60)
      // Week 4 (newest, week=3): Higher scores (84)
      const baseScore = 60 + (week * 8); // 60, 68, 76, 84
      const responseArray = questions.map((question, qIndex) => {
        // Each question improves by different amounts
        const questionImprovement = (week * 2) + (qIndex * 0.5);
        let answer: any;
        let score = 0;

        switch (question.type) {
          case 'scale':
          case 'rating':
            // Scale 1-10: start at 5-6, improve to 7-9
            const scaleValue = Math.min(10, Math.max(1, Math.round(5 + questionImprovement)));
            answer = scaleValue;
            score = scaleValue;
            break;
          
          case 'boolean':
            // Start with more "No" answers, improve to more "Yes" (if yesIsPositive)
            const yesIsPositive = question.yesIsPositive !== false;
            if (week < 2) {
              answer = !yesIsPositive; // More negative answers early
            } else {
              answer = yesIsPositive; // More positive answers later
            }
            score = answer === yesIsPositive ? 8 : 3;
            break;
          
          case 'multiple_choice':
          case 'select':
            // Select better options over time
            const options = question.options || [];
            if (options.length > 0) {
              const optionIndex = Math.min(options.length - 1, Math.floor(questionImprovement / 2));
              answer = typeof options[optionIndex] === 'string' 
                ? options[optionIndex] 
                : (options[optionIndex]?.text || options[optionIndex]?.value || String(options[optionIndex]));
              score = 5 + questionImprovement;
            } else {
              answer = 'Option 1';
              score = 5 + questionImprovement;
            }
            break;
          
          case 'number':
            // Numbers improve over time
            answer = Math.round(5 + questionImprovement);
            score = Math.min(10, Math.max(1, answer / 2));
            break;
          
          default:
            answer = `Response for week ${4 - week}`;
            score = 5 + questionImprovement;
        }

        return {
          questionId: question.id,
          question: question.text,
          answer: answer,
          type: question.type,
          weight: question.questionWeight || question.weight || 5,
          score: Math.min(10, Math.max(1, score))
        };
      });

      // Calculate overall score
      let totalWeightedScore = 0;
      let totalWeight = 0;
      responseArray.forEach((r: any) => {
        const weight = r.weight || 5;
        totalWeightedScore += (r.score || 5) * weight;
        totalWeight += weight;
      });
      const overallScore = totalWeight > 0 
        ? Math.round((totalWeightedScore / (totalWeight * 10)) * 100)
        : baseScore;

      // Create form response
      const responseId = `response-${actualClientId}-week-${weekNumber}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const formResponse = {
        id: responseId,
        assignmentId: assignmentId,
        formId: formId,
        formTitle: formTitle,
        clientId: actualClientId, // Use the actual document ID
        clientName: clientName,
        clientEmail: clientData.email || '',
        coachId: coachId,
        responses: responseArray,
        score: overallScore,
        totalQuestions: questions.length,
        answeredQuestions: questions.length,
        submittedAt: completedDate,
        completedAt: completedDate,
        status: 'completed'
      };

      // Update assignment with score and response ID
      assignment.score = overallScore;
      assignment.responseId = responseId;
      assignment.totalQuestions = questions.length;
      assignment.answeredQuestions = questions.length;

      checkIns.push(assignment);
      responses.push(formResponse);
    }

    // Write to Firestore
    const batch = db.batch();

    // Add assignments
    checkIns.forEach((assignment) => {
      const docRef = db.collection('check_in_assignments').doc(assignment.id);
      batch.set(docRef, assignment);
    });

    // Add responses
    responses.forEach((response) => {
      const docRef = db.collection('formResponses').doc(response.id);
      batch.set(docRef, response);
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Created 4 check-ins with responses for client ${actualClientId}`,
      data: {
        clientId: actualClientId,
        clientName,
        coachId,
        formId,
        formTitle,
        checkInsCreated: checkIns.length,
        responsesCreated: responses.length,
        checkIns: checkIns.map(c => ({
          id: c.id,
          week: c.recurringWeek,
          score: c.score,
          completedAt: c.completedAt
        }))
      }
    });

  } catch (error: any) {
    console.error('Error seeding client check-ins:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to seed check-ins',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

