# Immediate Security Fixes Required Before Launch

## 🔴 CRITICAL - Fix Immediately

### 1. Fix Dependency Vulnerabilities

**Command:**
```bash
npm audit fix
npm audit fix --force  # If needed for Next.js update
npm run build  # Verify build still works
```

**Expected Impact:**
- Next.js will upgrade to 15.5.9 (fixes critical RCE, SSRF vulnerabilities)
- jws and node-forge will be updated

**Testing:**
- Run `npm run build` to ensure build succeeds
- Test critical flows (login, check-in submission, data fetching)

---

### 2. Secure Test Endpoints

**Files to Update:**
- `src/app/api/test-ai/route.ts`
- `src/app/api/test-email/route.ts`
- `src/app/api/seed-test-data/route.ts`

**Add to each route (at the start of handler):**
```typescript
// Disable in production
if (process.env.NODE_ENV === 'production') {
  return NextResponse.json(
    { success: false, message: 'This endpoint is not available in production' },
    { status: 403 }
  );
}
```

**OR** Protect with admin check:
```typescript
// Add admin verification
const { searchParams } = new URL(request.url);
const adminId = searchParams.get('adminId');
if (!adminId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const db = getDb();
const adminDoc = await db.collection('users').doc(adminId).get();
const adminData = adminDoc.data();
if (adminData?.role !== 'admin' && !adminData?.roles?.includes('admin')) {
  return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
}
```

---

### 3. Strengthen Password Validation

**Files to Update:**
1. `src/app/api/clients/route.ts` (line 131)
2. `src/app/api/auth/register/route.ts` (add validation)
3. `src/app/register/page.tsx` (line 82)
4. `src/app/client-onboarding/page.tsx` (line 73)
5. `src/app/clients/create/page.tsx` (update placeholder text)

**New Validation Function:**
Create `src/lib/password-validation.ts`:
```typescript
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  
  return { valid: true };
}
```

**Update API routes:**
```typescript
import { validatePassword } from '@/lib/password-validation';

// In POST handler:
const passwordValidation = validatePassword(password);
if (!passwordValidation.valid) {
  return NextResponse.json({
    success: false,
    message: passwordValidation.message
  }, { status: 400 });
}
```

---

### 4. Review Console Logs for Sensitive Data

**Search for these patterns and remove/fix:**
```bash
# Find logs with potential sensitive data
grep -r "console.log.*password" src/
grep -r "console.log.*token" src/
grep -r "console.log.*secret" src/
grep -r "console.log.*key" src/
grep -r "console.log.*email.*password" src/
```

**Files to Review:**
- `src/app/api/admin/set-admin/route.ts` (line 31, 37) - Password updates logged
- All API routes with detailed logging

**Fix:**
1. Remove logs that contain passwords/tokens
2. Use conditional logging: `if (process.env.NODE_ENV !== 'production') console.log(...)`
3. Or use proper logging service that filters sensitive data

---

### 5. Add Admin Route Protection

**Files to Update:**
- `src/app/api/admin/set-admin/route.ts`
- `src/app/api/admin/delete-client-by-email/route.ts`
- `src/app/api/admin/find-user-by-email/route.ts`

**Add authentication check (at start of handler):**
```typescript
export async function POST(request: NextRequest) {
  try {
    // Get admin ID from request (you'll need to add this to your auth flow)
    const { adminId } = await request.json();
    
    if (!adminId) {
      return NextResponse.json(
        { success: false, message: 'Admin ID required' },
        { status: 401 }
      );
    }
    
    // Verify admin role
    const db = getDb();
    const adminDoc = await db.collection('users').doc(adminId).get();
    
    if (!adminDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }
    
    const adminData = adminDoc.data();
    const isAdmin = adminData?.role === 'admin' || 
                    (adminData?.roles && adminData.roles.includes('admin'));
    
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Admin access required' },
        { status: 403 }
      );
    }
    
    // ... rest of handler
  }
}
```

**OR** Use Firebase Auth token verification (better approach):
```typescript
import { getAuthInstance } from '@/lib/firebase-server';

export async function POST(request: NextRequest) {
  try {
    // Get auth token from request headers
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const token = authHeader.substring(7);
    const auth = getAuthInstance();
    const decodedToken = await auth.verifyIdToken(token);
    
    // Check admin role from custom claims or Firestore
    const db = getDb();
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    
    const isAdmin = decodedToken.role === 'admin' || 
                    userData?.role === 'admin' ||
                    (userData?.roles && userData.roles.includes('admin'));
    
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, message: 'Admin access required' },
        { status: 403 }
      );
    }
    
    // ... rest of handler
  }
}
```

---

## 🟡 HIGH PRIORITY - Fix Today

### 6. Add Email Validation

**Update registration/onboarding routes:**
```typescript
import { ErrorUtils } from '@/lib/error-handler';

// In route handler:
const emailError = ErrorUtils.validateEmail(email);
if (emailError) {
  return NextResponse.json({
    success: false,
    message: 'Invalid email format'
  }, { status: 400 });
}
```

---

### 7. Secure Error Messages

**Update error responses to not leak information:**
```typescript
// Instead of:
return NextResponse.json({
  success: false,
  error: error.message, // May contain sensitive info
  details: error.stack  // Definitely contains sensitive info
}, { status: 500 });

// Use:
return NextResponse.json({
  success: false,
  message: 'An error occurred. Please try again.',
  error: process.env.NODE_ENV === 'development' ? error.message : undefined
}, { status: 500 });
```

---

## 📋 Quick Fix Checklist

- [ ] Run `npm audit fix` and verify build
- [ ] Add production check to test endpoints
- [ ] Create password validation function
- [ ] Update password validation in 5 files
- [ ] Remove/fix console.logs with sensitive data
- [ ] Add admin verification to admin routes
- [ ] Add email validation to registration routes
- [ ] Review error messages for information leakage
- [ ] Test all critical flows after fixes
- [ ] Run final build and deploy

---

## ⏱️ Estimated Time

- Fix dependencies: 15 minutes
- Secure test endpoints: 30 minutes
- Password validation: 45 minutes
- Review console logs: 1-2 hours
- Admin route protection: 1 hour
- Email validation: 30 minutes
- Error message review: 1 hour

**Total: 4-6 hours**

