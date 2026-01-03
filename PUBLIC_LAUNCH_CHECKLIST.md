# Public Launch Checklist - CheckInV5

**Date:** January 3, 2026  
**Status:** 🚀 Ready for Public Testing

---

## ✅ Completed Items

1. **Application Deployed** ✅
   - Cloud Run: `https://checkin-v5-api-644898823056.us-central1.run.app`
   - Firebase Hosting: `https://checkinv5.web.app`
   - Build successful, all routes compiled

2. **Security Rules** ✅
   - Firestore security rules deployed
   - Storage security rules deployed
   - Role-based access control (RBAC) implemented
   - Test endpoints disabled in production

3. **Code Security** ✅
   - Sensitive data logging removed (using logger utility)
   - API authentication checks implemented
   - Password validation strengthened
   - Custom password reset flow implemented

---

## ⚠️ Critical Items to Verify

### 1. **Environment Variables on Cloud Run** ⚠️ **VERIFY**

Check that all environment variables are set on the Cloud Run service:

**Required Variables:**
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` (should be `checkinv5.firebaseapp.com`)
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (should be `checkinv5`)
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (should be `checkinv5.firebasestorage.app`)
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `FIREBASE_SERVICE_ACCOUNT` (should be stored in Secret Manager)

**How to Check:**
```bash
gcloud run services describe checkin-v5-api --region us-central1 --format="yaml(spec.template.spec.containers[0].env)"
```

**How to Set (if missing):**
```bash
gcloud run services update checkin-v5-api \
  --region us-central1 \
  --update-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=...,NEXT_PUBLIC_FIREBASE_PROJECT_ID=checkinv5,..."
```

### 2. **Firebase Auth Authorized Domains** ⚠️ **VERIFY**

Ensure production domains are added to Firebase Auth:

1. Go to [Firebase Console > Authentication > Settings > Authorized domains](https://console.firebase.google.com/project/checkinv5/authentication/settings)
2. Verify these domains are listed:
   - `checkinv5.web.app` ✅ (default)
   - `checkinv5.firebaseapp.com` ✅ (default)
   - Your custom domain (if applicable)

### 3. **Firestore Indexes** ⚠️ **VERIFY**

Check that all required indexes are deployed:

```bash
firebase deploy --only firestore:indexes
```

Or check in Firebase Console:
- [Firestore Indexes](https://console.firebase.google.com/project/checkinv5/firestore/indexes)

### 4. **Storage Bucket Configuration** ⚠️ **VERIFY**

Verify storage bucket name matches in:
- `firebase.json` storage configuration
- Environment variables (`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`)
- Firebase Console: [Storage Settings](https://console.firebase.google.com/project/checkinv5/storage)

---

## 📋 Recommended Next Steps

### 1. **Monitor Error Logs**

Set up monitoring for:
- Cloud Run logs: `gcloud logging read "resource.type=cloud_run_revision" --limit 50`
- Firebase Console > Logs
- Browser console errors (from user reports)

### 2. **Performance Monitoring**

- Check Cloud Run metrics: CPU, memory, request latency
- Monitor API response times
- Set up alerts for high error rates

### 3. **Test Critical User Flows**

Before wide public release, test:
- [ ] Client registration
- [ ] Client login
- [ ] Password reset
- [ ] Check-in submission
- [ ] Coach viewing client data
- [ ] Message sending/receiving
- [ ] Progress image upload

### 4. **Security Review**

- [ ] Review admin endpoints for proper authentication
- [ ] Verify no test data is exposed
- [ ] Check API rate limiting (consider implementing)
- [ ] Review user permissions and roles

### 5. **Documentation**

- [ ] User guide for clients
- [ ] Coach onboarding documentation
- [ ] Troubleshooting guide
- [ ] Support contact information

---

## 🔒 Security Status

✅ **Production-Ready:**
- Firestore security rules: RBAC implemented
- Storage security rules: Client/coach access controls
- API authentication: All admin routes protected
- Password security: Strong validation enforced
- Test endpoints: Disabled in production
- Sensitive data: Logging sanitized

---

## 🚨 Known Issues / Considerations

1. **Mobile Dashboard Sections**: Some sections may not be visible on mobile (under investigation)
2. **Error Monitoring**: Consider setting up error tracking service (e.g., Sentry)
3. **Rate Limiting**: Consider implementing API rate limiting for public endpoints
4. **Backup Strategy**: Ensure Firestore backups are configured

---

## 📞 Support Information

**Application URL:** https://checkinv5.web.app  
**Cloud Run URL:** https://checkin-v5-api-644898823056.us-central1.run.app  
**Firebase Console:** https://console.firebase.google.com/project/checkinv5  
**GitHub Repository:** https://github.com/brettearl18/checkin-v5

---

## ✅ Sign-Off

- [ ] Environment variables verified on Cloud Run
- [ ] Firebase Auth authorized domains checked
- [ ] Critical user flows tested
- [ ] Error monitoring set up
- [ ] Ready for public launch

**Signed off by:** _________________  
**Date:** _________________

