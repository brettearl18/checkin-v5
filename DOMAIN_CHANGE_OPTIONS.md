# Changing Domain from checkinv5.web.app to vanacheckin.web.app

## ❌ The Challenge

Firebase Hosting automatically assigns the `.web.app` subdomain based on your **Firebase Project ID**. You **cannot change** the default `checkinv5.web.app` subdomain because:
- The `.web.app` subdomain is tied to the project ID
- Project IDs cannot be renamed after creation
- The default hosting site name matches the project ID

---

## ✅ Your Options

### Option 1: Use a Custom Domain (EASIEST - Recommended)

Instead of `vanacheckin.web.app`, use a custom domain like:
- `vanacheckin.com`
- `app.vanacheckin.com`
- `checkin.vanacheckin.com`

**Pros:**
- ✅ No data migration needed
- ✅ Keep all existing data and configurations
- ✅ Quick setup (if you own a domain)
- ✅ Professional custom domain
- ✅ Free SSL certificate

**Cons:**
- ⚠️ Requires owning a domain name (costs ~$10-15/year)
- ⚠️ Takes 24-48 hours for DNS propagation

**Steps:**
1. Purchase/own the domain (e.g., `vanacheckin.com`)
2. Go to Firebase Console > Hosting > Add custom domain
3. Enter your custom domain
4. Add DNS records (Firebase provides them)
5. Wait for SSL certificate provisioning (automatic)

---

### Option 2: Create New Firebase Project (MOST WORK)

Create a new Firebase project with ID `vanacheckin` and migrate everything.

**Pros:**
- ✅ Get `vanacheckin.web.app` domain
- ✅ Clean project name

**Cons:**
- ❌ **Significant migration work required**
- ❌ Need to migrate all data
- ❌ Need to update all configurations
- ❌ Need to redeploy everything
- ❌ Need to update Cloud Run service
- ❌ Possible downtime during migration
- ❌ Need to update environment variables
- ❌ Need to export/import Firestore data
- ❌ Need to migrate Storage files
- ⚠️ Takes several hours to complete

**Migration Steps Required:**
1. Create new Firebase project "vanacheckin"
2. Export all Firestore data from checkinv5
3. Import Firestore data to vanacheckin
4. Migrate Storage files
5. Update all Firebase configs in code
6. Update environment variables
7. Redeploy Cloud Run service
8. Update Firebase Hosting configuration
9. Redeploy everything
10. Update DNS/domain configurations
11. Test everything thoroughly

---

## 💡 Recommendation

**Use Option 1 (Custom Domain)** - It's much simpler and faster.

If you want `vanacheckin.com` or similar:
- Purchase the domain from a registrar (GoDaddy, Namecheap, Google Domains, etc.)
- Add it to Firebase Hosting
- Your site will be available at both:
  - `checkinv5.web.app` (original, still works)
  - `vanacheckin.com` (new custom domain)

If you specifically need the `.web.app` subdomain to say "vanacheckin", you'll need to do the full migration (Option 2).

---

## Quick Decision Guide

**Choose Option 1 if:**
- You want a professional domain name
- You don't mind purchasing a domain
- You want the simplest solution
- You want to keep existing data/configuration

**Choose Option 2 if:**
- You specifically need `vanacheckin.web.app`
- You're okay with a full migration (several hours of work)
- You want a fresh start
- You have time to test everything thoroughly

---

## Next Steps

**If choosing Option 1 (Custom Domain):**
1. Purchase domain (if you don't have one)
2. I can help you set it up in Firebase Hosting

**If choosing Option 2 (New Project):**
1. Let me know and I'll create a detailed migration plan
2. We'll need to schedule time for the migration
3. I'll help you through each step

Which option would you like to proceed with?





