import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firebase-server';
import { getCoachContext } from '@/lib/ai-context';
import { generateStructuredResponse } from '@/lib/openai-service';

export const dynamic = 'force-dynamic';

interface SWOTAnalysis {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  overallAssessment: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const { searchParams } = new URL(request.url);
    const regenerate = searchParams.get('regenerate') === 'true';

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    const db = getDb();

    // Fetch client
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Client not found'
      }, { status: 404 });
    }

    const clientData = clientDoc.data();
    const coachId = clientData?.coachId || clientData?.assignedCoach;
    const clientName = `${clientData?.firstName || ''} ${clientData?.lastName || ''}`.trim() || 'Client';

    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: false,
        message: 'OpenAI API key not configured'
      }, { status: 500 });
    }

    // Check for existing cached SWOT analysis first (to avoid unnecessary OpenAI calls)
    if (!regenerate) {
      try {
        let swotSnapshot;
        try {
          swotSnapshot = await db.collection('swot_analyses')
            .where('clientId', '==', clientId)
            .orderBy('generatedAt', 'desc')
            .limit(1)
            .get();
        } catch (indexError: any) {
          // If index doesn't exist, fetch without orderBy
          if (indexError?.code === 9 || indexError?.message?.includes('index')) {
            const allSwots = await db.collection('swot_analyses')
              .where('clientId', '==', clientId)
              .get();
            
            const sortedDocs = allSwots.docs.sort((a, b) => {
              const dateA = a.data().generatedAt?.toDate?.() || new Date(a.data().generatedAt || 0);
              const dateB = b.data().generatedAt?.toDate?.() || new Date(b.data().generatedAt || 0);
              return dateB.getTime() - dateA.getTime();
            });
            
            swotSnapshot = {
              docs: sortedDocs.slice(0, 1),
              empty: sortedDocs.length === 0
            } as any;
          } else {
            throw indexError;
          }
        }

        // If we have a recent SWOT analysis (within last 7 days) and not forcing regenerate, return it
        if (!swotSnapshot.empty && swotSnapshot.docs[0]) {
          const doc = swotSnapshot.docs[0];
          const existingSwot = doc.data ? doc.data() : (doc as any).data;
          const existingDate = existingSwot.generatedAt?.toDate?.() || new Date(existingSwot.generatedAt);
          const daysDiff = (Date.now() - existingDate.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysDiff < 7) {
            // Return cached SWOT analysis - no OpenAI call needed!
            return NextResponse.json({
              success: true,
              data: existingSwot.analysis,
              cached: true
            });
          }
        }
      } catch (cacheError) {
        console.error('Error checking cached SWOT analysis:', cacheError);
        // Continue to generate new analysis if cache check fails
      }
    }

    // Fetch all completed check-ins
    const checkInsSnapshot = await db.collection('check_in_assignments')
      .where('clientId', '==', clientId)
      .where('status', '==', 'completed')
      .get();

    const checkIns = checkInsSnapshot.docs
      .map(doc => {
        const data = doc.data();
        const completedAt = data.completedAt?.toDate?.() || new Date(data.completedAt);
        return { ...data, completedAt, id: doc.id };
      })
      .sort((a, b) => {
        const dateA = a.completedAt instanceof Date ? a.completedAt.getTime() : new Date(a.completedAt).getTime();
        const dateB = b.completedAt instanceof Date ? b.completedAt.getTime() : new Date(b.completedAt).getTime();
        return dateB - dateA;
      });

    // Calculate progress metrics
    const scores = checkIns.map(checkIn => checkIn.score || 0).filter(score => score > 0);
    const currentScore = scores.length > 0 ? scores[scores.length - 1] : null;
    const averageScore = scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;
    const trend = scores.length >= 2 
      ? (scores[scores.length - 1] > scores[0] ? 'improving' : scores[scores.length - 1] < scores[0] ? 'declining' : 'stable')
      : 'insufficient_data';

    // Fetch recent measurements
    let recentMeasurements: any[] = [];
    try {
      const measurementsSnapshot = await db.collection('measurements')
        .where('clientId', '==', clientId)
        .orderBy('date', 'desc')
        .limit(5)
        .get();

      recentMeasurements = measurementsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          date: data.date?.toDate?.() || new Date(data.date),
          ...data
        };
      });
    } catch (error: any) {
      // If index doesn't exist, fetch without orderBy and sort in memory
      if (error?.code === 9 || error?.message?.includes('index')) {
        console.log('Measurements index not found, fetching without orderBy');
        try {
          const measurementsSnapshot = await db.collection('measurements')
            .where('clientId', '==', clientId)
            .get();

          recentMeasurements = measurementsSnapshot.docs
            .map(doc => {
              const data = doc.data();
              return {
                date: data.date?.toDate?.() || new Date(data.date),
                ...data,
                id: doc.id
              };
            })
            .sort((a, b) => {
              const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
              const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
              return dateB - dateA; // Descending order
            })
            .slice(0, 5); // Limit to 5 most recent
        } catch (fallbackError) {
          console.error('Error fetching measurements (fallback also failed):', fallbackError);
          // Continue with empty array if both fail
        }
      } else {
        console.error('Error fetching measurements:', error);
        // Continue with empty array
      }
    }

    // Extract text responses from recent check-ins
    const textResponses: string[] = [];
    for (const checkIn of checkIns.slice(0, 10)) {
      if (checkIn.responseId) {
        try {
          const responseDoc = await db.collection('formResponses').doc(checkIn.responseId).get();
          if (responseDoc.exists) {
            const responseData = responseDoc.data();
            const responses = responseData?.responses || [];
            responses.forEach((r: any) => {
              if ((r.type === 'text' || r.type === 'textarea') && r.answer) {
                textResponses.push(String(r.answer));
              }
            });
          }
        } catch (error) {
          console.log('Error fetching form response:', error);
        }
      }
    }

    // Fetch onboarding data if available
    let onboardingData = null;
    try {
      const onboardingSnapshot = await db.collection('client_onboarding_responses')
        .where('clientId', '==', clientId)
        .limit(1)
        .get();
      
      if (!onboardingSnapshot.empty) {
        onboardingData = onboardingSnapshot.docs[0].data();
      }
    } catch (error) {
      console.log('Error fetching onboarding data:', error);
    }

    // Get coach context
    let coachContext = null;
    if (coachId) {
      try {
        coachContext = await getCoachContext(coachId, db);
      } catch (error) {
        console.error('Error fetching coach context:', error);
      }
    }

    // Build context for SWOT analysis
    const systemPrompt = coachContext 
      ? `You are an AI assistant helping a Female ${coachContext.specialization} Coach perform a comprehensive SWOT analysis. Apply functional health principles: root cause thinking, systems interconnection, and personalized optimization. Focus on how different health domains (sleep, stress, nutrition, movement, relationships) interconnect and impact overall function.`
      : 'You are an AI assistant helping a Female Functional Health Coach perform a comprehensive SWOT analysis. Apply functional health principles: root cause thinking, systems interconnection, and personalized optimization. Focus on how different health domains (sleep, stress, nutrition, movement, relationships) interconnect and impact overall function.';

    const prompt = `Perform a comprehensive SWOT analysis for this client using a functional health framework.

Client: ${clientName}
Current Progress Score: ${currentScore || 'N/A'}%
Average Progress Score: ${averageScore || 'N/A'}%
Score Trend: ${trend}
Total Check-ins Completed: ${checkIns.length}
Recent Measurements: ${recentMeasurements.length} recorded

${onboardingData?.responses ? `
Onboarding Goals:
- Primary Goal: ${onboardingData.responses['q5-1'] || 'Not specified'}
- Secondary Goals: ${Array.isArray(onboardingData.responses['q5-2']) ? onboardingData.responses['q5-2'].join(', ') : onboardingData.responses['q5-2'] || 'None'}
- Activity Level: ${onboardingData.responses['q3-1'] || 'Not specified'}
` : ''}

${textResponses.length > 0 ? `
Recent Check-in Responses (last ${Math.min(10, textResponses.length)}):
${textResponses.slice(0, 10).join('\n\n---\n\n')}
` : 'No detailed text responses available.'}

Analyze through the lens of functional health:

**STRENGTHS** (Internal positive factors - functional health perspective):
- What functional systems are working well?
- Which health pillars are optimized (sleep, stress management, energy, digestion, movement)?
- What positive patterns suggest strong foundational health?
- What resources or capabilities support functional optimization?
- Which root causes are well-managed?

**WEAKNESSES** (Internal areas for improvement - root cause focus):
- What functional imbalances or deficiencies exist?
- Which health pillars need attention?
- What underlying systems (adrenal, digestive, hormonal) might be compromised?
- What root causes need investigation vs. symptom management?
- Where are cascading negative patterns (e.g., stress → poor sleep → low energy)?

**OPPORTUNITIES** (External positive factors - functional health optimization):
- What lifestyle interventions could optimize function?
- What environmental or social factors support functional health?
- What functional health tools or strategies could be leveraged?
- Where are opportunities to address root causes rather than symptoms?
- What systemic improvements could create positive cascades?

**THREATS** (External risks - functional health perspective):
- What factors could derail functional optimization?
- What environmental toxins or stressors threaten systems?
- What lifestyle patterns could lead to functional decline?
- What systemic risks could cascade into multiple health domains?
- What early warning signs suggest functional imbalances developing?

**FUNCTIONAL HEALTH PRIORITY ASSESSMENT:**
- Rank health pillars by priority for intervention
- Identify which root causes, if addressed, would have the greatest systemic impact
- Suggest order of functional health investigation

Provide 3-5 specific, actionable items for each SWOT category, framed in functional health terms.`;

    const structure = `{
  "strengths": ["string - internal positive factors"],
  "weaknesses": ["string - internal areas for improvement"],
  "opportunities": ["string - external positive factors or improvements"],
  "threats": ["string - external risks or concerns"],
  "overallAssessment": "string - 2-3 paragraph summary of the SWOT analysis and overall progress"
}`;

    // Generate SWOT analysis
    let swotAnalysis: SWOTAnalysis;
    try {
      swotAnalysis = await generateStructuredResponse<SWOTAnalysis>(
        prompt,
        structure,
        {
          model: 'gpt-4o-mini',
          temperature: 0.7,
          systemPrompt,
          cacheKey: `swot-${clientId}-${scores.length}-${currentScore || 0}`
        }
      );
    } catch (error: any) {
      console.error('Error generating SWOT analysis:', error);
      return NextResponse.json({
        success: false,
        message: 'Failed to generate SWOT analysis',
        error: error?.message || 'Unknown error'
      }, { status: 500 });
    }

    // Save to database for caching
    try {
      const swotData = {
        clientId,
        coachId: coachId || null,
        analysis: swotAnalysis,
        metrics: {
          currentScore,
          averageScore,
          trend,
          checkInsCount: checkIns.length
        },
        generatedAt: new Date()
      };

      // Check if SWOT exists, update or create
      const swotSnapshot = await db.collection('swot_analyses')
        .where('clientId', '==', clientId)
        .orderBy('generatedAt', 'desc')
        .limit(1)
        .get();

      if (!swotSnapshot.empty) {
        await swotSnapshot.docs[0].ref.update(swotData);
      } else {
        await db.collection('swot_analyses').add(swotData);
      }
    } catch (error) {
      console.error('Error saving SWOT analysis:', error);
      // Don't fail if save fails
    }

    return NextResponse.json({
      success: true,
      data: swotAnalysis
    });

  } catch (error) {
    console.error('Error in SWOT analysis endpoint:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to generate SWOT analysis',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params;
    const { searchParams } = new URL(request.url);
    const regenerate = searchParams.get('regenerate') === 'true';

    if (!clientId) {
      return NextResponse.json({
        success: false,
        message: 'Client ID is required'
      }, { status: 400 });
    }

    const db = getDb();

    // Fetch client
    const clientDoc = await db.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json({
        success: false,
        message: 'Client not found'
      }, { status: 404 });
    }

    const clientData = clientDoc.data();
    const coachId = clientData?.coachId || clientData?.assignedCoach;
    const clientName = `${clientData?.firstName || ''} ${clientData?.lastName || ''}`.trim() || 'Client';

    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        success: false,
        message: 'OpenAI API key not configured'
      }, { status: 500 });
    }

    // Check for existing cached SWOT analysis first (to avoid unnecessary OpenAI calls)
    if (!regenerate) {
      try {
        let swotSnapshot;
        try {
          swotSnapshot = await db.collection('swot_analyses')
            .where('clientId', '==', clientId)
            .orderBy('generatedAt', 'desc')
            .limit(1)
            .get();
        } catch (indexError: any) {
          // If index doesn't exist, fetch without orderBy
          if (indexError?.code === 9 || indexError?.message?.includes('index')) {
            const allSwots = await db.collection('swot_analyses')
              .where('clientId', '==', clientId)
              .get();
            
            const sortedDocs = allSwots.docs.sort((a, b) => {
              const dateA = a.data().generatedAt?.toDate?.() || new Date(a.data().generatedAt || 0);
              const dateB = b.data().generatedAt?.toDate?.() || new Date(b.data().generatedAt || 0);
              return dateB.getTime() - dateA.getTime();
            });
            
            swotSnapshot = {
              docs: sortedDocs.slice(0, 1),
              empty: sortedDocs.length === 0
            } as any;
          } else {
            throw indexError;
          }
        }

        // If we have a recent SWOT analysis (within last 7 days) and not forcing regenerate, return it
        if (!swotSnapshot.empty && swotSnapshot.docs[0]) {
          const doc = swotSnapshot.docs[0];
          const existingSwot = doc.data ? doc.data() : (doc as any).data;
          const existingDate = existingSwot.generatedAt?.toDate?.() || new Date(existingSwot.generatedAt);
          const daysDiff = (Date.now() - existingDate.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysDiff < 7) {
            // Return cached SWOT analysis - no OpenAI call needed!
            return NextResponse.json({
              success: true,
              data: existingSwot.analysis,
              cached: true
            });
          }
        }
      } catch (cacheError) {
        console.error('Error checking cached SWOT analysis:', cacheError);
        // Continue to generate new analysis if cache check fails
      }
    }

    // Fetch all completed check-ins
    const checkInsSnapshot = await db.collection('check_in_assignments')
      .where('clientId', '==', clientId)
      .where('status', '==', 'completed')
      .get();

    const checkIns = checkInsSnapshot.docs
      .map(doc => {
        const data = doc.data();
        const completedAt = data.completedAt?.toDate?.() || new Date(data.completedAt);
        return { ...data, completedAt, id: doc.id };
      })
      .sort((a, b) => {
        const dateA = a.completedAt instanceof Date ? a.completedAt.getTime() : new Date(a.completedAt).getTime();
        const dateB = b.completedAt instanceof Date ? b.completedAt.getTime() : new Date(b.completedAt).getTime();
        return dateB - dateA;
      });

    // Calculate progress metrics
    const scores = checkIns.map(checkIn => checkIn.score || 0).filter(score => score > 0);
    const currentScore = scores.length > 0 ? scores[scores.length - 1] : null;
    const averageScore = scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;
    const trend = scores.length >= 2 
      ? (scores[scores.length - 1] > scores[0] ? 'improving' : scores[scores.length - 1] < scores[0] ? 'declining' : 'stable')
      : 'insufficient_data';

    // Fetch recent measurements
    let recentMeasurements: any[] = [];
    try {
      const measurementsSnapshot = await db.collection('measurements')
        .where('clientId', '==', clientId)
        .orderBy('date', 'desc')
        .limit(5)
        .get();

      recentMeasurements = measurementsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          date: data.date?.toDate?.() || new Date(data.date),
          ...data
        };
      });
    } catch (error: any) {
      // If index doesn't exist, fetch without orderBy and sort in memory
      if (error?.code === 9 || error?.message?.includes('index')) {
        console.log('Measurements index not found, fetching without orderBy');
        try {
          const measurementsSnapshot = await db.collection('measurements')
            .where('clientId', '==', clientId)
            .get();

          recentMeasurements = measurementsSnapshot.docs
            .map(doc => {
              const data = doc.data();
              return {
                date: data.date?.toDate?.() || new Date(data.date),
                ...data,
                id: doc.id
              };
            })
            .sort((a, b) => {
              const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
              const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
              return dateB - dateA; // Descending order
            })
            .slice(0, 5); // Limit to 5 most recent
        } catch (fallbackError) {
          console.error('Error fetching measurements (fallback also failed):', fallbackError);
          // Continue with empty array if both fail
        }
      } else {
        console.error('Error fetching measurements:', error);
        // Continue with empty array
      }
    }

    // Extract text responses from recent check-ins
    const textResponses: string[] = [];
    for (const checkIn of checkIns.slice(0, 10)) {
      if (checkIn.responseId) {
        try {
          const responseDoc = await db.collection('formResponses').doc(checkIn.responseId).get();
          if (responseDoc.exists) {
            const responseData = responseDoc.data();
            const responses = responseData?.responses || [];
            responses.forEach((r: any) => {
              if ((r.type === 'text' || r.type === 'textarea') && r.answer) {
                textResponses.push(String(r.answer));
              }
            });
          }
        } catch (error) {
          console.log('Error fetching form response:', error);
        }
      }
    }

    // Fetch onboarding data if available
    let onboardingData = null;
    try {
      const onboardingSnapshot = await db.collection('client_onboarding_responses')
        .where('clientId', '==', clientId)
        .limit(1)
        .get();
      
      if (!onboardingSnapshot.empty) {
        onboardingData = onboardingSnapshot.docs[0].data();
      }
    } catch (error) {
      console.log('Error fetching onboarding data:', error);
    }

    // Get coach context
    let coachContext = null;
    if (coachId) {
      try {
        coachContext = await getCoachContext(coachId, db);
      } catch (error) {
        console.error('Error fetching coach context:', error);
      }
    }

    // Build context for SWOT analysis
    const systemPrompt = coachContext 
      ? `You are an AI assistant helping a Female ${coachContext.specialization} Coach perform a comprehensive SWOT analysis. Apply functional health principles: root cause thinking, systems interconnection, and personalized optimization. Focus on how different health domains (sleep, stress, nutrition, movement, relationships) interconnect and impact overall function.`
      : 'You are an AI assistant helping a Female Functional Health Coach perform a comprehensive SWOT analysis. Apply functional health principles: root cause thinking, systems interconnection, and personalized optimization. Focus on how different health domains (sleep, stress, nutrition, movement, relationships) interconnect and impact overall function.';

    const prompt = `Perform a comprehensive SWOT analysis for this client using a functional health framework.

Client: ${clientName}
Current Progress Score: ${currentScore || 'N/A'}%
Average Progress Score: ${averageScore || 'N/A'}%
Score Trend: ${trend}
Total Check-ins Completed: ${checkIns.length}
Recent Measurements: ${recentMeasurements.length} recorded

${onboardingData?.responses ? `
Onboarding Goals:
- Primary Goal: ${onboardingData.responses['q5-1'] || 'Not specified'}
- Secondary Goals: ${Array.isArray(onboardingData.responses['q5-2']) ? onboardingData.responses['q5-2'].join(', ') : onboardingData.responses['q5-2'] || 'None'}
- Activity Level: ${onboardingData.responses['q3-1'] || 'Not specified'}
` : ''}

${textResponses.length > 0 ? `
Recent Check-in Responses (last ${Math.min(10, textResponses.length)}):
${textResponses.slice(0, 10).join('\n\n---\n\n')}
` : 'No detailed text responses available.'}

Analyze through the lens of functional health:

**STRENGTHS** (Internal positive factors - functional health perspective):
- What functional systems are working well?
- Which health pillars are optimized (sleep, stress management, energy, digestion, movement)?
- What positive patterns suggest strong foundational health?
- What resources or capabilities support functional optimization?
- Which root causes are well-managed?

**WEAKNESSES** (Internal areas for improvement - root cause focus):
- What functional imbalances or deficiencies exist?
- Which health pillars need attention?
- What underlying systems (adrenal, digestive, hormonal) might be compromised?
- What root causes need investigation vs. symptom management?
- Where are cascading negative patterns (e.g., stress → poor sleep → low energy)?

**OPPORTUNITIES** (External positive factors - functional health optimization):
- What lifestyle interventions could optimize function?
- What environmental or social factors support functional health?
- What functional health tools or strategies could be leveraged?
- Where are opportunities to address root causes rather than symptoms?
- What systemic improvements could create positive cascades?

**THREATS** (External risks - functional health perspective):
- What factors could derail functional optimization?
- What environmental toxins or stressors threaten systems?
- What lifestyle patterns could lead to functional decline?
- What systemic risks could cascade into multiple health domains?
- What early warning signs suggest functional imbalances developing?

**FUNCTIONAL HEALTH PRIORITY ASSESSMENT:**
- Rank health pillars by priority for intervention
- Identify which root causes, if addressed, would have the greatest systemic impact
- Suggest order of functional health investigation

Provide 3-5 specific, actionable items for each SWOT category, framed in functional health terms.`;

    const structure = `{
  "strengths": ["string - internal positive factors"],
  "weaknesses": ["string - internal areas for improvement"],
  "opportunities": ["string - external positive factors or improvements"],
  "threats": ["string - external risks or concerns"],
  "overallAssessment": "string - 2-3 paragraph summary of the SWOT analysis and overall progress"
}`;

    // Generate SWOT analysis
    let swotAnalysis: SWOTAnalysis;
    try {
      swotAnalysis = await generateStructuredResponse<SWOTAnalysis>(
        prompt,
        structure,
        {
          model: 'gpt-4o-mini',
          temperature: 0.7,
          systemPrompt,
          cacheKey: `swot-${clientId}-${scores.length}-${currentScore || 0}`
        }
      );
    } catch (error: any) {
      console.error('Error generating SWOT analysis:', error);
      return NextResponse.json({
        success: false,
        message: 'Failed to generate SWOT analysis',
        error: error?.message || 'Unknown error'
      }, { status: 500 });
    }

    // Save to database for caching
    try {
      const swotData = {
        clientId,
        coachId: coachId || null,
        analysis: swotAnalysis,
        metrics: {
          currentScore,
          averageScore,
          trend,
          checkInsCount: checkIns.length
        },
        generatedAt: new Date()
      };

      // Check if SWOT exists, update or create
      const swotSnapshot = await db.collection('swot_analyses')
        .where('clientId', '==', clientId)
        .orderBy('generatedAt', 'desc')
        .limit(1)
        .get();

      if (!swotSnapshot.empty) {
        await swotSnapshot.docs[0].ref.update(swotData);
      } else {
        await db.collection('swot_analyses').add(swotData);
      }
    } catch (error) {
      console.error('Error saving SWOT analysis:', error);
      // Don't fail if save fails
    }

    return NextResponse.json({
      success: true,
      data: swotAnalysis
    });

  } catch (error) {
    console.error('Error in SWOT analysis endpoint:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to generate SWOT analysis',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

