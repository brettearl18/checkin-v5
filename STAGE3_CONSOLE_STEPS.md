# Step-by-Step: Enable Feature Flag via Google Cloud Console

## Navigation Path to Variables & Secrets

### Step 1: Go to Cloud Run
1. In the left sidebar, click **"Cloud Run"** (it's in your favorites list, near the bottom)
   - Or search for "Cloud Run" in the search bar at the top

### Step 2: Select Your Service
2. You'll see a list of Cloud Run services
3. Click on **"checkinv5"** (the service name)

### Step 3: Edit Service
4. At the top of the service page, click the **"Edit & Deploy New Revision"** button
   - This is usually a prominent button at the top of the page

### Step 4: Find Variables & Secrets Tab
5. You'll see several tabs across the top:
   - Container
   - Variables & Secrets ← **Click this tab**
   - Networking
   - Security
   - Connections
   - etc.

### Step 5: Add Environment Variable
6. In the "Variables & Secrets" tab, you'll see:
   - **Environment variables** section
   - A button to **"Add Variable"** or **"Edit Variables"**

7. Click **"Add Variable"** (or if variables exist, click to add a new one)

8. Fill in:
   - **Name:** `USE_PRE_CREATED_ASSIGNMENTS`
   - **Value:** `true`
   - Click **"Save"** or check mark

### Step 6: Deploy
9. Scroll down to the bottom of the page
10. Click the blue **"Deploy"** button
11. Wait ~1-2 minutes for deployment to complete

---

## Visual Guide

```
Google Cloud Console
  └─ Cloud Run (left sidebar)
      └─ checkinv5 (service name)
          └─ Edit & Deploy New Revision (button)
              └─ Variables & Secrets (tab)
                  └─ Add Variable
                      └─ Name: USE_PRE_CREATED_ASSIGNMENTS
                      └─ Value: true
                          └─ Deploy (button at bottom)
```

---

## Quick Alternative: Direct URL

If you want to go directly to the service:
```
https://console.cloud.google.com/run/detail/australia-southeast2/checkinv5
```

Then click "Edit & Deploy New Revision" button.

---

## What to Look For

- **Tab name:** "Variables & Secrets" (not just "Variables")
- **Section:** "Environment variables"
- **Button:** "Add Variable" or "+ Add Variable"
- **After adding:** Variable appears in a list with Name and Value columns
- **Deploy button:** Blue button at bottom of page

---

**Need help?** The Variables & Secrets tab is usually the 2nd or 3rd tab after "Container".

