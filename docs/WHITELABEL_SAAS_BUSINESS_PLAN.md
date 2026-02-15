# Whitelabel Check-In SaaS — Business Plan & Overview

**Document purpose:** Strategic overview and business plan for launching a whitelabel, multi-tenant version of the check-in system as a B2B SaaS product.

**Version:** 1.0  
**Date:** February 2026

---

## 1. Executive Summary

### Vision
A **whitelabel check-in and client-engagement platform** sold to coaches, studios, agencies, and enterprises. Each customer gets their own branded instance (or tenant) with the same core product: recurring check-ins, forms, progress tracking, optional payments, and client portals—all under their logo, colours, and domain.

### Value proposition
- **For buyers:** No build-from-scratch; proven product, fast launch, predictable cost.
- **For you:** Recurring SaaS revenue, one codebase, scalable deployment (multi-tenant or per-tenant).

### One-line pitch
*“Your brand. Our check-in engine. Recurring client engagement and progress tracking, live in weeks—not months.”*

---

## 2. Product Overview

### What it is
- **Core:** Coach/client check-in system: assign forms (e.g. weekly check-ins), clients submit, coaches review and respond, progress and history are tracked.
- **Whitelabel:** Each tenant has custom branding (logo, colours, domain/subdomain), optional custom naming, and a dedicated or shared environment.
- **SaaS:** You operate the platform; customers pay a subscription (per coach, per client, or per organisation).

### What’s in scope (from current system, adapted)
| Area | Description |
|------|-------------|
| **Coach dashboard** | Clients, forms, assignments, check-ins to review, progress, photos, payments (if enabled). |
| **Client portal** | Check-ins to do, completed history, feedback, optional payments and resources. |
| **Forms & check-ins** | Recurring/weekly (or custom) assignments, scoring, due dates, reminders. |
| **Progress** | Scores over time, question-level progress, photos (before/after), measurements. |
| **Payments** | Optional Stripe integration for subscriptions and “payment status” (can be tenant-configurable). |
| **Branding** | Logo, primary colour, favicon, app name; optional custom domain. |

### What “whitelabel” means here
- **Tier 1 (simple):** One shared app; tenant chosen by domain/subdomain or login; branding (logo, colour, name) from config.
- **Tier 2 (full whitelabel):** Per-tenant subdomain or custom domain (e.g. `acme.checkinapp.com` or `checkin.acmecoaching.com`), full theme, optional email “from” branding.
- **Tier 3 (enterprise):** Dedicated instance, SSO, stricter SLAs, on-prem or private cloud if required.

---

## 3. Market & Opportunity

### Target segments
1. **Solo coaches / small practices (1–5 coaches)**  
   - Need: Simple check-ins and client visibility without building software.  
   - Will pay for: Ease of use, reliability, and “my brand” client experience.

2. **Studios & group programmes (5–50 coaches)**  
   - Need: Same tool across many coaches; possibly different programmes (e.g. 8-week challenges).  
   - Will pay for: Multi-coach support, reporting, optional payments.

3. **Agencies / franchise networks (50+ coaches or locations)**  
   - Need: Central control, local branding, compliance, reporting.  
   - Will pay for: Multi-tenant, roles, audit, and possibly API/integrations.

4. **Enterprises (wellness, corporate, healthcare-adjacent)**  
   - Need: Security, SSO, SLAs, and sometimes whitelabel + custom terms.  
   - Will pay for: Dedicated or air-gapped options, contracts, support.

### Why whitelabel SaaS
- **Recurring revenue:** Monthly/annual subscriptions.
- **Scalability:** One product, many tenants; marginal cost per new customer is low.
- **Proof:** Current check-in product de-risks feature set and UX.
- **Differentiation:** Focus on “check-in + progress + optional payments” rather than generic forms; built for coach–client workflows.

### Competitive context (positioning)
- **Generic form tools (Typeform, Jotform):** Not built for recurring check-ins, coach review, or progress over time.
- **All-in-one coaching platforms:** Often heavier and pricier; you can position as “check-in-first, flexible.”
- **Custom builds:** Expensive and slow; you offer “ready-made, your brand.”

---

## 4. Business Model

### Revenue model
- **Subscription SaaS:** Primary revenue from monthly or annual plans.
- **Optional:** One-time setup/onboarding fee for custom domain or enterprise config.
- **Optional:** Revenue share or fee on payment processing if you bundle Stripe (transparent in pricing).

### Pricing levers (choose one or combine)
- **Per coach / per seat:** e.g. $X per coach per month (simple, scales with their team).
- **Per client:** e.g. $Y per active client per month (aligns with their revenue).
- **Per organisation (flat):** e.g. $Z per month for up to N coaches and M clients (simple for SMB).
- **Tiered plans:** Starter / Growth / Scale (or Studio / Agency / Enterprise) with limits on coaches, clients, or features.

### Example tier sketch (illustrative only)
| Tier | Target | Price (e.g. /mo) | Coaches | Clients | Notes |
|------|--------|-------------------|---------|---------|--------|
| Starter | Solo coach | $29–49 | 1 | 50 | Core check-ins + branding |
| Growth | Small studio | $79–149 | 5 | 200 | + payments, more storage |
| Scale | Agency | $249–499 | 20 | 1,000 | + custom domain, API, support |
| Enterprise | Custom | Quote | Custom | Custom | SLA, SSO, dedicated |

*(Numbers are placeholders; validate with market and unit economics.)*

### Unit economics (what to nail down)
- **CAC:** Cost to acquire one customer (marketing, sales, onboarding).
- **LTV:** Lifetime value (ARPU × gross margin × average lifetime in months).
- **Target:** LTV : CAC ≥ 3 : 1 and payback &lt; 18 months as a rule of thumb.

---

## 5. Go-to-Market

### Launch strategy
- **Phase 1:** 1–3 design partners (existing or friendly coaches/studios) on whitelabel; learn and refine packaging and pricing.
- **Phase 2:** Soft launch to a defined segment (e.g. fitness/wellness coaches) via content, communities, and outbound.
- **Phase 3:** Scale with clear positioning, case studies, and (if needed) a small sales or success team.

### Channels (examples)
- Direct: Website, free trial, self-serve or demo-request.
- Partnerships: Referrals from complementary tools (scheduling, payments, CRM).
- Content/SEO: “Client check-in for coaches,” “whitelabel client engagement,” “progress tracking software.”
- Communities: Facebook groups, forums, associations where coaches and studio owners spend time.

### Success metrics
- **Acquisition:** Sign-ups, trials started, trials → paid.
- **Retention:** Logo and revenue retention; churn by segment.
- **Usage:** Active coaches, active clients, check-ins submitted per tenant.
- **Revenue:** MRR, ARR, average contract value.

---

## 6. Product & Roadmap (High Level)

### MVP (Whitelabel v1)
- Multi-tenant: tenant identified by subdomain or config (e.g. `tenant-slug.checkinapp.com`).
- Per-tenant branding: logo, primary colour, app name.
- Same core as current product: coach dashboard, client portal, forms, recurring check-ins, progress, basic reporting.
- Billing: Stripe subscriptions for your SaaS plans (not necessarily tenant-facing payments yet).
- Admin: Super-admin or internal tool to create tenants, set branding, and assign plan.

### Next phases (order as you see fit)
- **Self-serve sign-up:** Tenant signs up, chooses plan, configures brand (no manual provisioning).
- **Custom domains:** Tenant uses own domain (e.g. `checkin.theirstudio.com`) with SSL.
- **Payments for tenants:** Optional Stripe Connect or similar so tenants charge their clients; you define fee or margin.
- **API & webhooks:** For agencies and enterprises to integrate with CRM, LMS, or internal tools.
- **Advanced reporting:** Cross-tenant analytics for you; per-tenant reports and exports for them.
- **Enterprise:** SSO (SAML/OIDC), audit logs, data residency, SLA, dedicated instance option.

---

## 7. Technical & Operational Considerations

### Architecture (whitelabel-ready)
- **Multi-tenancy:** Every row or document has a `tenantId` (or org id); all queries scoped by tenant. No cross-tenant data access.
- **Config per tenant:** Branding, feature flags, limits (coaches, clients, storage), plan id stored in DB or config service.
- **Auth:** Tenant context set at login (e.g. from subdomain or org slug); enforce in every API and UI.

### Security & compliance
- Tenant isolation (data and config) and least-privilege access.
- Encryption in transit (TLS) and at rest; backups and retention policy.
- If targeting healthcare-adjacent or enterprise: document compliance roadmap (e.g. SOC 2, GDPR, HIPAA if applicable).

### Operations
- Hosting: Single production stack (e.g. Next.js + Firebase/Postgres) with tenant isolation; or separate stack per enterprise if needed.
- Monitoring: Per-tenant usage and errors; alerts on abuse or limits.
- Support: Tiered (e.g. in-app + email for Starter; dedicated success for Scale/Enterprise).

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Low willingness to pay | Validate with design partners; keep Starter price low and prove value with outcomes (retention, engagement). |
| Churn after trial | Strong onboarding, default templates, and “first check-in in 5 minutes” experience. |
| Support burden | Good docs, in-app guidance, and tiered support; automate common tasks. |
| Technical complexity of multi-tenant | Start with single-tenant-per-deployment or simple tenant id in schema; refactor once pattern is proven. |
| Brand conflict (your product vs “white label”) | Clear positioning: “Powered by X” in footer or only in admin; customer-facing UI is 100% their brand. |

---

## 9. Summary: Next Steps

1. **Lock scope:** Decide MVP feature set and “whitelabel depth” (branding only vs subdomain vs custom domain).
2. **Define pricing:** Choose pricing lever(s) and at least two tiers; test with 3–5 potential buyers.
3. **Architect for tenants:** Introduce `tenantId` (or org id) and tenant config; no new product needed, same codebase with tenant boundary.
4. **Onboard design partners:** 1–3 paying or in-kind partners; iterate on onboarding and positioning.
5. **Launch and measure:** Soft launch, track sign-ups, activation, and churn; refine positioning and packaging every quarter.

---

*This document is a starting point. Update pricing, segments, and roadmap as you validate with customers and partners.*
