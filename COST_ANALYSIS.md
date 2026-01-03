# Cost Analysis - CheckInV5 Platform
## For 50 Active Clients

**Date:** January 3, 2026  
**Scenario:** 50 active clients with weekly check-ins

---

## Service Breakdown

### 1. Google Cloud Run (API Hosting)
**Service:** Next.js API routes and server-side rendering  
**Configuration:**
- Region: australia-southeast2
- CPU: 1 vCPU (auto-scaling)
- Memory: 512 MB (auto-scaling)
- Requests: Variable based on usage

**Usage Estimates (50 clients):**
- Average requests per client per day: ~50 requests
- Total daily requests: 50 clients × 50 requests = 2,500 requests/day
- Monthly requests: ~75,000 requests
- Average request duration: 200ms
- Active time: ~4.17 hours/month

**Cost Calculation:**
- **CPU Time:** 4.17 hours × $0.00002400/vCPU-second = ~$0.36/month
- **Memory:** 4.17 hours × 512MB × $0.00000250/GB-second = ~$0.02/month
- **Requests:** 75,000 × $0.40 per million = $0.03/month
- **Total Cloud Run:** ~**$0.41/month**

---

### 2. Firebase Hosting (Static Assets)
**Service:** Next.js static files and client-side assets  
**Configuration:**
- Storage: ~50-100 MB
- Bandwidth: Variable

**Usage Estimates (50 clients):**
- Average page views per client per day: ~10
- Total daily page views: 500
- Monthly page views: ~15,000
- Average page size: ~500 KB (including assets)
- Monthly bandwidth: ~7.5 GB

**Cost Calculation:**
- **Storage:** 100 MB × $0.026/GB = $0.003/month
- **Bandwidth:** 7.5 GB × $0.12/GB = $0.90/month
- **Total Firebase Hosting:** ~**$0.90/month**

---

### 3. Firestore Database
**Service:** NoSQL database for all app data  
**Configuration:**
- Region: australia-southeast2
- Storage: Pay-per-GB
- Operations: Pay-per-operation

**Data Structure per Client (estimated):**
- Client profile: ~5 KB
- 52 weekly check-ins/year: ~520 KB (10 KB per check-in)
- Form responses: ~260 KB/year
- Messages: ~50 KB/year
- Progress images metadata: ~10 KB
- **Total per client:** ~845 KB/year = ~70 KB/month

**Usage Estimates (50 clients):**
- **Storage:** 50 clients × 70 KB = 3.5 MB/month (grows over time)
- **Reads:** ~200 reads/client/day = 10,000/day = 300,000/month
- **Writes:** ~50 writes/client/day = 2,500/day = 75,000/month
- **Deletes:** ~10 deletes/client/day = 500/day = 15,000/month

**Cost Calculation (Australia region pricing):**
- **Storage:** 3.5 MB × $0.18/GB = $0.0006/month
- **Document reads:** 300,000 × $0.06 per 100K = $0.18/month
- **Document writes:** 75,000 × $0.18 per 100K = $0.14/month
- **Document deletes:** 15,000 × $0.02 per 100K = $0.003/month
- **Total Firestore:** ~**$0.32/month**

---

### 4. Firebase Storage
**Service:** File storage (progress images, profile photos)  
**Configuration:**
- Region: australia-southeast2
- Storage: Pay-per-GB
- Operations: Pay-per-operation

**Usage Estimates (50 clients):**
- Progress images per client: ~10 images/year
- Average image size: ~500 KB
- Total storage: 50 clients × 10 images × 500 KB = ~250 MB
- Monthly uploads: ~42 images × 500 KB = ~21 MB
- Monthly downloads: ~500 images × 500 KB = ~250 MB

**Cost Calculation:**
- **Storage:** 250 MB × $0.026/GB = $0.0065/month
- **Class A operations (uploads):** 42 × $0.05 per 10K = $0.0002/month
- **Class B operations (downloads):** 500 × $0.004 per 10K = $0.0002/month
- **Network egress:** 250 MB × $0.12/GB = $0.03/month
- **Total Firebase Storage:** ~**$0.04/month**

---

### 5. Firebase Authentication
**Service:** User authentication  
**Configuration:**
- Free tier: 50,000 monthly active users
- Paid: $0.0055 per monthly active user after free tier

**Usage Estimates (50 clients):**
- Clients: 50
- Coaches: ~2-5
- Total: ~55 monthly active users

**Cost Calculation:**
- Within free tier (50,000 MAU)
- **Total Firebase Auth:** **$0/month** (free)

---

### 6. OpenAI API (AI Features)
**Service:** AI-powered insights and analysis  
**Features:**
- Weekly Summary (GPT-3.5-turbo)
- SWOT Analysis (GPT-4o-mini)
- Risk Analysis (GPT-4o-mini)
- Coach Feedback (GPT-3.5-turbo)

**Usage Estimates (50 clients):**
- **Weekly Summary:** 50 clients × 1 per week × 4 weeks = 200 calls/month
  - Model: GPT-3.5-turbo
  - Average tokens: ~500 input + ~300 output = 800 tokens/call
  - Total tokens: 200 × 800 = 160,000 tokens/month
  - Cost: 160K × $0.0005/1K = $0.08/month

- **SWOT Analysis:** 50 clients × 1 per month = 50 calls/month
  - Model: GPT-4o-mini
  - Average tokens: ~1500 input + ~800 output = 2,300 tokens/call
  - Total tokens: 50 × 2,300 = 115,000 tokens/month
  - Cost: 115K × $0.15/1M = $0.02/month

- **Risk Analysis:** 50 clients × 1 per month = 50 calls/month
  - Model: GPT-4o-mini
  - Average tokens: ~1500 input + ~600 output = 2,100 tokens/call
  - Total tokens: 50 × 2,100 = 105,000 tokens/month
  - Cost: 105K × $0.15/1M = $0.02/month

- **Coach Feedback:** 50 clients × 4 per month = 200 calls/month
  - Model: GPT-3.5-turbo
  - Average tokens: ~400 input + ~200 output = 600 tokens/call
  - Total tokens: 200 × 600 = 120,000 tokens/month
  - Cost: 120K × $0.0005/1K = $0.06/month

**Total OpenAI:** ~**$0.18/month**

---

### 7. Firestore Backups
**Service:** Daily automated backups  
**Configuration:**
- Daily backups stored in Cloud Storage
- 90-day retention
- Storage region: australia-southeast2

**Usage Estimates:**
- Daily backup size: ~5 MB (growing)
- Average backup size over 90 days: ~10 MB
- Total storage: 90 backups × 10 MB = ~900 MB

**Cost Calculation:**
- **Storage:** 900 MB × $0.026/GB = $0.023/month
- **Operations:** Minimal (automated)
- **Total Backups:** ~**$0.02/month**

---

### 8. Email Service (Mailgun)
**Service:** Transactional emails  
**Email Types:**
- Check-in reminders
- Check-in completed
- Coach feedback available
- Password resets
- Onboarding emails

**Usage Estimates (50 clients):**
- Check-in reminders: 50 clients × 3/week × 4 weeks = 600/month
- Completed confirmations: 50 clients × 1/week × 4 weeks = 200/month
- Coach feedback: 50 clients × 0.5/week × 4 weeks = 100/month
- Password resets: ~10/month
- Onboarding: ~5/month (new clients)
- **Total emails:** ~915 emails/month

**Cost Calculation (Mailgun pricing):**
- Free tier: First 5,000 emails/month
- Within free tier
- **Total Mailgun:** **$0/month** (free)

---

### 9. Cloud Scheduler (if used)
**Service:** Scheduled tasks (emails, backups)  
**Usage:** 1-5 jobs running daily

**Cost Calculation:**
- Free tier: 3 jobs per month
- **Total Cloud Scheduler:** **$0/month** (likely free)

---

### 10. Network Egress
**Service:** Data transfer out of Google Cloud  
**Configuration:**
- Firebase Hosting: 7.5 GB/month (included in Firebase Hosting)
- API responses: ~1 GB/month

**Cost Calculation:**
- Most egress covered by service pricing
- Additional: ~1 GB × $0.12/GB = $0.12/month
- **Total Network:** ~**$0.12/month**

---

## 📊 Total Monthly Cost Breakdown

| Service | Monthly Cost |
|---------|-------------|
| Cloud Run (API) | $0.41 |
| Firebase Hosting | $0.90 |
| Firestore Database | $0.32 |
| Firebase Storage | $0.04 |
| Firebase Authentication | $0.00 (free) |
| OpenAI API | $0.18 |
| Firestore Backups | $0.02 |
| Email (Mailgun) | $0.00 (free) |
| Cloud Scheduler | $0.00 (free) |
| Network Egress | $0.12 |
| **TOTAL** | **~$2.00/month** |

---

## 💰 Annual Cost Projection

**Monthly:** ~$2.00  
**Annual:** ~$24.00

---

## 📈 Cost Scaling Estimates

### 100 Clients
- Monthly cost: ~$3.50/month
- Annual: ~$42/year

### 250 Clients
- Monthly cost: ~$7.50/month
- Annual: ~$90/year

### 500 Clients
- Monthly cost: ~$14/month
- Annual: ~$168/year

### 1,000 Clients
- Monthly cost: ~$27/month
- Annual: ~$324/year

---

## 💡 Cost Optimization Tips

1. **Firestore:** Use indexes efficiently to reduce read operations
2. **OpenAI:** Consider caching AI responses for similar client profiles
3. **Storage:** Compress images before upload (currently 500KB, could be ~200KB)
4. **Network:** Use CDN caching for static assets
5. **Backups:** Review retention period (90 days is good balance)

---

## 🎯 Key Cost Drivers

1. **Firebase Hosting bandwidth** (~45% of total cost)
2. **Cloud Run compute** (~20% of total cost)
3. **Firestore operations** (~16% of total cost)
4. **OpenAI API** (~9% of total cost)

---

## ⚠️ Potential Additional Costs

1. **Cloud Run scaling:** If traffic spikes, costs increase proportionally
2. **Firestore growth:** As data accumulates, storage costs increase (currently minimal)
3. **OpenAI usage:** If coaches request more AI insights, costs increase
4. **Support/SLA:** Enterprise support adds cost (optional)

---

## 📝 Notes

- All costs are estimates based on typical usage patterns
- Actual costs may vary based on:
  - Client usage patterns
  - Data size per client
  - Frequency of check-ins
  - Number of AI features used
  - Image upload frequency
- Google Cloud and Firebase offer free tiers that cover most of this usage
- Costs are extremely low at 50 clients scale

---

**Conclusion:** At 50 clients, your total infrastructure cost is approximately **$2/month** or **$24/year**. This is excellent value for a production SaaS platform!

