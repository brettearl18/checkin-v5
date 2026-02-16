'use client';

import { useState } from 'react';

interface Guide {
  id: string;
  category: string;
  title: string;
  content: string;
}

const guides: Guide[] = [
  // Getting Started
  {
    id: 'first-checkin',
    category: 'Getting Started',
    title: 'How to Complete Your First Check-in',
    content: `Step 1: Navigate to "Check-ins" in the menu
Step 2: Find your assigned check-in (it will show as "Due" or "Open")
Step 3: Click "Start Check-in" or "Continue Check-in"
Step 4: Read each question carefully and answer honestly
Step 5: Use the navigation buttons to move between questions
Step 6: Review all your responses before submitting
Step 7: Click "Submit Check-in" when you're ready

Tips:
- You can save your progress and come back later
- Be honest in your answers - this helps your coach support you better
- If you're unsure about a question, answer as best you can`
  },
  {
    id: 'onboarding-questionnaire',
    category: 'Getting Started',
    title: 'How to Fill Out Your Onboarding Questionnaire',
    content: `The onboarding questionnaire helps us understand your starting point and goals.

Step 1: Go to "Dashboard" and look for the onboarding section
Step 2: Click "Complete Onboarding Questionnaire"
Step 3: Answer each question thoughtfully
Step 4: Take your time - there's no rush
Step 5: Submit when complete

What to expect:
- Questions about your health goals
- Questions about your current lifestyle
- Questions about your preferences and challenges
- Takes about 10-15 minutes to complete`
  },
  {
    id: 'upload-photos',
    category: 'Getting Started',
    title: 'How to Upload Progress Photos',
    content: `Progress photos help track your visual progress over time.

Step 1: Go to "Progress Images" in the menu
Step 2: Choose the photo type (Before, After, or Progress)
Step 3: Choose the orientation (Front, Side, or Back)
Step 4: Click "Choose File" or drag and drop your photo
Step 5: Wait for upload to complete
Step 6: Add an optional caption if you'd like
Step 7: Click "Upload"

Tips for good photos:
- Use consistent lighting
- Take photos at the same time of day
- Wear similar clothing
- Use a plain background
- Stand in the same position
- Take photos from the same distance`
  },
  {
    id: 'baseline-measurements',
    category: 'Getting Started',
    title: 'How to Set Up Your Baseline Measurements',
    content: `Baseline measurements are your starting point for tracking progress.

Step 1: Go to "Measurements" in the menu
Step 2: Click "Set Up Baseline" or "Update Measurements"
Step 3: Enter your measurements:
   - Body weight (if applicable)
   - Body measurements (chest, waist, hips, etc.)
Step 4: Click "Complete Setup" when done

Tips:
- Measure at the same time of day
- Use the same measuring tape
- Measure in the same place on your body
- Don't pull the tape too tight or too loose
- Measurements are optional but helpful for tracking progress`
  },
  // Check-ins
  {
    id: 'complete-checkin',
    category: 'Check-ins',
    title: 'How to Complete a Check-in',
    content: `Regular check-ins help your coach track your progress and provide support.

Step 1: Go to "Check-ins" in the menu
Step 2: Find your check-in in the "To Do" section
Step 3: Click "Start Check-in"
Step 4: Answer each question:
   - Multiple choice: Select one option
   - Scale/Rating: Move the slider or select a number
   - Text: Type your response
Step 5: Use "Previous" and "Next" to navigate
Step 6: Review your answers on the review page
Step 7: Click "Submit Check-in"

Note: You can save and come back later if needed.`
  },
  {
    id: 'checkin-windows',
    category: 'Check-ins',
    title: 'Understanding Check-in Windows',
    content: `Check-in windows are the time periods when you can complete your check-ins.

What is a check-in window?
- A specific time period when your check-in is available
- Usually opens a few days before the due date
- Closes a few days after the due date

How do I know when my check-in window is open?
- Check-ins show as "Open" in green when the window is open
- Check-ins show the window dates below the title
- You'll receive an email when your window opens

What happens if the window closes?
- On Check-ins, go to "Missed check-ins" and tap "Request coach to reopen"
- Your coach gets a message and can reopen it for you
- You can also message your coach from the Messages section
- Always try to complete check-ins during the window if possible`
  },
  {
    id: 'miss-checkin',
    category: 'Check-ins',
    title: 'What to Do If You Miss a Check-in',
    content: `Life happens! If you miss a check-in, here's what to do:

Option 1: Request Reopen (easiest)
- Go to Check-ins and scroll to "Missed check-ins"
- Tap "Request coach to reopen" for the check-in you want to complete
- Your coach gets a message and can reopen it; it will then appear as "Current Check-in"

Option 2: Message Your Coach
- Send a message via the Messages section
- Explain why you missed it and ask to complete it

Option 3: Check If It's Still Open
- Check the "To Do" section - your coach may have already reopened it

Tips:
- Set reminders on your phone
- Try to complete check-ins early in the window
- One missed check-in isn't the end of the world – focus on the next one`
  },
  {
    id: 'edit-checkin',
    category: 'Check-ins',
    title: 'How to Edit a Submitted Check-in',
    content: `Need to change an answer after submitting?

Step 1: Go to "Check-ins" in the menu
Step 2: Find your check-in in the "Completed" section
Step 3: Look for "Edit Responses" button (if available)
Step 4: Make your changes
Step 5: Resubmit

Note: 
- Editing may not always be available
- Some check-ins are locked after review
- If you don't see an edit option, contact your coach
- Your coach can help you update responses if needed`
  },
  // Questionnaires
  {
    id: 'goals-questionnaire',
    category: 'Questionnaires',
    title: 'How to Complete the Goals Questionnaire',
    content: `The goals questionnaire helps you set and track your wellness goals.

Step 1: Go to "Goals" in the menu
Step 2: Click "Complete Goals Questionnaire" if you see it
Step 3: Answer questions about:
   - Your short-term goals
   - Your long-term goals
   - What success looks like for you
   - What challenges you anticipate
Step 4: Review your responses
Step 5: Submit

Your coach will review your goals and help you achieve them.`
  },
  {
    id: 'question-types',
    category: 'Questionnaires',
    title: 'Understanding Question Types',
    content: `Different questions require different types of answers:

Multiple Choice:
- Select one option from a list
- Click the circle or box next to your choice

Scale/Rating:
- Use a slider or select a number
- Usually from 1-10 or similar range
- Represents how you feel about something

Text Response:
- Type your answer in the text box
- Can be short or long
- Be as detailed as you'd like

Yes/No Questions:
- Simply click Yes or No
- Some may have a "Maybe" or "Not Sure" option

Date Pickers:
- Click the calendar icon
- Select the date from the calendar
- Or type the date in the format shown

Tip: Always read the question carefully before answering.`
  },
  // Progress Tracking
  {
    id: 'good-photos',
    category: 'Progress Tracking',
    title: 'How to Take Good Before/After Photos',
    content: `Good photos make it easier to see your progress:

Lighting:
- Use natural light when possible
- Avoid harsh shadows
- Face a window for front photos

Consistency:
- Take photos at the same time of day
- Use the same location/background
- Wear the same type of clothing

Position:
- Stand in the same spot
- Use the same distance from camera
- Maintain the same pose/angle

Quality:
- Use a plain, light-colored background
- Make sure the camera is level
- Take full-body photos when possible
- Avoid mirrors when possible (use timer instead)

Clothing:
- Wear form-fitting clothing
- Same outfit for consistency
- Minimal clothing for best comparison

Remember: The goal is to accurately track your progress, so consistency is key!`
  },
  {
    id: 'update-measurements',
    category: 'Progress Tracking',
    title: 'How to Update Your Measurements',
    content: `Regular measurement updates help track your progress:

Step 1: Go to "Measurements" in the menu
Step 2: Click "Update Measurements"
Step 3: Enter your current measurements
Step 4: Click "Save"

When to update:
- Weekly or bi-weekly for best tracking
- Same time of day each time
- Same day of the week if possible

How to measure:
- Use a soft measuring tape
- Measure at the widest/narrowest points
- Don't pull too tight or too loose
- Record immediately after measuring

Tips:
- Measure before eating or drinking
- Measure in the morning if possible
- Have someone help for hard-to-reach areas
- Take measurements in the same place each time`
  },
  {
    id: 'progress-dashboard',
    category: 'Progress Tracking',
    title: 'Understanding Your Progress Dashboard',
    content: `Your dashboard shows your overall progress and stats:

Key Sections:

1. Check-ins Requiring Attention
   - Shows check-ins that need to be completed
   - Green = Open, Yellow = Due Soon, Red = Overdue

2. Average Score & Completion Rate
   - Your average score across all check-ins
   - Percentage of check-ins completed
   - Trend indicators (up/down arrows)

3. Recent Progress
   - Latest check-in scores
   - Progress over time graph
   - Key metrics

4. Progress Images
   - Latest before/after photos
   - Visual progress tracking

Traffic Light System:
- 🟢 Green: Doing great! Keep it up
- 🟠 Orange: Good progress, some areas to focus on
- 🔴 Red: Needs attention, your coach can help

Your coach reviews your progress regularly and will reach out if needed.`
  },
  // Goals & Progress
  {
    id: 'set-goals',
    category: 'Goals & Progress',
    title: 'How to Set Goals',
    content: `Setting clear goals helps you stay motivated:

Step 1: Go to "Goals" in the menu
Step 2: Complete the goals questionnaire if you haven't already
Step 3: Think about:
   - What do you want to achieve?
   - Why is this important to you?
   - When do you want to achieve it?
   - What steps will help you get there?

Step 4: Write down your goals
Step 5: Review them regularly

Tips for good goals:
- Be specific (not "get healthier" but "lose 10 lbs")
- Make them measurable
- Set realistic timelines
- Break big goals into smaller steps
- Share your goals with your coach

Your coach will help you refine your goals and create a plan to achieve them.`
  },
  {
    id: 'view-progress',
    category: 'Goals & Progress',
    title: 'How to View Your Progress Over Time',
    content: `Track your progress to stay motivated:

Step 1: Go to "Progress" in the menu
Step 2: Select a time range (Week, Month, 3 Months, etc.)
Step 3: View your progress graphs:
   - Overall score trends
   - Individual question progress
   - Completion rates

Step 4: Compare different time periods
Step 5: Look for patterns and trends

What to look for:
- Overall upward trends = progress!
- Consistent scores = maintaining progress
- Spikes or drops = may need attention
- Completion rate = staying consistent

Remember: Progress isn't always linear. Small ups and downs are normal!`
  },
  {
    id: 'traffic-light-system',
    category: 'Goals & Progress',
    title: 'Understanding Your Score and Traffic Light System',
    content: `Your check-ins are scored and color-coded for easy understanding:

What is a score?
- Each check-in gets a score out of 100
- Based on your answers to questions
- Higher scores = better responses

Traffic Light Colors:

🟢 Green (86-100%):
- Doing excellent!
- Keep up the great work
- You're on track with your goals

🟠 Orange (61-85%):
- Good progress overall
- Some areas could use attention
- Your coach may provide targeted support

🔴 Red (0-60%):
- Needs more focus
- Your coach will reach out to help
- This is a learning opportunity, not a failure

How to improve your score:
- Be consistent with check-ins
- Follow your coach's recommendations
- Make small, sustainable changes
- Don't be too hard on yourself

Remember: The score is a tool to help track progress, not a judgment of your worth!`
  },
  // Communication
  {
    id: 'message-coach',
    category: 'Communication',
    title: 'How to Message Your Coach',
    content: `Stay in touch with your coach through the messaging system:

Step 1: Go to "Messages" in the menu
Step 2: Type your message in the text box at the bottom
Step 3: Click "Send" or press Enter
Step 4: Wait for your coach to respond

Tips:
- Messages are private between you and your coach
- Your coach typically responds within 24-48 hours
- Be clear about what you need help with
- Don't hesitate to ask questions

What to message about:
- Questions about your program
- Need to reschedule or miss a check-in
- Concerns or challenges you're facing
- Celebrations and wins!
- Feedback about your experience`
  },
  {
    id: 'view-feedback',
    category: 'Communication',
    title: 'How to View Coach Feedback',
    content: `Your coach provides feedback on your check-ins:

Step 1: Go to "Check-ins" in the menu
Step 2: Find a completed check-in
Step 3: Look for "View Feedback" or "Coach Response"
Step 4: Read your coach's comments and insights

Types of feedback:
- Text responses to your answers
- Overall progress notes
- Recommendations for next steps
- Encouragement and support
- Questions for clarification

How to respond:
- Use the messaging system if you have questions
- Implement the recommendations
- Share how things are going

Remember: Feedback is meant to help you succeed, not judge you!`
  },
];

const categories = Array.from(new Set(guides.map(g => g.category)));

export default function HelpGuides() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null);

  const filteredGuides = selectedCategory === 'all'
    ? guides
    : guides.filter(guide => guide.category === selectedCategory);

  return (
    <div className="p-3 sm:p-4 lg:p-8">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-2">Help & How-To Guides</h2>
        <p className="text-gray-600 text-xs sm:text-sm lg:text-base">
          Step-by-step instructions for using the platform
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
          All Guides
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

      {/* Guides List */}
      <div className="space-y-3 sm:space-y-4">
        {filteredGuides.map((guide) => (
          <div
            key={guide.id}
            className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
          >
            <button
              onClick={() => setExpandedGuide(expandedGuide === guide.id ? null : guide.id)}
              className="w-full px-4 sm:px-6 py-3 sm:py-4 text-left flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0 pr-2">
                <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1 break-words">{guide.title}</h3>
                <p className="text-xs text-gray-500">{guide.category}</p>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transform transition-transform flex-shrink-0 ${
                  expandedGuide === guide.id ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedGuide === guide.id && (
              <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm text-gray-700 leading-relaxed break-words overflow-wrap-anywhere">
                    {guide.content}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredGuides.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No guides found in this category.
        </div>
      )}
    </div>
  );
}

