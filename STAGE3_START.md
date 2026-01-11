# Stage 3: Enable New System
## Quick Start Guide

**Status:** ✅ Stage 2 Complete - Ready to Enable  
**Duration:** 30-60 minutes  
**Risk Level:** ⚠️ MEDIUM (instant rollback available)

---

## ✅ Pre-Flight Check

- [x] Stage 2 migration complete (691 assignments created)
- [x] All validation tests passing (6/6)
- [x] Feature flag code in place
- [x] New endpoint ready

---

## 🚀 Quick Enable (Choose One Method)

### Method 1: Google Cloud Console (Recommended - Visual)

1. Open: https://console.cloud.google.com/run
2. Select project and region: `australia-southeast2`
3. Click service: `checkinv5`
4. Click: **"Edit & Deploy New Revision"**
5. Go to tab: **"Variables & Secrets"**
6. Click: **"Add Variable"** (or edit if exists)
7. Set:
   - **Name:** `USE_PRE_CREATED_ASSIGNMENTS`
   - **Value:** `true`
8. Click: **"Deploy"** (bottom of page)
9. Wait: ~1-2 minutes for deployment

**✅ Done!** New revision is live.

---

### Method 2: gcloud CLI (Command Line)

```bash
# Enable the feature flag
gcloud run services update checkinv5 \
  --region australia-southeast2 \
  --update-env-vars="USE_PRE_CREATED_ASSIGNMENTS=true"
```

**Expected output:**
```
Service [checkinv5] revision [checkinv5-XXXXX] has been deployed and is serving 100 percent of traffic.
```

**✅ Done!** Feature flag enabled.

---

## ✅ Verify It Worked

### Check 1: Service Status
```bash
gcloud run services describe checkinv5 \
  --region australia-southeast2 \
  --format="value(status.latestReadyRevisionName,status.conditions)"
```

Should show: New revision name, no errors

### Check 2: Environment Variable
```bash
gcloud run services describe checkinv5 \
  --region australia-southeast2 \
  --format="value(spec.template.spec.containers[0].env)"
```

Should show: `USE_PRE_CREATED_ASSIGNMENTS=true`

### Check 3: Application Logs (No Errors)
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=checkinv5 AND severity>=ERROR" \
  --limit 10 \
  --format="table(timestamp,severity,textPayload)"
```

Should show: No errors (or minimal expected errors)

---

## 🧪 Quick Smoke Tests

After deployment completes (~1-2 minutes):

1. **Open:** `/client-portal/check-ins` (as a client)
2. **Verify:**
   - ✅ Page loads without errors
   - ✅ All weeks visible (Week 1, 2, 3, etc.)
   - ✅ Week 2+ assignments appear

3. **Open:** `/client-portal` (dashboard)
4. **Verify:**
   - ✅ "Check-ins Requiring Attention" loads
   - ✅ Completed check-ins don't appear in "Requiring Attention"

---

## ⚠️ If Something Goes Wrong

### Instant Rollback (Disable Feature Flag)

**Via Console:**
1. Go to Cloud Run service
2. Edit & Deploy New Revision
3. Change `USE_PRE_CREATED_ASSIGNMENTS` to `false` (or remove)
4. Deploy

**Via CLI:**
```bash
gcloud run services update checkinv5 \
  --region australia-southeast2 \
  --update-env-vars="USE_PRE_CREATED_ASSIGNMENTS=false"
```

**Or revert to previous revision:**
```bash
# Get previous revision
gcloud run services describe checkinv5 \
  --region australia-southeast2 \
  --format="value(status.traffic)"

# Revert (replace REVISION_NAME with previous revision)
gcloud run services update-traffic checkinv5 \
  --region australia-southeast2 \
  --to-revisions=REVISION_NAME=100
```

---

## 📊 Monitoring (Next 30-60 minutes)

Watch for:
- ✅ No error spikes in logs
- ✅ Normal response times
- ✅ System stability
- ✅ Client submissions work

**Monitor logs:**
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=checkinv5" \
  --limit 50 \
  --format="table(timestamp,severity,textPayload)"
```

---

## ✅ Success Criteria

- [x] Feature flag enabled
- [ ] Application starts without errors
- [ ] Check-ins page loads correctly
- [ ] All weeks visible
- [ ] Week numbers display correctly
- [ ] No errors in logs
- [ ] System performs well

---

## 🎯 What Happens Next

After Stage 3 is stable (1-2 weeks):
- **Stage 4:** Remove old code (cleanup)
- Simpler codebase
- Better maintainability

---

**Ready to enable?** Choose Method 1 or Method 2 above! 🚀

