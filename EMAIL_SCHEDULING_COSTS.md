# Email Scheduling Costs Breakdown

## Quick Answer: **Yes, but it's very cheap!**

Running hourly email checks costs money, but it's typically **less than $1 per month** for your use case.

---

## Cost Breakdown

### 1. **Google Cloud Scheduler** (The Automation)

**Cost:** $0.10 per job per month

**Free Tier:** 3 free jobs per month (per billing account)

**For Your Setup:**
- You need 4 scheduled jobs:
  1. Check-in window open (hourly)
  2. 24-hour due reminders (hourly)
  3. Overdue reminders (daily)
  4. Onboarding reminders (daily)

**Cost Calculation:**
- 4 jobs × $0.10 = **$0.40/month**
- OR: 3 free jobs + 1 paid job = **$0.10/month** (if you stay within free tier)

**Note:** This is a fixed cost per job, regardless of how many times it runs.

---

### 2. **Cloud Run** (The API Execution)

**Your email endpoints run on Cloud Run** (not Cloud Functions), so costs are based on:

**Compute Time:**
- Billed per second of execution
- Typical cost: ~$0.00000231 per second (for 256MB memory)
- Your email checks probably take 1-5 seconds each

**Requests:**
- First 2 million requests per month: **FREE**
- Beyond that: $0.40 per million requests

**For Hourly Jobs:**
- Window open: 24 calls/day × 30 days = 720 calls/month
- 24h reminder: 24 calls/day × 30 days = 720 calls/month
- Overdue: 1 call/day × 30 days = 30 calls/month
- Onboarding: 1 call/day × 30 days = 30 calls/month
- **Total: ~1,500 API calls/month**

**Cost Calculation:**
- Requests: 1,500 calls = **$0.00** (well within free tier)
- Compute time: 1,500 calls × 3 seconds × $0.00000231 = **~$0.01/month**

---

### 3. **Mailgun** (The Email Service)

**Pricing Tiers:**

**Free Tier:**
- 5,000 emails/month for 3 months (trial)
- Then: Pay-as-you-go pricing

**Pay-as-you-go:**
- $0.80 per 1,000 emails
- Or volume pricing for larger amounts

**For Your Use Case:**

Let's say you have 50 active clients:

**Email Volume per Month:**
- Check-in assigned: 50 clients × 1 check-in/month = 50 emails
- Window open: 50 clients × 4 check-ins/month = 200 emails
- 24h reminder: 50 clients × 4 check-ins/month = 200 emails
- Overdue: ~5% of check-ins = 10 emails
- Completed: 50 clients × 4 check-ins/month = 200 emails
- Onboarding reminders: ~2-3 emails/month

**Total: ~660 emails/month**

**Cost Calculation:**
- If on free tier: **$0.00** (under 5,000 limit)
- If on pay-as-you-go: 660 × $0.80/1000 = **$0.53/month**

---

## Total Monthly Cost Estimate

### **Best Case (Free Tiers):**
- Cloud Scheduler: $0.00 (using 3 free jobs)
- Cloud Run: $0.00 (free tier)
- Mailgun: $0.00 (free tier - under 5,000 emails)
- **Total: $0.00/month** ✅

### **Typical Case (Some Paid):**
- Cloud Scheduler: $0.10/month (1 paid job)
- Cloud Run: $0.01/month
- Mailgun: $0.53/month (pay-as-you-go)
- **Total: ~$0.64/month** 💰

### **Worst Case (All Paid, Larger Scale):**
- Cloud Scheduler: $0.40/month (4 jobs)
- Cloud Run: $0.01/month
- Mailgun: $5-10/month (if sending 1,000+ emails)
- **Total: ~$5-10/month** 💰💰

---

## Cost Optimization Tips

### 1. **Consolidate Jobs** (Save on Cloud Scheduler)
Instead of 4 separate jobs, you could create 1 job that runs hourly and checks all conditions:
- **Savings: $0.30/month** (from 4 jobs to 1 job)
- **Trade-off:** Slightly more complex code

### 2. **Reduce Email Frequency**
- Instead of hourly, run every 2-4 hours
- **Savings: Minimal** (compute time is already cheap)
- **Trade-off: Less timely emails**

### 3. **Use Free Tiers**
- Stay within Mailgun's free tier (5,000 emails/month)
- Use Cloud Scheduler's free tier (3 jobs)
- **Savings: Up to $0.40/month**

### 4. **Batch Email Checks**
Run all checks in a single job that processes everything:
```typescript
// Single job that checks:
// - Window open
// - 24h reminders
// - Overdue
// - Onboarding reminders
// All in one API call
```

---

## Is It Worth It?

**Cost Analysis:**
- ✅ **Very cheap:** Less than $1/month for most use cases
- ✅ **Reliable:** Automated, no manual work needed
- ✅ **Scalable:** Costs grow slowly with client base

**Value:**
- Automated client engagement
- No manual email sending
- Consistent, timely reminders
- Professional appearance

**Verdict:** **Yes, it's worth it!** The cost is minimal compared to the time saved and value delivered.

---

## Monitoring Costs

### How to Monitor:

1. **Google Cloud Console:**
   - Go to "Billing" → "Cost Breakdown"
   - Filter by service: Cloud Scheduler, Cloud Run

2. **Mailgun Dashboard:**
   - Check "Analytics" → "Volume"
   - Monitor emails sent per month

3. **Set Budget Alerts:**
   - In Google Cloud: Set budget alert at $5/month
   - Get notified if costs exceed threshold

---

## Real-World Example

**Scenario:** 100 active clients, 4 check-ins per month each

**Monthly Costs:**
- Cloud Scheduler: $0.40 (4 jobs)
- Cloud Run: $0.02 (compute time)
- Mailgun: ~$1.00 (800 emails/month)
- **Total: ~$1.42/month**

**That's less than a cup of coffee! ☕**

---

## Summary

| Service | Cost | Free Tier Available? |
|---------|------|---------------------|
| Cloud Scheduler | $0.10/job/month | ✅ Yes (3 jobs free) |
| Cloud Run | ~$0.01/month | ✅ Yes (2M requests free) |
| Mailgun | ~$0.50-1.00/month | ✅ Yes (5K emails free) |
| **Total** | **~$0.60-1.50/month** | ✅ Yes |

**Bottom Line:** Running hourly email checks costs **less than $2/month** in most scenarios, and can be **free** if you stay within free tiers. The value of automated client engagement far outweighs this minimal cost.


