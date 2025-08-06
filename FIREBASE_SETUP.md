# Firebase Setup Guide

## ✅ Client-Side Configuration (COMPLETED)

Your Firebase client configuration has been added to `src/lib/firebase-client.ts` with your project details:
- Project ID: `checkinv5`
- API Key: `AIzaSyC0KNjwNBnSGMtp-aMd0Wfi6Hl-wN0bmQY`

## 🔧 Server-Side Configuration (NEXT STEP)

To complete the setup, you need to add your Firebase service account credentials:

### Step 1: Get Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `checkinv5`
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate new private key**
5. Download the JSON file

### Step 2: Create .env.local File

Create a file named `.env.local` in the project root with this content:

```bash
# Firebase Service Account Configuration
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"checkinv5","private_key_id":"YOUR_PRIVATE_KEY_ID","private_key":"-----BEGIN PRIVATE KEY-----\\nYOUR_ACTUAL_PRIVATE_KEY\\n-----END PRIVATE KEY-----\\n","client_email":"YOUR_SERVICE_ACCOUNT_EMAIL","client_id":"YOUR_CLIENT_ID","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/YOUR_SERVICE_ACCOUNT_EMAIL"}
```

**Important:** 
- Replace all the placeholder values with your actual service account data
- Make sure to escape the `\n` characters in the private key as `\\n`
- The entire JSON should be on one line

### Step 3: Test the Connection

1. Restart your development server: `npm run dev`
2. Visit `http://localhost:3000`
3. The dashboard should now connect to Firebase successfully

### Step 4: Populate Sample Data

Once connected, populate sample data to test the framework:

```bash
curl -X POST http://localhost:3000/api/sample-data
```

## 🚀 What You'll Get

Once setup is complete, you'll have:
- ✅ Real-time dashboard with analytics
- ✅ 50 sample clients with realistic data
- ✅ Risk detection and engagement metrics
- ✅ Check-in system with forms
- ✅ AI-ready foundation for future enhancements

## 🔒 Security Notes

- The `.env.local` file is automatically ignored by Git
- Service account credentials are only used server-side
- Client-side Firebase config is safe to expose (it's public anyway)

## 🆘 Need Help?

If you encounter issues:
1. Check the browser console for errors
2. Verify your service account JSON is properly formatted
3. Ensure the project ID matches: `checkinv5`
4. Make sure all `\n` characters are escaped as `\\n` 