# Checkin V2.0 - Client Feedback Response Feature Plan

## 🎯 Feature Overview

Enable clients to acknowledge and respond to coach feedback on their check-ins. This creates a two-way communication loop where clients can:
- Mark coach feedback as "Received and Approved"
- Provide audio or text responses to their coach's feedback
- Create a feedback conversation thread

## 📊 Current State Analysis

### Existing Implementation
- **Client Feedback View**: `/client-portal/feedback/[id]/page.tsx` - Clients can view coach feedback (voice and text)
- **Coach Feedback System**: Coaches can provide voice notes, text feedback, and emoji reactions per question
- **Feedback Storage**: Stored in `coachFeedback` collection with `responseId`, `questionId`, `feedbackType`, `content`

### Current Limitations
1. Clients can only **view** coach feedback, not respond
2. No way for clients to acknowledge receipt of feedback
3. No conversation thread between coach and client
4. No way for coach to know if client has read/received feedback

---

## 🎨 Design Requirements

### Client Feedback Response Interface

#### 1. "Received and Approved" Button
- **Location**: On `/client-portal/feedback/[id]/page.tsx` after displaying coach feedback
- **Visual Design**:
  - Green checkmark button with text "Mark as Received and Approved"
  - Once clicked, changes to "✓ Received and Approved" with date/time
  - Disabled state after approval
- **Behavior**:
  - Updates `formResponses` and `check_in_assignments` with:
    - `clientApprovedFeedback: true`
    - `clientApprovedAt: timestamp`
  - Sends notification to coach that client has acknowledged feedback

#### 2. Client Response Section
- **Location**: Below "Received and Approved" section on feedback page
- **Components**:
  - **Voice Response**:
    - Uses existing `VoiceRecorder` component
    - Button: "Record Response to Coach"
    - Playback controls for recorded response
  - **Text Response**:
    - Textarea with placeholder: "Type your response to your coach's feedback..."
    - Character counter (optional)
    - "Send Response" button
- **Visual Design**:
  - Card-based layout similar to coach feedback display
  - Blue/indigo color scheme to differentiate from coach feedback (which uses green/purple)
  - Clear separation between coach feedback (above) and client response (below)

#### 3. Response Thread Display
- Show conversation flow:
  1. Client's original check-in responses
  2. Coach's feedback (voice, text, emoji reactions)
  3. Client's response (if any)
  4. Coach's follow-up (if any)
- Visual timeline/thread view
- Timestamps for each entry

---

## 🔧 Technical Implementation

### Database Schema

#### New Fields in `formResponses` Collection
```typescript
{
  // Existing fields...
  clientApprovedFeedback: boolean,
  clientApprovedAt: Timestamp,
  clientResponse: {
    voice: string, // base64 or URL
    text: string,
    createdAt: Timestamp,
    updatedAt: Timestamp
  }
}
```

#### New Fields in `check_in_assignments` Collection
```typescript
{
  // Existing fields...
  clientApprovedFeedback: boolean,
  clientApprovedAt: Timestamp,
  workflowStatus: 'completed' | 'reviewed' | 'responded' | 'client_responded'
}
```

#### Optional: New Collection `clientFeedbackResponses`
If we want to support multiple back-and-forth exchanges:
```typescript
{
  responseId: string,
  coachFeedbackId: string, // Reference to coachFeedback document
  questionId: string | null, // null for overall response
  clientId: string,
  coachId: string,
  feedbackType: 'voice' | 'text',
  content: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  threadId: string // Group related responses
}
```

### API Endpoints

#### 1. POST `/api/client-feedback/approve`
- **Purpose**: Mark coach feedback as received and approved
- **Body**:
  ```json
  {
    "responseId": "string",
    "clientId": "string"
  }
  ```
- **Response**: Success confirmation
- **Updates**: `formResponses` and `check_in_assignments` collections

#### 2. POST `/api/client-feedback/respond`
- **Purpose**: Send client response (voice or text) to coach
- **Body**:
  ```json
  {
    "responseId": "string",
    "clientId": "string",
    "coachId": "string",
    "questionId": "string | null", // null for overall response
    "feedbackType": "voice" | "text",
    "content": "string" // base64 for voice, text for text
  }
  ```
- **Response**: Created response object
- **Creates**: Entry in `clientFeedbackResponses` collection (if using separate collection) or updates `formResponses.clientResponse`

#### 3. GET `/api/client-feedback/responses`
- **Purpose**: Get all client responses for a check-in
- **Query Params**: `responseId`, `clientId`
- **Response**: Array of client responses with timestamps

### Frontend Components

#### 1. `ClientFeedbackApproval.tsx`
- Button to mark feedback as approved
- Shows approval status if already approved
- Handles API call to approve endpoint

#### 2. `ClientFeedbackResponse.tsx`
- Voice recorder integration
- Text response input
- Submit handler
- Success/error states

#### 3. Update `src/app/client-portal/feedback/[id]/page.tsx`
- Add approval section after coach feedback display
- Add response section below approval
- Fetch and display existing client responses
- Show response thread/history

### Notifications

#### Client Approves Feedback
- **Recipient**: Coach
- **Type**: Email and/or in-app notification
- **Message**: "{Client Name} has marked your feedback as received and approved for {Form Title}"

#### Client Responds to Feedback
- **Recipient**: Coach
- **Type**: Email and/or in-app notification
- **Message**: "{Client Name} has responded to your feedback for {Form Title}"
- **Include**: Preview of response (text) or voice icon

---

## 🚀 Implementation Timeline

### Phase 1: Basic Approval (Week 1)
- [ ] Create `ClientFeedbackApproval` component
- [ ] Build POST `/api/client-feedback/approve` endpoint
- [ ] Update database schema (add approval fields)
- [ ] Integrate approval button into feedback page
- [ ] Test approval workflow
- [ ] Add notification to coach on approval

### Phase 2: Client Response (Week 2)
- [ ] Create `ClientFeedbackResponse` component
- [ ] Build POST `/api/client-feedback/respond` endpoint
- [ ] Build GET `/api/client-feedback/responses` endpoint
- [ ] Update database schema (add response fields)
- [ ] Integrate response section into feedback page
- [ ] Test response workflow (voice and text)
- [ ] Add notification to coach on response

### Phase 3: Response Thread Display (Week 3)
- [ ] Create response thread/chronology component
- [ ] Fetch and display conversation history
- [ ] Visual timeline design
- [ ] Test full conversation flow

### Phase 4: Coach View of Client Responses (Week 4)
- [ ] Update coach response review page to show client responses
- [ ] Add indicator when client has approved/responded
- [ ] Display client responses alongside coach feedback
- [ ] Test coach-side view

---

## 🎨 UI/UX Considerations

### Visual Hierarchy
1. **Coach Feedback** (Green/Purple theme) - Top section
2. **Approval Status** (Green checkmark) - Middle section
3. **Client Response** (Blue/Indigo theme) - Bottom section
4. **Response Thread** (Neutral/Chronological) - Full conversation view

### User Flow
1. Client completes check-in
2. Coach provides feedback (voice, text, emoji)
3. Client views feedback
4. Client marks as "Received and Approved" (optional but encouraged)
5. Client responds with voice or text (optional)
6. Coach sees client's approval and response
7. Coach can provide follow-up (existing functionality)

### Accessibility
- Voice recording: Clear instructions and visual feedback
- Text input: Proper labeling and error messages
- Approval button: Clear state indicators
- Keyboard navigation support

---

## 📊 Success Metrics

- **Adoption Rate**: % of clients who approve feedback
- **Response Rate**: % of clients who respond to coach feedback
- **Engagement**: Average number of back-and-forth exchanges
- **Coach Satisfaction**: Feedback from coaches on client communication

---

## 🔮 Future Enhancements (Post-V2.0)

1. **Multi-thread Conversations**: Support for multiple question-specific threads
2. **Emoji Reactions from Clients**: Clients can react to coach feedback
3. **Response Templates**: Pre-written responses for common scenarios
4. **AI Suggestions**: AI-generated response suggestions based on coach feedback
5. **Response Analytics**: Track response times and engagement patterns
6. **Push Notifications**: Mobile push notifications for new feedback/responses

---

## ✅ Acceptance Criteria

### Must-Have
- [ ] Clients can mark coach feedback as "Received and Approved"
- [ ] Clients can send voice responses to coach feedback
- [ ] Clients can send text responses to coach feedback
- [ ] Coach receives notification when client approves/responds
- [ ] Coach can view client responses on response review page
- [ ] Approval status persists and displays correctly

### Nice-to-Have
- [ ] Visual conversation thread
- [ ] Response history/chronology
- [ ] Multiple back-and-forth exchanges
- [ ] Response templates
- [ ] Analytics dashboard

---

## 📝 Notes

- This feature complements the existing coach feedback system
- Consider making approval optional but visible to encourage acknowledgment
- Voice responses should use the same `VoiceRecorder` component for consistency
- Database schema should be backwards compatible with existing check-ins

