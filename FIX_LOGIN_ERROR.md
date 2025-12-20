# Fix: Firebase Auth Invalid Credential Error

## Problem
You're getting `FirebaseError: Firebase: Error (auth/invalid-credential)` when trying to log in.

This means:
- The user account doesn't exist in Firebase Auth, OR
- The password is incorrect

## Solution Options

### Option 1: Use Admin Page (If you have access)
1. If you can access `/admin` page (or have another admin account):
   - Go to `/admin`
   - Use the "Set as Admin & Coach" section
   - Enter:
     - User ID: `k5rT8EGNUqbWCSf5g56msZoFdX02`
     - Email: `Silvi@vanahealth.com.au` (or your email)
     - First Name: `Silvana`
     - Last Name: `Earl`
     - Password: (enter a password you want to use)
   - Click "Set as Admin & Coach"
   - This will create the Firebase Auth account if it doesn't exist

### Option 2: Use the Script (Node.js)
Run the script to create the account:

```bash
cd /Users/iohmarketing/CHECKINV5
node scripts/set-silvana-admin.js k5rT8EGNUqbWCSf5g56msZoFdX02 Silvana Earl
```

Note: This script sets roles but doesn't create the Firebase Auth account. You'll need to use Option 1 or 3.

### Option 3: Create Account via API
You can call the API directly to create the account:

```bash
curl -X POST http://localhost:3000/api/admin/set-admin \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "k5rT8EGNUqbWCSf5g56msZoFdX02",
    "email": "Silvi@vanahealth.com.au",
    "firstName": "Silvana",
    "lastName": "Earl",
    "password": "YourPasswordHere"
  }'
```

### Option 4: Register as New User
If you don't have admin access, you can:
1. Go to `/register?role=coach`
2. Register with your email and password
3. Then use the admin page to set your roles

## After Creating Account
Once the account is created:
1. Try logging in again with:
   - Email: `Silvi@vanahealth.com.au` (or the email you used)
   - Password: (the password you set)
   - Role: Select "Admin" or "Coach"

## Troubleshooting
- **Still getting error?** Check:
  - Email is correct (case-sensitive)
  - Password is correct
  - Account was actually created (check Firebase Console)
  
- **Can't access admin page?** You may need to:
  - Use Firebase Console to manually create the user
  - Or contact someone with admin access






