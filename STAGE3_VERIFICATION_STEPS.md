# Stage 3: Verification & Testing Steps

## ✅ Step 1: Verify Deployment (Just Done)

**Status:** Feature flag deployed!

---

## 🔍 Step 2: Verify Application Started (2 minutes)

### Check Service Status
The deployment should complete in ~1-2 minutes. Verify it's running:

**Via Console:**
- Go back to Cloud Run service page
- Check that new revision is "Active" (green checkmark)
- No error messages shown

**Via CLI:**
```bash
gcloud run services describe checkinv5 \
  --region australia-southeast2 \
  --format="value(status.conditions)"
```

---

## 🧪 Step 3: Smoke Tests (10 minutes)

### Test 1: Check-ins List Page
**URL:** `https://checkinv5.web.app/client-portal/check-ins`

**What to check:**
- ✅ Page loads without errors
- ✅ All weeks are visible (Week 1, 2, 3, 4, etc.)
- ✅ Week 2+ assignments appear correctly
- ✅ Due dates display correctly
- ✅ Statuses are correct (pending/completed/overdue)

**Expected:** All 52 weeks should be visible for recurring check-ins!

### Test 2: Dashboard
**URL:** `https://checkinv5.web.app/client-portal`

**What to check:**
- ✅ "Check-ins Requiring Attention" section loads
- ✅ Completed check-ins don't appear in "Requiring Attention"
- ✅ Week numbers are correct
- ✅ No duplicates

### Test 3: Completed Check-ins
**URL:** `https://checkinv5.web.app/client-portal/check-ins` (switch to "Completed" tab)

**What to check:**
- ✅ All completed check-ins visible
- ✅ Week numbers display correctly (Week 1, Week 2, etc.)
- ✅ No duplicates
- ✅ Correct scores and dates

### Test 4: Check Logs (Optional)
Check for any errors in Cloud Run logs:

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=checkinv5 AND severity>=ERROR" \
  --limit 20 \
  --format="table(timestamp,severity,textPayload)"
```

**Expected:** No errors (or minimal expected errors)

---

## 📊 Step 4: Monitor (30-60 minutes)

**What to watch:**
- ✅ No error spikes in logs
- ✅ Normal response times
- ✅ System stability
- ✅ Client submissions work (if any during monitoring)

**Monitor logs:**
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=checkinv5" \
  --limit 50 \
  --format="table(timestamp,severity,textPayload)"
```

---

## ✅ Success Criteria

- [x] Feature flag enabled ✅
- [ ] Application starts without errors
- [ ] Check-ins page loads correctly
- [ ] All weeks visible
- [ ] Week numbers display correctly
- [ ] No errors in logs
- [ ] System performs well

---

## ⚠️ If Something Goes Wrong

### Rollback (Instant)

**Via Console:**
1. Go to Cloud Run service
2. Click "Manage Revisions"
3. Find previous revision
4. Click "..." → "Edit & Deploy New Revision"
5. Change `USE_PRE_CREATED_ASSIGNMENTS` to `false` (or remove)
6. Deploy

**Via CLI:**
```bash
gcloud run services update checkinv5 \
  --region australia-southeast2 \
  --update-env-vars="USE_PRE_CREATED_ASSIGNMENTS=false"
```

---

## 🎯 Next Steps After Verification

Once everything is verified:
- ✅ Stage 3 is complete!
- 📝 Document any issues
- 🔄 Continue monitoring for 24-48 hours
- 🚀 Plan Stage 4 (code cleanup) after 1-2 weeks of stability

---

**Ready to test?** Start with Test 1 (Check-ins List Page)! 🧪

