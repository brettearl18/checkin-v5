# Changelog Entry Guidelines

## When to Add a Changelog Entry

### ✅ **Always Add Entry For:**

1. **Bug Fixes**
   - Any bug that was reported by clients
   - Critical errors that affected user experience
   - Data loss or corruption issues
   - Security vulnerabilities fixed

2. **New Features**
   - Major new functionality added
   - New pages/sections added
   - New integrations or third-party services
   - Significant UI/UX improvements

3. **Downtime/Maintenance**
   - Scheduled maintenance windows
   - Unplanned outages and resolutions
   - Server migrations or upgrades
   - Database changes that require downtime

4. **Performance Improvements**
   - Significant speed improvements
   - Reduced loading times
   - Optimization of critical features
   - API response time improvements

5. **Security Updates**
   - Security patches
   - Authentication improvements
   - Data encryption enhancements
   - Compliance updates

### ⚠️ **Consider Adding Entry For:**

1. **Minor Improvements**
   - Small UI tweaks (only if notable)
   - Text/typo fixes
   - Internal code refactoring (usually skip)

2. **Backend Changes**
   - API changes that affect user experience
   - Database schema changes (only if user-visible)

### ❌ **Don't Add Entry For:**

1. **Internal Changes**
   - Code refactoring only
   - Developer tooling updates
   - Testing infrastructure changes
   - Internal documentation updates

2. **Invisible Fixes**
   - Logging improvements
   - Monitoring setup
   - Deployment pipeline changes

---

## Entry Priority Levels

### **Critical** - Add Immediately
- Security vulnerabilities
- Data loss/corruption fixes
- Critical bugs affecting all users
- Major downtime events

### **High** - Add in Current Deployment
- Bug fixes affecting multiple users
- Major new features
- Significant performance improvements
- Scheduled maintenance

### **Medium** - Add in Current Deployment
- Minor bug fixes
- Small feature additions
- UI improvements
- Minor performance tweaks

### **Low** - Optional, Batch Updates
- Text/typo fixes
- Very minor improvements
- Edge case fixes

---

## Suggested Changelog Entry Format

When suggesting a changelog entry, I'll provide:

```
Category: [bug-fix | new-feature | maintenance | downtime | security | performance]
Title: [Brief, user-friendly title]
Description: [Clear explanation of what changed and why it matters to users]
Impact: [low | medium | high | critical]
Status: [completed]
```

**Example:**

```
Category: bug-fix
Title: Fixed check-in submission error
Description: Resolved an issue that prevented some clients from submitting their weekly check-ins. The form now saves correctly and all data is preserved.
Impact: high
Status: completed
```

---

## Workflow

1. **During Development:**
   - When implementing a change, I'll note if it warrants a changelog entry

2. **Before Deployment:**
   - Review all changes made
   - Suggest changelog entries for important changes
   - Ask for confirmation before creating entries

3. **After Deployment:**
   - Create changelog entries via admin interface
   - Ensure all client-reported bugs have corresponding entries

---

## Proactive Suggestions

I'll suggest adding changelog entries when:
- Fixing bugs reported via the issue reporting feature
- Adding new client-visible features
- Making performance improvements that users will notice
- Resolving downtime or maintenance issues
- Implementing security fixes

---

## Reminder Questions

Before deploying, ask:
1. "Should I add changelog entries for these changes?"
2. "Which changes would clients benefit from knowing about?"
3. "Should I create the changelog entries now, or will you add them via the admin interface?"

