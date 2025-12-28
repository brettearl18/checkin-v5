'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleProtected } from '@/components/ProtectedRoute';
import ClientNavigation from '@/components/ClientNavigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ONBOARDING_SECTIONS, ONBOARDING_QUESTIONS, getQuestionsBySection, type OnboardingQuestion } from '@/lib/onboarding-questions';

interface OnboardingResponse {
  [questionId: string]: any;
}

interface OnboardingProgress {
  currentSection: number;
  completedSections: number[];
  totalQuestions: number;
  answeredQuestions: number;
  completionPercentage: number;
}

export default function OnboardingQuestionnairePage() {
  const { userProfile } = useAuth();
  const router = useRouter();
  const [clientId, setClientId] = useState<string | null>(null);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [currentSection, setCurrentSection] = useState(1);
  const [responses, setResponses] = useState<OnboardingResponse>({});
  const [progress, setProgress] = useState<OnboardingProgress>({
    currentSection: 1,
    completedSections: [],
    totalQuestions: ONBOARDING_QUESTIONS.length,
    answeredQuestions: 0,
    completionPercentage: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [onboardingStatus, setOnboardingStatus] = useState<'not_started' | 'in_progress' | 'completed' | 'skipped' | 'submitted'>('not_started');

  useEffect(() => {
    if (userProfile?.email) {
      fetchClientData();
    }
  }, [userProfile?.email]);

  useEffect(() => {
    if (clientId) {
      fetchOnboardingData();
    }
  }, [clientId]);

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

  const fetchOnboardingData = async () => {
    try {
      const response = await fetch(`/api/client-portal/onboarding?clientId=${clientId}`);
      const data = await response.json();
      
      if (data.success) {
        setOnboardingStatus(data.onboardingStatus || 'not_started');
        
        if (data.onboardingData) {
          const savedResponses = data.onboardingData.responses || {};
          // Load all saved responses - replace state with server data to ensure consistency
          setResponses(savedResponses);
          if (data.onboardingData.progress) {
            setProgress(data.onboardingData.progress);
          }
          const savedSection = data.onboardingData.progress?.currentSection || 1;
          setCurrentSection(savedSection);
        }
        
        if (data.onboardingStatus === 'completed') {
          // Redirect to dashboard if already completed
          router.push('/client-portal');
        }
      }
    } catch (error) {
      console.error('Error fetching onboarding data:', error);
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
      const sectionQuestions = getQuestionsBySection(currentSection);
      
      // Include follow-up question responses for this section
      const allSectionResponses: OnboardingResponse = {};
      sectionQuestions.forEach(question => {
        if (responses[question.id] !== undefined) {
          allSectionResponses[question.id] = responses[question.id];
        }
        // Also include follow-up responses if they exist
        if (responses[`${question.id}_followup`] !== undefined) {
          allSectionResponses[`${question.id}_followup`] = responses[`${question.id}_followup`];
        }
      });

      // Check if section is complete (all required questions answered)
      const sectionComplete = sectionQuestions.every(question => {
        if (!question.required) return true;
        const answer = responses[question.id];
        return answer !== undefined && answer !== null && answer !== '';
      });

      const response = await fetch('/api/client-portal/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId,
          coachId,
          section: currentSection,
          responses: allSectionResponses, // Send all responses for this section (including follow-ups)
          markSectionComplete: sectionComplete
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Refetch all responses to ensure we have the latest merged data from the server
        // This ensures responses from all sections are loaded, not just the current one
        await fetchOnboardingData();
        
        setSaved(true);
        setProgress(data.progress);
        setOnboardingStatus(data.status);
        
        setTimeout(() => setSaved(false), 3000);

        // If all sections complete, redirect after a delay
        if (data.allSectionsComplete) {
          setTimeout(() => {
            router.push('/client-portal');
          }, 2000);
        }
      } else {
        alert('Failed to save responses. Please try again.');
      }
    } catch (error) {
      console.error('Error saving section:', error);
      alert('An error occurred while saving. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSectionChange = async (section: number) => {
    // Save current section before switching
    if (clientId) {
      await handleSectionSave();
    }
    setCurrentSection(section);
  };

  const handleSubmitToCoach = async () => {
    if (!clientId || !coachId) {
      alert('Unable to submit: Missing client or coach information.');
      return;
    }

    // First, save the current section
    await handleSectionSave();

    // Check if all sections are complete
    if (progress.completedSections.length < 10) {
      const incompleteSections = 10 - progress.completedSections.length;
      if (!confirm(`You have ${incompleteSections} incomplete section(s). Do you want to submit anyway? Your coach will see what you've completed so far.`)) {
        return;
      }
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/client-portal/onboarding/submit', {
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
        setOnboardingStatus('submitted');
        alert('Onboarding submitted successfully! Your coach has been notified and will review your responses.');
        router.push('/client-portal');
      } else {
        alert(data.message || 'Failed to submit onboarding. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting onboarding:', error);
      alert('An error occurred while submitting. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestion = (question: OnboardingQuestion) => {
    const answer = responses[question.id];
    const followUpAnswer = responses[`${question.id}_followup`];

    // Handle conditional questions
    if (question.conditionalLogic) {
      const dependsOnAnswer = responses[question.conditionalLogic.dependsOn];
      let shouldShow = false;

      if (question.conditionalLogic.condition === 'equals') {
        shouldShow = dependsOnAnswer === question.conditionalLogic.value;
      } else if (question.conditionalLogic.condition === 'contains') {
        shouldShow = Array.isArray(dependsOnAnswer) && dependsOnAnswer.includes(question.conditionalLogic.value);
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
              placeholder="Enter a number"
            />
          );

        case 'text':
          return (
            <input
              type="text"
              value={answer || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#daa450] focus:border-[#daa450] text-gray-900 text-lg"
              placeholder="Type your answer"
            />
          );

        case 'textarea':
          return (
            <textarea
              value={answer || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#daa450] focus:border-[#daa450] text-gray-900 text-lg resize-y"
              placeholder="Type your answer"
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
                    type={question.questionText.includes('Select all') || question.questionText.includes('all that apply') ? 'checkbox' : 'radio'}
                    name={question.id}
                    value={option}
                    checked={
                      question.questionText.includes('Select all') || question.questionText.includes('all that apply')
                        ? Array.isArray(answer) && answer.includes(option)
                        : answer === option
                    }
                    onChange={(e) => {
                      if (question.questionText.includes('Select all') || question.questionText.includes('all that apply')) {
                        const currentAnswers = Array.isArray(answer) ? answer : [];
                        const newAnswers = e.target.checked
                          ? [...currentAnswers, option]
                          : currentAnswers.filter((a: string) => a !== option);
                        handleAnswerChange(question.id, newAnswers);
                      } else {
                        handleAnswerChange(question.id, option);
                      }
                    }}
                    className="w-5 h-5 text-[#daa450] border-gray-300 focus:ring-[#daa450] focus:ring-2"
                  />
                  <span className="ml-3 text-gray-900 text-lg">{option}</span>
                </label>
              ))}
            </div>
          );

        case 'scale':
          const scaleMin = question.scaleConfig?.min || 1;
          const scaleMax = question.scaleConfig?.max || 10;
          const scaleSteps = Array.from({ length: scaleMax - scaleMin + 1 }, (_, i) => scaleMin + i);
          
          return (
            <div className="space-y-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>{question.scaleConfig?.labelMin || scaleMin}</span>
                <span>{question.scaleConfig?.labelMax || scaleMax}</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {scaleSteps.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleAnswerChange(question.id, value)}
                    className={`flex-1 min-w-[60px] py-3 px-4 rounded-xl font-semibold text-lg transition-all ${
                      answer === value
                        ? 'bg-[#daa450] text-white shadow-lg scale-105'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
          );

        case 'yes_no':
          return (
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => handleAnswerChange(question.id, true)}
                className={`flex-1 py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
                  answer === true
                    ? 'bg-green-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => handleAnswerChange(question.id, false)}
                className={`flex-1 py-4 px-6 rounded-xl font-semibold text-lg transition-all ${
                  answer === false
                    ? 'bg-red-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                No
              </button>
            </div>
          );

        default:
          return null;
      }
    };

    return (
      <div key={question.id} className="mb-8">
        <label className="block text-xl font-bold text-gray-900 mb-4">
          {question.questionText}
          {question.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {renderInput()}
        
        {/* Follow-up question - show if yes/no answer is true, or if answer exists for other types */}
        {question.followUpQuestion && (question.questionType === 'yes_no' ? answer === true : (answer !== undefined && answer !== null && answer !== '')) && (
          <div className="mt-6 pl-6 border-l-4 border-[#daa450]">
            <label className="block text-lg font-semibold text-gray-900 mb-3">
              {question.followUpQuestion.questionText}
            </label>
            {question.followUpQuestion.questionType === 'number' && (
              <input
                type="number"
                value={followUpAnswer || ''}
                onChange={(e) => handleAnswerChange(`${question.id}_followup`, e.target.value ? Number(e.target.value) : '')}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#daa450] focus:border-[#daa450] text-gray-900 text-lg"
              />
            )}
            {question.followUpQuestion.questionType === 'text' && (
              <input
                type="text"
                value={followUpAnswer || ''}
                onChange={(e) => handleAnswerChange(`${question.id}_followup`, e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#daa450] focus:border-[#daa450] text-gray-900 text-lg"
              />
            )}
            {question.followUpQuestion.questionType === 'textarea' && (
              <textarea
                value={followUpAnswer || ''}
                onChange={(e) => handleAnswerChange(`${question.id}_followup`, e.target.value)}
                rows={4}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#daa450] focus:border-[#daa450] text-gray-900 text-lg resize-y"
              />
            )}
            {question.followUpQuestion.questionType === 'multiple_choice' && question.followUpQuestion.options && (
              <div className="space-y-3">
                {question.followUpQuestion.options.map((option, index) => (
                  <label
                    key={index}
                    className="flex items-center p-4 border-2 border-gray-200 rounded-xl hover:border-[#daa450] hover:bg-[#daa450]/5 cursor-pointer transition-all"
                  >
                    <input
                      type="radio"
                      name={`${question.id}_followup`}
                      value={option}
                      checked={followUpAnswer === option}
                      onChange={(e) => handleAnswerChange(`${question.id}_followup`, option)}
                      className="w-5 h-5 text-[#daa450] border-gray-300 focus:ring-[#daa450] focus:ring-2"
                    />
                    <span className="ml-3 text-gray-900 text-lg">{option}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <RoleProtected requiredRole="client">
        <div className="min-h-screen bg-[#FAFAFA] flex">
          <ClientNavigation />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#daa450] mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading questionnaire...</p>
            </div>
          </div>
        </div>
      </RoleProtected>
    );
  }

  const sectionQuestions = getQuestionsBySection(currentSection);
  const sectionInfo = ONBOARDING_SECTIONS.find(s => s.id === currentSection);

  return (
    <RoleProtected requiredRole="client">
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col lg:flex-row">
        <ClientNavigation />
        
        <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <Link
                href="/client-portal"
                className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Dashboard
              </Link>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Onboarding Questionnaire</h1>
              <p className="text-gray-600 text-lg">
                Help us understand your goals, preferences, and baseline health. You can save each section and return later.
              </p>
            </div>

            {/* Progress Bar */}
            <div className="mb-8 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-gray-700">
                  Progress: {progress.completionPercentage}%
                </span>
                <span className="text-sm text-gray-600">
                  {progress.answeredQuestions} of {progress.totalQuestions} questions answered
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-[#daa450] h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress.completionPercentage}%` }}
                ></div>
              </div>
            </div>

            {/* Section Navigation */}
            <div className="mb-8 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {ONBOARDING_SECTIONS.map((section) => {
                  const isCompleted = progress.completedSections.includes(section.id);
                  const isCurrent = currentSection === section.id;
                  
                  return (
                    <button
                      key={section.id}
                      onClick={() => handleSectionChange(section.id)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        isCurrent
                          ? 'border-[#daa450] bg-[#daa450]/10'
                          : isCompleted
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-2xl mb-2">{section.icon}</div>
                      <div className="text-xs font-semibold text-gray-900">{section.id}</div>
                      <div className={`text-[10px] mt-1 ${isCompleted ? 'text-green-600' : 'text-gray-500'}`}>
                        {isCompleted ? '✓ Complete' : 'Pending'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Current Section */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 mb-6">
              <div className="mb-6 pb-4 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  Section {currentSection}: {sectionInfo?.name}
                </h2>
                <p className="text-gray-600 mt-1">
                  {sectionQuestions.length} question{sectionQuestions.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="space-y-8">
                {sectionQuestions.map(question => renderQuestion(question))}
              </div>
            </div>

            {/* Save Section Button */}
            <div className="flex items-center justify-between bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center space-x-4">
                {saved && (
                  <div className="flex items-center text-green-600">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-medium">Section saved!</span>
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-4">
                {currentSection > 1 && (
                  <button
                    onClick={() => handleSectionChange(currentSection - 1)}
                    className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                  >
                    Previous Section
                  </button>
                )}
                <button
                  onClick={handleSectionSave}
                  disabled={saving}
                  className="px-6 py-3 bg-[#daa450] hover:bg-[#c89540] text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Section'}
                </button>
                {currentSection < 10 && (
                  <button
                    onClick={() => handleSectionChange(currentSection + 1)}
                    className="px-6 py-3 bg-[#daa450] hover:bg-[#c89540] text-white rounded-xl font-medium transition-colors"
                  >
                    Next Section
                  </button>
                )}
                {currentSection === 10 && (
                  <button
                    onClick={handleSubmitToCoach}
                    disabled={submitting || saving}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Submitting...' : 'Submit to Coach'}
                  </button>
                )}
              </div>
            </div>

            {/* Skip Option */}
            <div className="mt-6 text-center">
              <Link
                href="/client-portal"
                className="text-gray-600 hover:text-gray-900 text-sm"
              >
                Skip for now and continue to dashboard →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </RoleProtected>
  );
}

