'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected, AuthenticatedOnly } from '@/components/ProtectedRoute';
import { doc, getDoc, addDoc, collection, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase-client';
import Link from 'next/link';
import { isWithinCheckInWindow, getCheckInWindowDescription, DEFAULT_CHECK_IN_WINDOW, CheckInWindow } from '@/lib/checkin-window-utils';

interface CheckInAssignment {
  id: string;
  formId: string;
  formTitle: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  assignedBy: string;
  assignedAt: any;
  dueDate?: any;
  status: 'pending' | 'sent' | 'completed' | 'overdue';
  sentAt?: any;
  completedAt?: any;
  responseId?: string;
  isRecurring?: boolean;
  recurringWeek?: number;
  totalWeeks?: number;
  checkInWindow?: CheckInWindow;
}

interface Question {
  id: string;
  text: string;
  type: string;
  options?: string[] | Array<{ text: string; weight: number }>;
  category: string;
  coachId: string;
  createdAt: string;
  updatedAt: string;
  questionWeight?: number; // Weight of the question (1-10)
  weight?: number; // Alternative field name for weight
  yesIsPositive?: boolean; // For boolean questions: true if YES is positive
  description?: string; // Optional description/help text for the question
  required?: boolean; // Whether the question is required
  isRequired?: boolean; // Alternative field name for required
}

interface FormResponse {
  questionId: string;
  question: string;
  answer: string | number | boolean;
  type: string;
  comment?: string; // Optional comment/notes for the answer
}

export default function CheckInCompletionPage() {
  const params = useParams();
  const router = useRouter();
  const { userProfile, loading: authLoading } = useAuth();
  const [assignment, setAssignment] = useState<CheckInAssignment | null>(null);
  const [assignmentDocId, setAssignmentDocId] = useState<string | null>(null); // Store the actual Firestore document ID
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [error, setError] = useState('');
  const [unansweredQuestionIndices, setUnansweredQuestionIndices] = useState<number[]>([]);
  const [windowStatus, setWindowStatus] = useState<{ isOpen: boolean; message: string; nextOpenTime?: Date } | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null); // Track when last saved for visual feedback

  const assignmentId = params.id as string;

  // localStorage key for autosaving check-in responses
  const AUTOSAVE_KEY = `checkin-draft-${assignmentId}`;


  useEffect(() => {
    // Wait for auth to finish loading before fetching assignment data
    if (authLoading) {
      return;
    }
    
    // If auth is done loading but no user profile, show error
    if (!authLoading && !userProfile?.uid) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }
    
    // Auth is loaded and user is authenticated, fetch assignment data
    if (!authLoading && userProfile?.uid) {
      fetchAssignmentData();
    }
  }, [assignmentId, authLoading, userProfile?.uid]);

  const fetchAssignmentData = async () => {
    try {
      if (!userProfile?.uid) {
        setError('User not authenticated');
        setLoading(false);
        return;
      }

      // Use API endpoint (handles both doc.id and id field, uses Admin SDK so bypasses client permissions)
      try {
        const response = await fetch(`/api/check-in-assignments/${assignmentId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.assignment) {
            const assignmentData = data.assignment as CheckInAssignment;
            
            // Note: API route uses Admin SDK, so we trust it for authorization
            // The API will return the assignment regardless of clientId format
            // Security is enforced by Firestore rules when we try to access it directly,
            // but since we're using the API route, we can proceed
            
            
            // Store the actual Firestore document ID from the API response
            if (data.documentId) {
              setAssignmentDocId(data.documentId);
            } else if (assignmentData.id) {
              // Fallback: use the id from assignment data
              setAssignmentDocId(assignmentData.id);
            }
            
            // Continue with the assignment data
            await loadFormAndQuestions(assignmentData);
            return;
          }
        }
      } catch (apiError) {
        console.log('API fetch failed, trying direct Firestore query:', apiError);
      }

      // If API route failed, we shouldn't try direct Firestore access
      // as it may fail due to permissions. The API route should always work.
      setError('Failed to load check-in data. Please try refreshing the page.');
      setLoading(false);
    } catch (error) {
      console.error('Error fetching assignment data:', error);
      setError('Failed to load check-in data');
      setLoading(false);
    }
  };

  const loadFormAndQuestions = async (assignmentData: CheckInAssignment) => {
    try {
      
      // Fetch form questions and get form title if missing
      const formDoc = await getDoc(doc(db, 'forms', assignmentData.formId));
      if (!formDoc.exists()) {
        setError('Form not found');
        setLoading(false);
        return;
      }

      const formData = formDoc.data();
      
      // Ensure formTitle is set (fetch from form if missing in assignment)
      if (!assignmentData.formTitle && formData.title) {
        assignmentData.formTitle = formData.title;
      }
      
      // If still no title, use a default
      if (!assignmentData.formTitle) {
        assignmentData.formTitle = 'Check-in Form';
      }
      
      setAssignment(assignmentData);

      // Check check-in window status
      const checkInWindow = assignmentData.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
      const status = isWithinCheckInWindow(checkInWindow);
      setWindowStatus(status);

      const questionIds = formData.questions || [];

      // Fetch all questions from the form (no filtering by category)
      const questionsData: Question[] = [];
      for (const questionId of questionIds) {
        const questionDoc = await getDoc(doc(db, 'questions', questionId));
        if (questionDoc.exists()) {
          const questionData = { id: questionDoc.id, ...questionDoc.data() } as Question;
          // Include all questions from the form
          questionsData.push(questionData);
        }
      }

      setQuestions(questionsData);

      // Initialize responses array - merge with saved draft if available
      let initialResponses: FormResponse[] = questionsData.map(q => ({
        questionId: q.id,
        question: q.text,
        answer: '',
        type: q.type,
        comment: '' // Initialize comment field
      }));

      // Check for saved draft in localStorage and merge if available
      try {
        const savedDraft = localStorage.getItem(AUTOSAVE_KEY);
        if (savedDraft) {
          const draftData = JSON.parse(savedDraft);
          
          if (draftData.responses && Array.isArray(draftData.responses) && draftData.responses.length > 0) {
            const savedResponsesMap = new Map(draftData.responses.map((r: FormResponse) => [r.questionId, r]));
            
            // Merge saved answers/comments into initial responses
            initialResponses = initialResponses.map(initialResponse => {
              const savedResponse = savedResponsesMap.get(initialResponse.questionId);
              if (savedResponse) {
                return {
                  ...initialResponse,
                  answer: savedResponse.answer !== undefined ? savedResponse.answer : initialResponse.answer,
                  comment: savedResponse.comment || initialResponse.comment
                };
              }
              return initialResponse;
            });
            
            console.log('Restored saved draft responses and merged with questions');
            
            // Restore current question position
            if (typeof draftData.currentQuestion === 'number' && 
                draftData.currentQuestion >= 0 && 
                draftData.currentQuestion < questionsData.length) {
              setCurrentQuestion(draftData.currentQuestion);
            }
          }
        }
      } catch (error) {
        console.error('Error loading draft from localStorage in loadFormAndQuestions:', error);
        // Continue with empty responses if draft load fails
      }
      
      setResponses(initialResponses);

    } catch (error) {
      console.error('Error fetching assignment data:', error);
      setError('Failed to load check-in data');
    } finally {
      setLoading(false);
    }
  };

  // Autosave responses to localStorage whenever they change
  useEffect(() => {
    if (assignmentId && responses.length > 0) {
      try {
        const draftData = {
          responses: responses,
          currentQuestion: currentQuestion,
          savedAt: new Date().toISOString()
        };
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(draftData));
        setLastSaved(new Date()); // Update last saved time for visual feedback
        console.log('Autosaved responses to localStorage');
      } catch (error) {
        console.error('Error autosaving to localStorage:', error);
      }
    }
  }, [responses, currentQuestion, assignmentId]);

  const handleAnswerChange = (questionIndex: number, answer: string | number | boolean) => {
    const question = questions[questionIndex];
    if (!question) return;
    
    const updatedResponses = [...responses];
    // Find existing response by questionId (not by array index)
    const existingResponseIndex = updatedResponses.findIndex(r => r.questionId === question.id);
    
    if (existingResponseIndex >= 0) {
      // Update existing response
      updatedResponses[existingResponseIndex].answer = answer;
    } else {
      // Create new response
      updatedResponses.push({
        questionId: question.id,
        question: question.text,
        answer: answer,
        type: question.type,
        comment: ''
      });
    }
    setResponses(updatedResponses);
  };

  const handleCommentChange = (questionIndex: number, comment: string) => {
    const question = questions[questionIndex];
    if (!question) return;
    
    const updatedResponses = [...responses];
    // Find existing response by questionId (not by array index)
    const existingResponseIndex = updatedResponses.findIndex(r => r.questionId === question.id);
    
    if (existingResponseIndex >= 0) {
      // Update existing response comment
      updatedResponses[existingResponseIndex].comment = comment;
    } else {
      // Create new response with comment (but no answer yet)
      updatedResponses.push({
        questionId: question.id,
        question: question.text,
        answer: '', // Empty answer, just adding comment
        type: question.type,
        comment: comment
      });
    }
    setResponses(updatedResponses);
    // Note: Autosave is handled by the useEffect watching responses state
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmit = async () => {
    if (!assignment || !userProfile) return;

    // Check if check-in window is open
    const checkInWindow = assignment.checkInWindow || DEFAULT_CHECK_IN_WINDOW;
    const status = isWithinCheckInWindow(checkInWindow);
    
    if (!status.isOpen) {
      setError(`Check-in window is currently closed. ${status.message}`);
      setSubmitting(false);
      return;
    }

    setSubmitting(true);
    try {
      // Validate that all REQUIRED questions are answered
      const unansweredIndices: number[] = [];
      questions.forEach((question, index) => {
        // Only validate required questions (skip optional ones)
        const isRequired = question.required !== false && question.isRequired !== false;
        if (!isRequired) {
          return; // Skip optional questions
        }
        
        const response = responses.find(r => r.questionId === question.id);
        // Check if answer is missing, empty string, null, or undefined
        // But allow false (for boolean "No" answers)
        // Also allow empty strings for textarea questions that are optional
        const hasAnswer = response && 
          response.answer !== undefined && 
          response.answer !== null && 
          response.answer !== '';
        
        if (!hasAnswer) {
          unansweredIndices.push(index);
        }
      });

      if (unansweredIndices.length > 0) {
        setUnansweredQuestionIndices(unansweredIndices);
        const unansweredNumbers = unansweredIndices.map(i => i + 1).join(', ');
        setError(`Please answer all questions before submitting. Missing answers for questions: ${unansweredNumbers}`);
        setSubmitting(false);
        
        // Scroll to first unanswered question
        setCurrentQuestion(unansweredIndices[0]);
        
        // Scroll to top of question card
        setTimeout(() => {
          const questionCard = document.querySelector('.question-card');
          if (questionCard) {
            questionCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
        
        return;
      }
      
      // Clear any previous unanswered question indicators
      setUnansweredQuestionIndices([]);

      // Calculate score based on answer quality with question weights
      let totalWeightedScore = 0;
      let totalWeight = 0;
      let answeredCount = 0;
      
      // Process responses and add score/weight to each response
      const processedResponses = responses.map((response, index) => {
        const question = questions[index];
        if (!question || !response || response.answer === '' || response.answer === null || response.answer === undefined) {
          return { ...response, score: 0, weight: 0 }; // Return with zero score/weight for unanswered
        }
        
        // Get question weight (default to 5 if not set)
        const questionWeight = question.questionWeight || question.weight || 5;
        
        let questionScore = 0; // Score out of 10
        
        switch (question.type) {
          case 'scale':
          case 'rating':
            // For scale/rating (1-10), use the value directly
            const scaleValue = Number(response.answer);
            if (!isNaN(scaleValue) && scaleValue >= 1 && scaleValue <= 10) {
              questionScore = scaleValue; // 1-10 scale
            }
            break;
            
          case 'number':
            // For number questions, normalize to 1-10 scale
            const numValue = Number(response.answer);
            if (!isNaN(numValue)) {
              // Normalize: if it's a percentage (0-100), convert to 1-10
              if (numValue >= 0 && numValue <= 100) {
                questionScore = 1 + (numValue / 100) * 9; // Map 0-100 to 1-10
              } else {
                // For other numbers, clamp to 1-10 range
                questionScore = Math.min(10, Math.max(1, numValue / 10));
              }
            }
            break;
            
          case 'multiple_choice':
          case 'select':
            // For multiple choice/select, check if options have weights
            if (question.options && Array.isArray(question.options)) {
              // Helper to get option text/value for comparison
              const getOptionMatchValue = (opt: any) => {
                if (typeof opt === 'string') return opt;
                if (typeof opt === 'object' && opt.value) return opt.value;
                if (typeof opt === 'object' && opt.text) return opt.text;
                return String(opt);
              };
              
              // Check if options have weight property
              const optionWithWeight = question.options.find((opt: any) => {
                const optValue = getOptionMatchValue(opt);
                const optText = typeof opt === 'object' && opt.text ? opt.text : optValue;
                return optValue === String(response.answer) || optText === String(response.answer);
              });
              
              if (optionWithWeight && typeof optionWithWeight === 'object' && optionWithWeight.weight) {
                // Use the weight from the option (1-10)
                questionScore = optionWithWeight.weight;
              } else {
                // Fallback: score based on option position
                const selectedIndex = question.options.findIndex((opt: any) => {
                  const optValue = getOptionMatchValue(opt);
                  const optText = typeof opt === 'object' && opt.text ? opt.text : optValue;
                  return optValue === String(response.answer) || optText === String(response.answer);
                });
                if (selectedIndex >= 0) {
                  const numOptions = question.options.length;
                  if (numOptions === 1) {
                    questionScore = 5;
                  } else {
                    questionScore = 1 + (selectedIndex / (numOptions - 1)) * 9;
                  }
                }
              }
            }
            break;
            
          case 'boolean':
            // Use yesIsPositive field to determine scoring
            const yesIsPositive = question.yesIsPositive !== undefined ? question.yesIsPositive : true;
            const isYes = response.answer === true || response.answer === 'yes' || response.answer === 'Yes';
            
            if (yesIsPositive) {
              // YES is positive (e.g., "Do you feel happy?")
              questionScore = isYes ? 8 : 3;
            } else {
              // YES is negative (e.g., "Do you feel anxious?")
              questionScore = isYes ? 3 : 8;
            }
            break;
            
          case 'text':
            // For text questions, give a neutral score
            const textValue = String(response.answer).trim();
            if (textValue.length > 0) {
              questionScore = 5; // Neutral score for text answers
            }
            break;
            
          case 'textarea':
            // All textarea questions are free-form text responses and are NOT scored
            // They should have questionWeight: 0 and are for context/reference only
            questionScore = 0;
            // Don't count in scoring - return early with 0 weight
            return { ...response, score: 0, weight: 0, questionText: question.text || question.question || '', questionId: question.id || response.questionId || '' };
            
          default:
            // Default: give partial credit for answering
            questionScore = 5;
            break;
        }
        
        // Add weighted score (questionScore * questionWeight)
        totalWeightedScore += questionScore * questionWeight;
        totalWeight += questionWeight;
        answeredCount++;
        
        // Add score and weight to response object
        return {
          ...response,
          score: questionScore,
          weight: questionWeight,
          questionText: question.text || question.question || '',
          questionId: question.id || response.questionId || ''
        };
      });
      
      // Filter out unanswered questions
      const filteredResponses = processedResponses.filter(r => r && r.answer !== undefined && r.answer !== null && r.answer !== '');
      
      // Calculate final score as percentage (0-100)
      // Normalize by total possible weighted score (10 * totalWeight)
      const score = totalWeight > 0 
        ? Math.round((totalWeightedScore / (totalWeight * 10)) * 100)
        : 0;

      // Ensure formTitle is set (should already be set from fetch, but double-check)
      let formTitle = assignment.formTitle;
      if (!formTitle) {
        // Fallback: fetch from form if still missing
        try {
          const formDoc = await getDoc(doc(db, 'forms', assignment.formId));
          if (formDoc.exists()) {
            formTitle = formDoc.data().title || 'Check-in Form';
          } else {
            formTitle = 'Check-in Form';
          }
        } catch (error) {
          console.error('Error fetching form title:', error);
          formTitle = 'Check-in Form';
        }
      }

      // Create response document
      const responseData = {
        formId: assignment.formId,
        formTitle: formTitle, // Use the ensured formTitle
        assignmentId: assignmentId, // Add assignment ID for linking
        clientId: userProfile.uid,
        coachId: assignment.coachId, // CRITICAL: Include coachId for coach to find responses
        clientName: userProfile.displayName || userProfile.firstName || 'Client',
        clientEmail: userProfile.email || '',
        submittedAt: new Date(),
        completedAt: new Date(),
        score: score,
        totalQuestions: questions.length,
        answeredQuestions: answeredCount,
        responses: filteredResponses,
        status: 'completed'
      };

      console.log('Submitting response data:', JSON.stringify(responseData, null, 2));

      const responseRef = await addDoc(collection(db, 'formResponses'), responseData);

      // Update assignment status with score and response details
      // Use the actual Firestore document ID, not the URL parameter
      let docIdToUpdate = assignmentDocId;
      
      console.log('Attempting to update assignment:', {
        assignmentDocId,
        assignmentId,
        docIdToUpdate,
        assignment: assignment?.id
      });
      
      // If we don't have the document ID, try to find it
      if (!docIdToUpdate) {
        console.log('No assignmentDocId stored, querying for document...');
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const assignmentsQuery = query(
          collection(db, 'check_in_assignments'),
          where('id', '==', assignmentId),
          where('clientId', '==', userProfile.uid)
        );
        const querySnapshot = await getDocs(assignmentsQuery);
        
        if (!querySnapshot.empty) {
          docIdToUpdate = querySnapshot.docs[0].id;
          console.log('Found document by id field, using document ID:', docIdToUpdate);
          setAssignmentDocId(docIdToUpdate); // Store it for future use
        } else {
          // Last resort: try using assignmentId as document ID
          console.log('Trying assignmentId as document ID:', assignmentId);
          const testDoc = await getDoc(doc(db, 'check_in_assignments', assignmentId));
          if (testDoc.exists()) {
            docIdToUpdate = assignmentId;
            setAssignmentDocId(assignmentId);
          } else {
            throw new Error(`Check-in assignment not found. Tried id field: ${assignmentId}`);
          }
        }
      }
      
      if (!docIdToUpdate) {
        throw new Error('Assignment document ID not found');
      }
      
      // Verify the document exists before updating
      const docRef = doc(db, 'check_in_assignments', docIdToUpdate);
      const docSnapshot = await getDoc(docRef);
      
      if (!docSnapshot.exists()) {
        // Document doesn't exist, try querying by 'id' field one more time
        console.log('Document not found with stored ID, querying by id field:', docIdToUpdate);
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const assignmentsQuery = query(
          collection(db, 'check_in_assignments'),
          where('id', '==', assignmentId),
          where('clientId', '==', userProfile.uid)
        );
        const querySnapshot = await getDocs(assignmentsQuery);
        
        if (!querySnapshot.empty) {
          docIdToUpdate = querySnapshot.docs[0].id;
          console.log('Found document by id field, using document ID:', docIdToUpdate);
          setAssignmentDocId(docIdToUpdate);
        } else {
          throw new Error(`Check-in assignment not found. Tried document ID: ${docIdToUpdate} and id field: ${assignmentId}`);
        }
      }
      
      // Now update with the correct document ID
      console.log('Updating document with ID:', docIdToUpdate);
      await updateDoc(doc(db, 'check_in_assignments', docIdToUpdate), {
        status: 'completed',
        completedAt: new Date(),
        responseId: responseRef.id,
        score: score, // Save the score to the assignment
        totalQuestions: questions.length, // Save total questions
        answeredQuestions: answeredCount // Save answered questions count
      });
      console.log('Successfully updated assignment document');

      // Create notification for coach
      try {
        const notificationResponse = await fetch('/api/check-in-completed', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clientId: userProfile.uid,
            formId: assignment.formId,
            responseId: responseRef.id,
            score: score,
            formTitle: formTitle,
            clientName: userProfile.displayName || userProfile.firstName || 'Client'
          })
        });
        
        if (!notificationResponse.ok) {
          console.error('Failed to create notification');
        }
      } catch (error) {
        console.error('Error creating notification:', error);
        // Don't fail the check-in if notification fails
      }

      // Clear saved draft from localStorage on successful submission
      try {
        localStorage.removeItem(AUTOSAVE_KEY);
        console.log('Cleared saved draft after successful submission');
      } catch (error) {
        console.error('Error clearing draft from localStorage:', error);
        // Don't fail submission if clearing localStorage fails
      }

      // Redirect to success page
      router.push(`/client-portal/check-in/${assignmentId}/success?score=${score}`);

    } catch (error) {
      console.error('Error submitting check-in:', error);
      setError('Failed to submit check-in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (question: Question, index: number) => {
    const response = responses.find(r => r.questionId === question.id);
    const answer = response?.answer !== undefined ? response.answer : '';

    switch (question.type) {
      case 'text':
        return (
          <input
            type="text"
            value={answer as string}
            onChange={(e) => handleAnswerChange(index, e.target.value)}
            className="w-full px-4 py-3.5 lg:py-3 border-2 border-gray-300 rounded-lg lg:rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 text-base lg:text-lg transition-all min-h-[44px]"
            placeholder="Enter your answer..."
          />
        );

      case 'textarea':
        // All textarea questions should render as actual textareas
        // This allows free-form text responses
        return (
          <textarea
            value={answer as string}
            onChange={(e) => handleAnswerChange(index, e.target.value)}
            rows={4}
            className="w-full px-4 py-3.5 lg:py-3 border-2 border-gray-300 rounded-lg lg:rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 text-base lg:text-lg transition-all resize-y"
            placeholder="Enter your answer..."
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={answer as string}
            onChange={(e) => handleAnswerChange(index, Number(e.target.value))}
            className="w-full px-4 py-3.5 lg:py-3 border-2 border-gray-300 rounded-lg lg:rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 text-base lg:text-lg transition-all min-h-[44px]"
            placeholder="Enter a number..."
          />
        );

      case 'rating':
        return (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-500">
              <span>1 (Poor)</span>
              <span>10 (Excellent)</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={answer as string}
              onChange={(e) => handleAnswerChange(index, Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-center text-lg font-semibold text-blue-600">
              {answer || '5'}
            </div>
          </div>
        );

      case 'scale':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span className="font-medium">1 (Low)</span>
              <span className="font-medium">10 (High)</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={answer as string}
              onChange={(e) => handleAnswerChange(index, Number(e.target.value))}
              className="w-full h-3 bg-gradient-to-r from-red-200 via-yellow-200 to-green-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-2xl font-bold shadow-lg">
                {answer || '5'}
              </div>
            </div>
          </div>
        );

      case 'boolean':
        return (
          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            <label className={`flex items-center justify-center p-4 lg:p-6 rounded-lg lg:rounded-xl border-2 transition-all cursor-pointer group min-h-[60px] lg:min-h-[80px] ${
              answer === true || answer === 'yes' || answer === 'Yes'
                ? 'border-green-500 bg-green-50 shadow-md'
                : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
            }`}>
              <input
                type="radio"
                name={`question-${question.id}`}
                value="yes"
                checked={answer === true || answer === 'yes' || answer === 'Yes'}
                onChange={() => handleAnswerChange(index, true)}
                className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300"
              />
              <span className={`ml-2 lg:ml-3 text-base lg:text-lg font-semibold ${
                answer === true || answer === 'yes' || answer === 'Yes'
                  ? 'text-green-700'
                  : 'text-gray-700 group-hover:text-green-700'
              }`}>
                ✅ Yes
              </span>
            </label>
            <label className={`flex items-center justify-center p-4 lg:p-6 rounded-lg lg:rounded-xl border-2 transition-all cursor-pointer group min-h-[60px] lg:min-h-[80px] ${
              answer === false || answer === 'no' || answer === 'No'
                ? 'border-red-500 bg-red-50 shadow-md'
                : 'border-gray-200 hover:border-red-300 hover:bg-red-50'
            }`}>
              <input
                type="radio"
                name={`question-${question.id}`}
                value="no"
                checked={answer === false || answer === 'no' || answer === 'No'}
                onChange={() => handleAnswerChange(index, false)}
                className="h-5 w-5 text-red-600 focus:ring-red-500 border-gray-300"
              />
              <span className={`ml-2 lg:ml-3 text-base lg:text-lg font-semibold ${
                answer === false || answer === 'no' || answer === 'No'
                  ? 'text-red-700'
                  : 'text-gray-700 group-hover:text-red-700'
              }`}>
                ❌ No
              </span>
            </label>
          </div>
        );

      case 'multiple_choice':
        return (
          <div className="space-y-2.5 lg:space-y-3">
            {question.options?.map((option, optionIndex) => {
              const optionText = typeof option === 'string' ? option : (option?.text || String(option));
              const isSelected = answer === option || answer === optionText;
              
              return (
                <label 
                  key={optionIndex} 
                  className={`flex items-center p-3.5 lg:p-4 rounded-lg lg:rounded-xl border-2 transition-all cursor-pointer group min-h-[52px] ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={optionText}
                    checked={isSelected}
                    onChange={() => handleAnswerChange(index, optionText)}
                    className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 flex-shrink-0"
                  />
                  <span className={`ml-3 lg:ml-4 text-sm lg:text-base font-medium ${
                    isSelected ? 'text-blue-700' : 'text-gray-900 group-hover:text-blue-700'
                  }`}>
                    {optionText}
                  </span>
                </label>
              );
            })}
          </div>
        );

      case 'select':
        // Handle both string array and object array options
        const selectOptions = question.options || [];
        const getOptionText = (option: any) => {
          if (typeof option === 'string') return option;
          if (typeof option === 'object' && option.text) return option.text;
          return String(option);
        };
        const getOptionValue = (option: any) => {
          if (typeof option === 'string') return option;
          if (typeof option === 'object' && option.value) return option.value;
          if (typeof option === 'object' && option.text) return option.text;
          return String(option);
        };
        
        return (
          <div className="space-y-2.5 lg:space-y-3">
            {selectOptions.map((option, optionIndex) => {
              const optionText = getOptionText(option);
              const optionValue = getOptionValue(option);
              const isSelected = answer === optionValue || answer === optionText;
              
              return (
                <label 
                  key={optionIndex} 
                  className={`flex items-center p-3.5 lg:p-4 rounded-lg lg:rounded-xl border-2 transition-all cursor-pointer group min-h-[52px] ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 shadow-md'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={optionValue}
                    checked={isSelected}
                    onChange={() => handleAnswerChange(index, optionValue)}
                    className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 flex-shrink-0"
                  />
                  <span className={`ml-3 lg:ml-4 text-sm lg:text-base font-medium ${
                    isSelected ? 'text-blue-700' : 'text-gray-900 group-hover:text-blue-700'
                  }`}>
                    {optionText}
                  </span>
                </label>
              );
            })}
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={answer as string}
            onChange={(e) => handleAnswerChange(index, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            placeholder="Enter your answer..."
          />
        );
    }
  };

  if (loading) {
    return (
      <RoleProtected requiredRole="client">
        <AuthenticatedOnly>
          <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-600 border-t-transparent mx-auto"></div>
              <p className="mt-6 text-gray-700 text-lg font-medium">Loading check-in...</p>
            </div>
          </div>
        </AuthenticatedOnly>
      </RoleProtected>
    );
  }

  if (error || !assignment) {
    return (
      <RoleProtected requiredRole="client">
        <AuthenticatedOnly>
          <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="text-center bg-white rounded-2xl shadow-xl p-8 max-w-md">
              <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
              <p className="text-gray-600 mb-6">{error || 'Check-in not found'}</p>
              <Link
                href="/client-portal"
                className="inline-block bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </AuthenticatedOnly>
      </RoleProtected>
    );
  }

  const currentQ = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <AuthenticatedOnly>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-indigo-100 py-4 lg:py-8">
        <div className="max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <div className="mb-6 lg:mb-10">
            <div className="flex items-center justify-between mb-4 lg:mb-6">
              <Link
                href="/client-portal"
                className="text-gray-700 hover:text-gray-900 font-medium flex items-center gap-2 transition-colors text-sm lg:text-base"
              >
                <svg className="w-4 h-4 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">Back to Dashboard</span>
                <span className="sm:hidden">Back</span>
              </Link>
            </div>
            <div className="text-center">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 mb-2 lg:mb-3">{assignment.formTitle}</h1>
              <p className="text-sm lg:text-lg text-gray-700 font-medium">Complete your assigned check-in</p>
              {assignment.dueDate && (
                <div className="mt-2 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
                  {assignment.recurringWeek && assignment.totalWeeks && (
                    <span className="text-xs sm:text-sm lg:text-base text-purple-600 font-semibold bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200">
                      Week {assignment.recurringWeek} of {assignment.totalWeeks}
                    </span>
                  )}
                  <span className="text-xs sm:text-sm lg:text-base text-gray-600 font-medium">
                    {(() => {
                      let dueDate: Date;
                      if (assignment.dueDate?.toDate && typeof assignment.dueDate.toDate === 'function') {
                        // Firestore Timestamp
                        dueDate = assignment.dueDate.toDate();
                      } else if (assignment.dueDate?._seconds) {
                        // Firebase Timestamp object with _seconds
                        dueDate = new Date(assignment.dueDate._seconds * 1000);
                      } else if (assignment.dueDate instanceof Date) {
                        // Already a Date object
                        dueDate = assignment.dueDate;
                      } else if (typeof assignment.dueDate === 'string') {
                        // ISO string
                        dueDate = new Date(assignment.dueDate);
                      } else {
                        // Fallback
                        dueDate = new Date();
                      }
                      return dueDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      });
                    })()}
                  </span>
                </div>
              )}
            </div>

            {/* Check-in Window Status */}
            {windowStatus && (
              <div className={`mt-4 lg:mt-6 p-4 lg:p-5 rounded-xl lg:rounded-2xl shadow-lg border-2 ${
                windowStatus.isOpen 
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300' 
                  : 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300'
              }`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 lg:gap-4">
                  <div className="flex-1">
                    <p className={`text-base lg:text-lg font-bold mb-1.5 lg:mb-2 ${
                      windowStatus.isOpen ? 'text-green-800' : 'text-yellow-800'
                    }`}>
                      {windowStatus.isOpen ? '✅ Check-in window is open' : '⏰ Check-in window is closed'}
                    </p>
                    <p className={`text-sm lg:text-base ${
                      windowStatus.isOpen ? 'text-green-700' : 'text-yellow-700'
                    }`}>
                      {windowStatus.message}
                    </p>
                    {windowStatus.nextOpenTime && (
                      <p className="text-xs lg:text-sm mt-2 text-yellow-700 font-medium">
                        Next available: {windowStatus.nextOpenTime.toLocaleString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>
                  <div className="text-xs lg:text-sm text-gray-700 font-semibold bg-white/60 px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg lg:rounded-xl">
                    <span className="hidden sm:inline">Window: </span>
                    {getCheckInWindowDescription(assignment.checkInWindow || DEFAULT_CHECK_IN_WINDOW)}
                  </div>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            <div className="mt-4 lg:mt-6 mb-3 lg:mb-4">
              <div className="w-full bg-white/60 backdrop-blur-sm rounded-full h-2.5 lg:h-3 shadow-inner border border-gray-200">
                <div 
                  className="bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-600 h-2.5 lg:h-3 rounded-full transition-all duration-500 shadow-lg" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-center gap-3 mt-2 lg:mt-3">
                <p className="text-sm lg:text-base font-semibold text-gray-900">
                  Question {currentQuestion + 1} of {questions.length}
                </p>
                {lastSaved && (
                  <span className="text-xs text-gray-500 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Question Card */}
          <div className={`bg-white rounded-xl lg:rounded-2xl shadow-xl p-4 sm:p-6 lg:p-8 border-2 transition-all duration-200 hover:shadow-2xl mb-6 lg:mb-8 question-card ${
            unansweredQuestionIndices.includes(currentQuestion) 
              ? 'border-red-400 bg-red-50/30' 
              : 'border-gray-100'
          }`}>
            {currentQ && (
              <div>
                <div className="mb-6 lg:mb-8">
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-2 lg:mb-3">
                    {currentQ.text}
                  </h2>
                  {currentQ.description && (
                    <p className="text-sm lg:text-base text-gray-600 mb-3 lg:mb-4 italic">
                      {currentQ.description}
                    </p>
                  )}
                  {currentQ.category && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 lg:px-4 lg:py-2 bg-gradient-to-r from-purple-100 to-indigo-100 rounded-full">
                      <span className="text-xs lg:text-sm font-semibold text-purple-700">Category:</span>
                      <span className="text-xs lg:text-sm font-bold text-gray-900">{currentQ.category}</span>
                    </div>
                  )}
                </div>

                <div className="mb-6 lg:mb-8">
                  {renderQuestion(currentQ, currentQuestion)}
                </div>

                {/* Comment/Notes Section - Only for boolean, multiple_choice, and select questions */}
                {(currentQ.type === 'boolean' || currentQ.type === 'multiple_choice' || currentQ.type === 'select') && (
                  <div className="mt-6 lg:mt-8 pt-6 lg:pt-8 border-t-2 border-gray-200">
                    <label className="block text-sm lg:text-base font-bold text-gray-900 mb-2 lg:mb-3">
                      Additional Notes (Optional)
                    </label>
                    <textarea
                      value={responses[currentQuestion]?.comment || ''}
                      onChange={(e) => handleCommentChange(currentQuestion, e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg lg:rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 text-base transition-all"
                      rows={4}
                      placeholder="Add any additional notes or context about your answer..."
                    />
                    <p className="mt-2 text-xs lg:text-sm text-gray-600">
                      Use this space to provide more context or details about your response
                    </p>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between items-center gap-3 mt-6 lg:mt-8 pt-6 lg:pt-6 border-t-2 border-gray-200">
                  <button
                    onClick={handlePrevious}
                    disabled={currentQuestion === 0}
                    className="px-4 py-3 lg:px-6 lg:py-3 border-2 border-gray-300 rounded-lg lg:rounded-xl text-gray-700 font-semibold text-sm lg:text-base hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[44px]"
                  >
                    Previous
                  </button>

                  {currentQuestion < questions.length - 1 ? (
                    <button
                      onClick={handleNext}
                      className="px-6 py-3 lg:px-8 lg:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg lg:rounded-xl font-bold text-sm lg:text-base hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 min-h-[44px]"
                    >
                      Next →
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="px-6 py-3 lg:px-8 lg:py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg lg:rounded-xl font-bold text-sm lg:text-base hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none min-h-[44px]"
                    >
                      {submitting ? 'Submitting...' : 'Submit ✓'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border-2 border-red-400 rounded-xl p-5 mb-6 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-red-900 mb-2">Please Complete All Questions</h3>
                  <p className="text-red-800 mb-3">{error}</p>
                  {unansweredQuestionIndices.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-semibold text-red-900 mb-2">Unanswered Questions:</p>
                      <div className="flex flex-wrap gap-2">
                        {unansweredQuestionIndices.map((idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setCurrentQuestion(idx);
                              setError(null);
                              setUnansweredQuestionIndices([]);
                              setTimeout(() => {
                                const questionCard = document.querySelector('.question-card');
                                if (questionCard) {
                                  questionCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }
                              }, 100);
                            }}
                            className="px-3 py-1 bg-red-100 hover:bg-red-200 border border-red-300 rounded-lg text-sm font-semibold text-red-800 transition-colors"
                          >
                            Question {idx + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    setError(null);
                    setUnansweredQuestionIndices([]);
                  }}
                  className="flex-shrink-0 text-red-600 hover:text-red-800"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Question Navigation */}
          <div className="bg-white rounded-lg shadow p-4 lg:p-6">
            <h3 className="text-base lg:text-lg font-medium text-gray-900 mb-3 lg:mb-4">Question Navigation</h3>
            <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-2">
              {questions.map((question, index) => {
                const response = responses.find(r => r.questionId === question.id);
                const hasAnswer = response && 
                  response.answer !== undefined && 
                  response.answer !== null && 
                  response.answer !== '';
                const isUnanswered = unansweredQuestionIndices.includes(index);
                
                return (
                <button
                  key={question.id}
                  onClick={() => {
                    setCurrentQuestion(index);
                    setError(null);
                    setUnansweredQuestionIndices([]);
                  }}
                  className={`p-2.5 lg:p-3 rounded-md text-xs lg:text-sm font-medium transition-colors min-h-[44px] ${
                    index === currentQuestion
                      ? 'bg-blue-600 text-white'
                      : isUnanswered
                      ? 'bg-red-100 text-red-800 border-2 border-red-400'
                      : hasAnswer
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {index + 1}
                </button>
                );
              })}
            </div>
            <div className="mt-3 lg:mt-4 flex items-center flex-wrap gap-3 lg:gap-4 text-xs lg:text-sm text-gray-500">
              <div className="flex items-center">
                <div className="w-2.5 h-2.5 lg:w-3 lg:h-3 bg-blue-600 rounded mr-1.5 lg:mr-2"></div>
                Current
              </div>
              <div className="flex items-center">
                <div className="w-2.5 h-2.5 lg:w-3 lg:h-3 bg-green-100 rounded mr-1.5 lg:mr-2"></div>
                Answered
              </div>
              <div className="flex items-center">
                <div className="w-2.5 h-2.5 lg:w-3 lg:h-3 bg-gray-100 rounded mr-1.5 lg:mr-2"></div>
                Unanswered
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthenticatedOnly>
  );
} 