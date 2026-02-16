'use client';

import { useState } from 'react';

interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  // Account & Login
  {
    id: 'reset-password',
    category: 'Account & Login',
    question: 'How do I reset my password?',
    answer: `Click "Forgot password?" on the login page, enter your email address, and check your inbox for reset instructions. The reset link will be valid for a limited time.`
  },
  {
    id: 'update-email',
    category: 'Account & Login',
    question: 'How do I update my email address?',
    answer: `Contact your coach to update your email address. They can update it in your profile, or you can update it in your Profile settings if the option is available.`
  },
  {
    id: 'locked-out',
    category: 'Account & Login',
    question: 'I\'m locked out of my account. What should I do?',
    answer: `If you've forgotten your password, use the "Forgot password?" link on the login page. If you're still having trouble, contact your coach or use the "Report Issue" section to get help.`
  },
  // Check-ins
  {
    id: 'checkin-frequency',
    category: 'Check-ins',
    question: 'How often do I need to complete check-ins?',
    answer: `Check-in frequency depends on your program. Typically, clients complete weekly check-ins. Your coach will assign check-ins based on your program schedule. Check the "Check-ins" page to see your upcoming assignments.`
  },
  {
    id: 'miss-checkin',
    category: 'Check-ins',
    question: 'What happens if I miss a check-in?',
    answer: `On the Check-ins page, scroll to "Missed check-ins" and tap "Request coach to reopen" for the one you want to complete. Your coach will get a message and can reopen it for you. You can also message your coach via Messages. Don't worry - one missed check-in isn't a problem, but try to complete them on time for best results.`
  },
  {
    id: 'edit-checkin',
    category: 'Check-ins',
    question: 'Can I edit a check-in after submitting?',
    answer: `Some check-ins can be edited after submission if they haven't been reviewed yet. Look for an "Edit Responses" button on completed check-ins. If editing isn't available, contact your coach - they can help you update your responses.`
  },
  {
    id: 'no-checkin-visible',
    category: 'Check-ins',
    question: 'Why can\'t I see my check-in yet?',
    answer: `Check-ins have specific "windows" when they're available (usually Friday–Tuesday). If you don't see one: (1) Check "Current Check-in" and "Next Check-in" at the top of the Check-ins page. (2) If you missed it, scroll to "Missed check-ins" and use "Request coach to reopen". (3) You can also message your coach from Support.`
  },
  // Progress & Measurements
  {
    id: 'measurement-frequency',
    category: 'Progress & Measurements',
    question: 'How often should I update my measurements?',
    answer: `We recommend updating measurements weekly or bi-weekly for best tracking. However, measurements are optional. Update them when you feel comfortable, or as recommended by your coach.`
  },
  {
    id: 'photos-not-showing',
    category: 'Progress & Measurements',
    question: 'Why aren\'t my photos showing up?',
    answer: `Photos may take a moment to upload. If they don't appear after a few minutes, try refreshing the page. Make sure your photos are in a supported format (JPG, PNG). If the problem persists, contact your coach or report the issue.`
  },
  {
    id: 'required-measurements',
    category: 'Progress & Measurements',
    question: 'What measurements are required?',
    answer: `Measurements are optional, but helpful for tracking progress. Common measurements include body weight, chest, waist, hips, and other areas relevant to your goals. You can choose which measurements to track.`
  },
  {
    id: 'delete-photo',
    category: 'Progress & Measurements',
    question: 'How do I delete a progress photo?',
    answer: `Go to "Progress Images", find the photo you want to delete, and look for a delete or trash icon. If you don't see this option, contact your coach - they can help remove photos.`
  },
  // Scores & Ratings
  {
    id: 'score-calculation',
    category: 'Scores & Ratings',
    question: 'How is my score calculated?',
    answer: `Your score is calculated based on your answers to check-in questions. Each question contributes to your overall score. Text questions (like comments) don't affect the score - only measurable questions are included. The score represents how well you're tracking with your program goals.`
  },
  {
    id: 'traffic-light-colors',
    category: 'Scores & Ratings',
    question: 'What do the traffic light colors mean?',
    answer: `🟢 Green (86-100%): Doing excellent! Keep up the great work.
🟠 Orange (61-85%): Good progress, some areas may need attention.
🔴 Red (0-60%): Needs more focus - your coach will reach out to help.
These ranges may vary based on your specific program settings.`
  },
  {
    id: 'score-change',
    category: 'Scores & Ratings',
    question: 'Why did my score change?',
    answer: `Scores change based on your check-in responses. If you answered questions differently, your score will reflect that. Score changes are normal and help track your progress over time. Focus on overall trends rather than individual check-ins.`
  },
  {
    id: 'improve-score',
    category: 'Scores & Ratings',
    question: 'How can I improve my score?',
    answer: `Improve your score by:
- Being consistent with check-ins
- Following your coach's recommendations
- Making sustainable lifestyle changes
- Focusing on progress, not perfection
- Communicating with your coach about challenges
Remember: The score is a tool to track progress, not a judgment of your worth!`
  },
  // Technical Issues
  {
    id: 'page-not-loading',
    category: 'Technical Issues',
    question: 'The page isn\'t loading. What should I do?',
    answer: `Try these steps:
1. Refresh the page (Ctrl+R or Cmd+R)
2. Clear your browser cache
3. Try a different browser
4. Check your internet connection
5. Wait a few minutes and try again
If the problem persists, report the issue using the "Report Issue" tab.`
  },
  {
    id: 'error-message',
    category: 'Technical Issues',
    question: 'I\'m seeing an error message. What does it mean?',
    answer: `Error messages usually indicate a temporary problem. Try:
1. Refreshing the page
2. Checking your internet connection
3. Waiting a few minutes and trying again
If the error persists, take a screenshot and report it using the "Report Issue" tab. Include the error message and what you were doing when it appeared.`
  },
  {
    id: 'browser-console',
    category: 'Technical Issues',
    question: 'How do I access the browser console?',
    answer: `Chrome/Edge: Press F12 or Right-click → Inspect, then click "Console" tab
Safari: Enable Developer menu (Safari → Preferences → Advanced → Show Develop menu), then press Cmd+Option+C
Firefox: Press F12, then click "Console" tab
The console shows error messages that can help diagnose issues.`
  },
  {
    id: 'take-screenshot',
    category: 'Technical Issues',
    question: 'How do I take a screenshot?',
    answer: `Windows: Press Print Screen (full screen) or Windows + Shift + S (selection)
Mac: Press Cmd + Shift + 3 (full screen) or Cmd + Shift + 4 (selection)
Mobile: Press Power + Volume Down (Android) or Power + Volume Up (iPhone)
Screenshots are helpful when reporting technical issues.`
  },
  // Platform & Features
  {
    id: 'contact-coach',
    category: 'Platform & Features',
    question: 'How do I contact my coach?',
    answer: `Use the "Messages" section in the menu to send messages directly to your coach. They typically respond within 24-48 hours. You can message about questions, concerns, scheduling, or just to check in.`
  },
  {
    id: 'checkin-vs-questionnaire',
    category: 'Platform & Features',
    question: 'What is the difference between check-ins and questionnaires?',
    answer: `Check-ins are regular assessments (usually weekly) that track your progress over time. Questionnaires are one-time or occasional forms for specific purposes (onboarding, goal setting, etc.). Both help your coach understand your situation and provide support.`
  },
  {
    id: 'mobile-phone',
    category: 'Platform & Features',
    question: 'Can I use the platform on my phone?',
    answer: `Yes! The platform is fully responsive and works on mobile devices. You can complete check-ins, view progress, message your coach, and upload photos all from your phone's browser.`
  },
  {
    id: 'mobile-app',
    category: 'Platform & Features',
    question: 'Do you have a mobile app?',
    answer: `Currently, we don't have a dedicated mobile app, but the website is optimized for mobile browsers. You can add it to your home screen for an app-like experience: On iPhone, use "Add to Home Screen" in Safari. On Android, use "Add to Home screen" in Chrome.`
  },
];

const categories = Array.from(new Set(faqs.map(faq => faq.category)));

export default function FAQ() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  const filteredFAQs = selectedCategory === 'all'
    ? faqs
    : faqs.filter(faq => faq.category === selectedCategory);

  return (
    <div className="p-3 sm:p-4 lg:p-8">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-2">Frequently Asked Questions</h2>
        <p className="text-gray-600 text-xs sm:text-sm lg:text-base">
          Find quick answers to common questions
        </p>
      </div>

      {/* Category Filter */}
      <div className="mb-4 sm:mb-6 flex flex-wrap gap-2 overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 pb-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
            selectedCategory === 'all'
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Questions
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
              selectedCategory === category
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* FAQ List */}
      <div className="space-y-3">
        {filteredFAQs.map((faq) => (
          <div
            key={faq.id}
            className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
          >
            <button
              onClick={() => setExpandedFAQ(expandedFAQ === faq.id ? null : faq.id)}
              className="w-full px-4 sm:px-6 py-3 sm:py-4 text-left flex items-start justify-between bg-white hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0 pr-2">
                <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1 break-words">{faq.question}</h3>
                <p className="text-xs text-gray-500">{faq.category}</p>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 mt-1 flex-shrink-0 transform transition-transform ${
                  expandedFAQ === faq.id ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedFAQ === faq.id && (
              <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-200">
                <p className="text-xs sm:text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
                  {faq.answer}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredFAQs.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No questions found in this category.
        </div>
      )}

      {/* Additional Help */}
      <div className="mt-6 sm:mt-8 bg-blue-50 border-2 border-blue-200 rounded-xl p-4 sm:p-6">
        <p className="text-sm sm:text-base text-gray-700 mb-3">
          <strong>Still have questions?</strong>
        </p>
        <p className="text-xs sm:text-sm text-gray-600 mb-4">
          Can't find what you're looking for? Check the Help & How-To guides or contact your coach.
        </p>
        <button
          onClick={() => {
            const event = new CustomEvent('switchTab', { detail: 'report' });
            window.dispatchEvent(event);
          }}
          className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-xs sm:text-sm cursor-pointer"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Report an Issue
        </button>
      </div>
    </div>
  );
}

