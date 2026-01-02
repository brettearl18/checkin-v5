'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GOALS_QUESTIONNAIRE_SECTIONS, GOALS_QUESTIONNAIRE_QUESTIONS, getGoalsQuestionsBySection, type GoalsQuestionnaireQuestion } from '@/lib/goals-questionnaire';

interface QuestionnaireResponse {
  [questionId: string]: any;
}

interface QuestionnaireProgress {
  currentSection: number;
  completedSections: number[];
  totalQuestions: number;
  answeredQuestions: number;
  completionPercentage: number;
}

export default function GoalsQuestionnairePage() {
  const { userProfile } = useAuth();
  const router = useRouter();
  const [clientId, setClientId] = useState<string | null>(null);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [currentSection, setCurrentSection] = useState(1);
  const [responses, setResponses] = useState<QuestionnaireResponse>({});
  const [progress, setProgress] = useState<QuestionnaireProgress>({
    currentSection: 1,
    completedSections: [],
    totalQuestions: GOALS_QUESTIONNAIRE_QUESTIONS.length,
    answeredQuestions: 0,
    completionPercentage: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [questionnaireStatus, setQuestionnaireStatus] = useState<'not_started' | 'in_progress' | 'completed' | 'submitted'>('not_started');

  useEffect(() => {
    if (userProfile?.email) {
      fetchClientData();
    }
  }, [userProfile?.email]);

  useEffect(() => {
    if (clientId) {
      fetchQuestionnaireData();
    }
  }, [clientId]);

  // Scroll to top when section changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentSection]);

  const fetchClientData = async () => {
    try {
      const response = await fetch(`/api/client-portal?clientEmail=${encodeURIComponent(userProfile?.email || '')}`);
      const data = await response.json();
      
      if (data.success && data.data.client) {
        setClientId(data.data.client.id);
        setCoachId(data.data.client.coachId || null);
      }
    } catch (error) {
      console.error('Error fetching client data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestionnaireData = async (preserveCurrentSection: boolean = false) => {
    try {
      const response = await fetch(`/api/client-portal/goals-questionnaire?clientId=${clientId}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setQuestionnaireStatus(data.data.status || 'not_started');
        if (data.data.responses) {
          setResponses(data.data.responses);
        }
        if (data.data.progress) {
          setProgress(data.data.progress);
          // Only update currentSection if we're not preserving it
          if (!preserveCurrentSection) {
            setCurrentSection(data.data.progress.currentSection || 1);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching questionnaire data:', error);
    }
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
    setSaved(false);
  };

  const handleSectionSave = async () => {
    if (!clientId) return;

    setSaving(true);
    try {
      const sectionQuestions = getGoalsQuestionsBySection(currentSection, responses);
      
      const allSectionResponses: QuestionnaireResponse = {};
      sectionQuestions.forEach(question => {
        if (responses[question.id] !== undefined) {
          allSectionResponses[question.id] = responses[question.id];
        }
      });

      // Check if section is complete (all required questions answered)
      const sectionComplete = sectionQuestions.every(question => {
        if (!question.required) return true;
        const answer = responses[question.id];
        return answer !== undefined && answer !== null && answer !== '';
      });

      const response = await fetch('/api/client-portal/goals-questionnaire', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          coachId,
          section: currentSection,
          responses: allSectionResponses,
          markSectionComplete: sectionComplete
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Failed to save questionnaire');
      }

      // Refetch questionnaire data to ensure we have the latest responses (but preserve current section)
      await fetchQuestionnaireData(true);

      setSaved(true);
      if (data.data.progress) {
        setProgress(data.data.progress);
      }
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving section:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error saving your progress: ${errorMessage}. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  const handleNextSection = async () => {
    if (currentSection < GOALS_QUESTIONNAIRE_SECTIONS.length) {
      // Save current section first
      await handleSectionSave();
      // Move to next section (don't refetch as it will reset the section)
      setCurrentSection(currentSection + 1);
    }
  };

  const handlePreviousSection = () => {
    if (currentSection > 1) {
      setCurrentSection(currentSection - 1);
    }
  };

  const handleSubmit = async () => {
    if (!clientId || !coachId) {
      alert('Unable to submit: Missing client or coach information.');
      return;
    }

    // First, save the current section
    await handleSectionSave();

    setSubmitting(true);
    try {
      const response = await fetch('/api/client-portal/goals-questionnaire/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          coachId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setQuestionnaireStatus('submitted');
        alert('Goals questionnaire submitted successfully! Your goals have been created.');
        router.push('/client-portal/goals');
      } else {
        alert(data.message || 'Failed to submit questionnaire. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting questionnaire:', error);
      alert('An error occurred while submitting. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (question: GoalsQuestionnaireQuestion) => {
    const answer = responses[question.id];

    // Note: Conditional logic is already handled in getGoalsQuestionsBySection
    // This is just a safety check, but questions should already be filtered
    if (question.conditionalLogic) {
      const dependsOnAnswer = responses[question.conditionalLogic.dependsOn];
      let shouldShow = false;

      if (question.conditionalLogic.condition === 'equals') {
        shouldShow = dependsOnAnswer === question.conditionalLogic.value;
      } else if (question.conditionalLogic.condition === 'contains') {
        if (Array.isArray(dependsOnAnswer)) {
          // If value is an array, check if any value in the array matches any item in dependsOnAnswer
          if (Array.isArray(question.conditionalLogic.value)) {
            shouldShow = question.conditionalLogic.value.some(v => dependsOnAnswer.includes(v));
          } else {
            shouldShow = dependsOnAnswer.includes(question.conditionalLogic.value);
          }
        }
      } else if (question.conditionalLogic.condition === 'selected') {
        shouldShow = dependsOnAnswer !== undefined && dependsOnAnswer !== null && dependsOnAnswer !== '';
      }

      if (!shouldShow) {
        return null;
      }
    }

    const renderInput = () => {
      switch (question.questionType) {
        case 'number':
          return (
            <input
              type="number"
              value={answer || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value ? Number(e.target.value) : '')}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#daa450] focus:border-[#daa450] text-gray-900 text-lg"
              placeholder={question.placeholder || "Enter a number"}
            />
          );

        case 'text':
          return (
            <input
              type="text"
              value={answer || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#daa450] focus:border-[#daa450] text-gray-900 text-lg"
              placeholder={question.placeholder || "Type your answer"}
            />
          );

        case 'textarea':
          return (
            <textarea
              value={answer || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#daa450] focus:border-[#daa450] text-gray-900 text-lg resize-y"
              placeholder={question.placeholder || "Type your answer"}
            />
          );

        case 'multiple_choice':
          return (
            <div className="space-y-3">
              {question.options?.map((option, index) => (
                <label
                  key={index}
                  className="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-[#daa450] hover:bg-[#daa450]/5 cursor-pointer transition-all"
                >
                  <input
                    type="checkbox"
                    name={question.id}
                    value={option}
                    checked={Array.isArray(answer) && answer.includes(option)}
                    onChange={(e) => {
                      const currentAnswers = Array.isArray(answer) ? answer : [];
                      const newAnswers = e.target.checked
                        ? [...currentAnswers, option]
                        : currentAnswers.filter((a: string) => a !== option);
                      handleAnswerChange(question.id, newAnswers);
                    }}
                    className="mr-3 w-5 h-5 text-[#daa450] focus:ring-[#daa450] border-gray-300 rounded"
                  />
                  <span className="text-gray-900 text-lg">{option}</span>
                </label>
              ))}
            </div>
          );

        case 'scale':
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 text-sm">1</span>
                <span className="text-gray-600 text-sm">10</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={answer || 5}
                onChange={(e) => handleAnswerChange(question.id, Number(e.target.value))}
                className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#daa450]"
              />
              <div className="text-center">
                <span className="text-2xl font-bold text-[#daa450]">{answer || 5}</span>
                <span className="text-gray-600 ml-2">/ 10</span>
              </div>
            </div>
          );

        case 'yes_no':
          return (
            <div className="flex gap-4">
              <label className="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-[#daa450] hover:bg-[#daa450]/5 cursor-pointer transition-all flex-1">
                <input
                  type="radio"
                  name={question.id}
                  value="yes"
                  checked={answer === 'yes'}
                  onChange={() => handleAnswerChange(question.id, 'yes')}
                  className="mr-3 w-5 h-5 text-[#daa450] focus:ring-[#daa450] border-gray-300"
                />
                <span className="text-gray-900 text-lg">Yes</span>
              </label>
              <label className="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-[#daa450] hover:bg-[#daa450]/5 cursor-pointer transition-all flex-1">
                <input
                  type="radio"
                  name={question.id}
                  value="no"
                  checked={answer === 'no'}
                  onChange={() => handleAnswerChange(question.id, 'no')}
                  className="mr-3 w-5 h-5 text-[#daa450] focus:ring-[#daa450] border-gray-300"
                />
                <span className="text-gray-900 text-lg">No</span>
              </label>
            </div>
          );

        default:
          return null;
      }
    };

    return (
      <div key={question.id} className="mb-8">
        <label className="block text-xl font-semibold text-gray-900 mb-3">
          {question.questionText}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {renderInput()}
      </div>
    );
  };

  if (loading) {
    return (
      <RoleProtected requiredRole="client">
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderBottomColor: '#daa450' }}></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </RoleProtected>
    );
  }

  if (questionnaireStatus === 'submitted' || questionnaireStatus === 'completed') {
    return (
      <RoleProtected requiredRole="client">
        <div className="min-h-screen bg-white flex">
          <ClientNavigation />
          <div className="flex-1 ml-4 lg:ml-8 p-5 lg:p-6">
            <div className="max-w-3xl mx-auto">
              <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-8 text-center">
                <div className="text-6xl mb-4">🎯</div>
                <h1 className="text-3xl font-bold text-gray-900 mb-4">Goals Questionnaire Complete!</h1>
                <p className="text-gray-600 mb-6">Your goals have been created based on your responses.</p>
                <Link
                  href="/client-portal/goals"
                  className="inline-block px-6 py-3 rounded-xl lg:rounded-lg text-white font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
                  style={{ backgroundColor: '#daa450' }}
                >
                  View Your Goals
                </Link>
              </div>
            </div>
          </div>
        </div>
      </RoleProtected>
    );
  }

  const currentSectionData = GOALS_QUESTIONNAIRE_SECTIONS.find(s => s.id === currentSection);
  const sectionQuestions = getGoalsQuestionsBySection(currentSection, responses);
  const isLastSection = currentSection === GOALS_QUESTIONNAIRE_SECTIONS.length;

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-white flex">
        <ClientNavigation />
        
        <div className="flex-1 ml-4 lg:ml-8 p-5 lg:p-6">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <div className="px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6 border-b-2 mb-4 rounded-t-2xl lg:rounded-t-3xl" style={{ backgroundColor: '#fef9e7', borderColor: '#daa450' }}>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Set Your 2026 Goals</h1>
                <p className="text-gray-600 text-sm lg:text-base">Answer a few questions to help us create your personalized goals</p>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Section {currentSection} of {GOALS_QUESTIONNAIRE_SECTIONS.length}</span>
                  <span>{Math.round(progress.completionPercentage)}% Complete</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="h-3 rounded-full transition-all duration-300"
                    style={{
                      width: `${progress.completionPercentage}%`,
                      backgroundColor: '#daa450'
                    }}
                  ></div>
                </div>
              </div>

              {/* Section Navigation */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {GOALS_QUESTIONNAIRE_SECTIONS.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setCurrentSection(section.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                      currentSection === section.id
                        ? 'bg-[#daa450] text-white'
                        : progress.completedSections.includes(section.id)
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {section.icon} {section.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Current Section */}
            <div className="bg-white rounded-2xl lg:rounded-3xl shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-gray-100 p-6 lg:p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {currentSectionData?.icon} {currentSectionData?.name}
                </h2>
                <p className="text-gray-600">{currentSectionData?.description}</p>
              </div>

              <div className="space-y-6">
                {sectionQuestions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">
                      No questions available for this section based on your previous selections.
                    </p>
                    <p className="text-sm text-gray-400">
                      You can still continue to the next section or go back to modify your answers.
                    </p>
                  </div>
                ) : (
                  sectionQuestions.map(question => renderQuestion(question))
                )}
              </div>

              {/* Navigation Buttons */}
              <div className="mt-8 pt-6 border-t border-gray-200 flex justify-between">
                <button
                  onClick={handlePreviousSection}
                  disabled={currentSection === 1}
                  className={`px-6 py-3 rounded-xl lg:rounded-lg font-semibold transition-all ${
                    currentSection === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Previous
                </button>

                <div className="flex gap-3">
                  {saved && (
                    <span className="px-4 py-3 text-green-600 text-sm font-medium flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Saved
                    </span>
                  )}
                  <button
                    onClick={handleSectionSave}
                    disabled={saving}
                    className="px-6 py-3 rounded-xl lg:rounded-lg font-semibold transition-all bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Progress'}
                  </button>
                </div>

                {isLastSection ? (
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="px-6 py-3 rounded-xl lg:rounded-lg text-white font-semibold transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50"
                    style={{ backgroundColor: '#daa450' }}
                  >
                    {submitting ? 'Submitting...' : 'Submit & Create Goals'}
                  </button>
                ) : (
                  <button
                    onClick={handleNextSection}
                    className="px-6 py-3 rounded-xl lg:rounded-lg text-white font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
                    style={{ backgroundColor: '#daa450' }}
                  >
                    Next Section
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
}

