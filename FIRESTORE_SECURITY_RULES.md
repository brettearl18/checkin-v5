# Firestore Security Rules Documentation

## Overview

This document describes the production-ready Firestore security rules for CheckInV5. The rules implement role-based access control (RBAC) to ensure data isolation and security.

## Security Model

### User Roles

1. **Admin**: Full access to all data
2. **Coach**: Access to their own data and data of their assigned clients
3. **Client**: Access only to their own data

### Access Control Principles

- **Authentication Required**: All operations require authentication
- **Role-Based Permissions**: Access is granted based on user role
- **Data Isolation**: Coaches can only access data belonging to their clients
- **Ownership Verification**: All operations verify data ownership

---

## Collections & Rules

### 1. Users Collection (`users/{userId}`)

**Purpose**: Stores user profiles for all roles (admin, coach, client)

**Read Access**:
- Users can read their own profile
- Admins can read all profiles
- Coaches can read profiles of their assigned clients

**Write Access**:
- Users can update their own profile
- Admins can create/update/delete any profile

---

### 2. Coaches Collection (`coaches/{coachId}`)

**Purpose**: Stores coach-specific profile data

**Read Access**:
- Coaches can read their own profile
- Admins can read all coach profiles

**Write Access**:
- Coaches can update their own profile
- Admins can create/update/delete any coach profile

---

### 3. Clients Collection (`clients/{clientId}`)

**Purpose**: Stores client profiles and progress data

**Read Access**:
- Clients can read their own profile
- Coaches can read profiles of their assigned clients
- Admins can read all client profiles

**Write Access**:
- Clients can update their own profile (limited fields)
- Coaches can create/update clients assigned to them
- Admins can create/update/delete any client

**Key Fields**:
- `coachId`: Identifies the assigned coach
- `authUid`: Links to Firebase Auth user ID

---

### 4. Forms Collection (`forms/{formId}`)

**Purpose**: Stores check-in form templates

**Read Access**:
- Coaches can read their own forms
- Admins can read all forms

**Write Access**:
- Coaches can create/update/delete their own forms
- Admins can manage all forms

**Key Fields**:
- `coachId`: Identifies the form owner

---

### 5. Questions Collection (`questions/{questionId}`)

**Purpose**: Stores question library items

**Read Access**:
- Coaches can read their own questions
- Admins can read all questions

**Write Access**:
- Coaches can create/update/delete their own questions
- Admins can manage all questions

**Key Fields**:
- `coachId`: Identifies the question owner

---

### 6. Check-in Assignments Collection (`check_in_assignments/{assignmentId}`)

**Purpose**: Stores check-in assignments to clients

**Read Access**:
- Clients can read their own assignments
- Coaches can read assignments for their clients
- Admins can read all assignments

**Write Access**:
- Coaches can create/update assignments for their clients
- Admins can manage all assignments

**Key Fields**:
- `clientId`: Identifies the assigned client
- `coachId`: Identifies the assigning coach

---

### 7. Form Responses Collection (`formResponses/{responseId}`)

**Purpose**: Stores client responses to check-in forms

**Read Access**:
- Clients can read their own responses
- Coaches can read responses from their clients
- Admins can read all responses

**Write Access**:
- Clients can create their own responses
- Clients can update their own responses
- Coaches can update responses (for feedback)
- Admins can manage all responses

**Key Fields**:
- `clientId`: Identifies the responding client
- `coachId`: Identifies the client's coach

---

### 8. Coach Feedback Collection (`coachFeedback/{feedbackId}`)

**Purpose**: Stores coach feedback on client responses

**Read Access**:
- Clients can read feedback on their responses
- Coaches can read their own feedback
- Admins can read all feedback

**Write Access**:
- Coaches can create/update feedback for their clients
- Admins can manage all feedback

**Key Fields**:
- `clientId`: Identifies the client receiving feedback
- `coachId`: Identifies the coach providing feedback

---

### 9. Notifications Collection (`notifications/{notificationId}`)

**Purpose**: Stores user notifications

**Read Access**:
- Users can read their own notifications
- Admins can read all notifications

**Write Access**:
- Users can create/update/delete their own notifications
- Admins can manage all notifications

**Key Fields**:
- `userId`: Identifies the notification recipient

---

### 10. Messages Collection (`messages/{messageId}`)

**Purpose**: Stores messages between coaches and clients

**Read Access**:
- Clients can read messages in their conversations
- Coaches can read messages in their conversations
- Admins can read all messages

**Write Access**:
- Users can create messages in their conversations
- Admins can update/delete any message

**Key Fields**:
- `clientId`: Identifies the client in the conversation
- `coachId`: Identifies the coach in the conversation
- `fromUserId`: Identifies the message sender
- `toUserId`: Identifies the message recipient

---

### 11. Client Scoring Collection (`clientScoring/{scoringId}`)

**Purpose**: Stores client-specific scoring configurations

**Read Access**:
- Clients can read their own scoring config
- Coaches can read scoring configs for their clients
- Admins can read all scoring configs

**Write Access**:
- Coaches can create/update scoring configs for their clients
- Admins can manage all scoring configs

**Key Fields**:
- `clientId`: Identifies the client
- Document ID typically matches `clientId`

---

### 12. Client Measurements Collection (`client_measurements/{measurementId}`)

**Purpose**: Stores client body measurements over time

**Read Access**:
- Clients can read their own measurements
- Coaches can read measurements for their clients
- Admins can read all measurements

**Write Access**:
- Clients can create/update/delete their own measurements
- Coaches can create/update measurements for their clients
- Admins can manage all measurements

**Key Fields**:
- `clientId`: Identifies the client

---

### 13. Progress Images Collection (`progress_images/{imageId}`)

**Purpose**: Stores progress photos uploaded by clients

**Read Access**:
- Clients can read their own progress images
- Coaches can read progress images for their clients
- Admins can read all progress images

**Write Access**:
- Clients can create/update/delete their own progress images
- Coaches can create/update/delete progress images for their clients
- Admins can manage all progress images

**Key Fields**:
- `clientId`: Identifies the client
- `coachId`: Identifies the client's coach

---

## Helper Functions

The rules use several helper functions:

- `isAuthenticated()`: Checks if user is logged in
- `getUserId()`: Returns the authenticated user's UID
- `hasAdminRole()`: Checks if user has admin role
- `isCoach()`: Checks if user has coach role
- `isClient()`: Checks if user has client role

**Note**: Helper functions use `get()` calls to fetch user data from the `users` collection. Firestore has a limit of 10 `get()` calls per rule evaluation.

---

## Performance Considerations

### `get()` Call Limits

Firestore security rules have a limit of **10 `get()` calls per rule evaluation**. The current rules use `get()` calls in helper functions to verify user roles.

**Optimization Opportunities**:

1. **Use Custom Claims**: Store user roles in Firebase Auth custom claims instead of Firestore. This eliminates `get()` calls for role checking.

2. **Cache User Data**: Consider caching user role data to reduce `get()` calls.

3. **Denormalize Data**: Store `coachId` directly in documents instead of looking it up.

### Current Performance Impact

- Most operations use 1-2 `get()` calls (checking user role)
- Operations that verify client-coach relationships may use additional `get()` calls
- Total `get()` calls per operation: Typically 1-3 (well within the 10-call limit)

---

## Testing the Rules

### Using Firebase Emulator

```bash
# Start Firestore emulator
firebase emulators:start --only firestore

# Test rules
firebase emulators:exec --only firestore "npm test"
```

### Manual Testing Checklist

- [ ] Client can read their own data
- [ ] Client cannot read other clients' data
- [ ] Coach can read their clients' data
- [ ] Coach cannot read other coaches' clients' data
- [ ] Admin can read all data
- [ ] Unauthenticated users cannot read any data
- [ ] Write operations respect ownership rules

---

## Deployment

### Deploy Rules to Production

```bash
# Deploy rules only
firebase deploy --only firestore:rules

# Deploy rules and indexes together
firebase deploy --only firestore
```

### Verify Deployment

1. Check Firebase Console > Firestore Database > Rules tab
2. Verify rules are active and match local file
3. Test operations in production (carefully!)

---

## Migration from Development Rules

The previous development rules allowed all access:

```javascript
allow read, write: if true;
```

After deploying these production rules:

1. **Test thoroughly** in a staging environment first
2. **Verify all API endpoints** work correctly
3. **Check client and coach access** to ensure data isolation works
4. **Monitor Firestore logs** for permission denied errors

---

## Troubleshooting

### Common Issues

**Issue**: "Missing or insufficient permissions"

**Solution**: 
- Verify user is authenticated
- Check user role in `users` collection
- Verify `coachId`/`clientId` matches authenticated user

**Issue**: "Too many `get()` calls"

**Solution**: 
- Review helper functions
- Consider using custom claims for roles
- Optimize rule logic to reduce `get()` calls

**Issue**: "Coach cannot access client data"

**Solution**: 
- Verify `coachId` field exists and matches coach's UID
- Check client document exists and has correct `coachId`
- Verify coach user document has `role: 'coach'`

---

## Security Best Practices

1. **Never trust client-side code** - All security is enforced server-side
2. **Test rules thoroughly** - Use Firebase emulator for testing
3. **Monitor access logs** - Watch for suspicious patterns
4. **Regular audits** - Review rules periodically
5. **Principle of least privilege** - Grant minimum necessary permissions

---

## Future Enhancements

1. **Custom Claims**: Move role checking to Firebase Auth custom claims
2. **Field-level Security**: Add rules for specific fields within documents
3. **Time-based Rules**: Add rules based on document timestamps
4. **Audit Logging**: Log all security rule evaluations
5. **Rate Limiting**: Implement rate limiting at the rules level

---

*Last Updated: December 30, 2024*



