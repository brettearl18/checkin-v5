# Traffic Light System - Score Calculation Explanation

## 📊 **How the System Calculates Scores from Selected Questions**

### **Step 1: Question Selection & Weighting**

When a coach creates a form and selects questions:
- Each question has a **`questionWeight`** (default: 5, range: 1-10)
- The weight determines how much that question contributes to the final score
- Higher weight = more impact on the final score

**Example:**
- Question 1: "How would you rate your sleep?" (Weight: 8)
- Question 2: "Did you exercise today?" (Weight: 5)
- Question 3: "Any additional notes?" (Weight: 2)

---

### **Step 2: Answer Scoring (Per Question)**

When a client answers each question, the system converts their answer to a **score out of 10**:

#### **Scale/Rating Questions (1-10)**
- **Direct mapping**: Answer value = score
- Example: Client selects `7` → `questionScore = 7`

#### **Boolean Questions (Yes/No)**
- **YES (positive)**: `questionScore = 8`
- **NO (positive)**: `questionScore = 3`
- **YES (negative)**: `questionScore = 3` (e.g., "Do you feel anxious?")
- **NO (negative)**: `questionScore = 8`
- Controlled by `yesIsPositive` field on the question

#### **Multiple Choice Questions**
- If options have explicit weights: Uses the weight of the selected option
- Otherwise: Calculates based on position (first option = lower score, last = higher)

#### **Number Questions**
- Normalized to 1-10 scale
- If 0-100 range: `score = 1 + (value / 100) * 9`

#### **Text/Textarea Questions**
- **Neutral score**: `questionScore = 5` (always)
- Text questions don't contribute much to scoring (neutral)

---

### **Step 3: Weighted Score Calculation**

For each answered question:
```
weightedScore = questionScore × questionWeight
```

**Example:**
- Question 1: Sleep rating = 7, Weight = 8 → `7 × 8 = 56`
- Question 2: Exercise = Yes (8), Weight = 5 → `8 × 5 = 40`
- Question 3: Notes = "Feeling good" (5), Weight = 2 → `5 × 2 = 10`

**Total:**
- `totalWeightedScore = 56 + 40 + 10 = 106`
- `totalWeight = 8 + 5 + 2 = 15`

---

### **Step 4: Final Percentage Score (0-100%)**

The system calculates the final score as a percentage:

```javascript
score = (totalWeightedScore / (totalWeight × 10)) × 100
```

**Example (continued):**
- Maximum possible weighted score = `15 × 10 = 150`
- Actual weighted score = `106`
- Final score = `(106 / 150) × 100 = 70.67%` → **Rounded to 71%**

**Formula Breakdown:**
- `totalWeight × 10` = Maximum possible score if all questions scored 10/10
- `totalWeightedScore / (totalWeight × 10)` = Percentage of maximum achieved
- Multiply by 100 to get 0-100% range

---

### **Step 5: Traffic Light Determination**

The final percentage score is compared to the **client's compliance thresholds**:

#### **Client Scoring Profiles:**

**Lifestyle Client:**
- Red: 0-33%
- Orange: 34-80%
- Green: 81-100%

**High Performance Client:**
- Red: 0-75%
- Orange: 76-89%
- Green: 90-100%

**Moderate Client:**
- Red: 0-60%
- Orange: 61-85%
- Green: 86-100%

**Custom Client:**
- Coach sets custom thresholds

#### **Traffic Light Logic:**

```javascript
if (score <= redMax) return 'red';
if (score <= orangeMax) return 'orange';
return 'green';
```

**Example:**
- Score: **71%**
- Client Profile: **Lifestyle** (Red: 0-33%, Orange: 34-80%, Green: 81-100%)
- Result: **🟠 Orange Zone** ("On Track")

---

## 🔄 **Complete Flow Example**

### **Form Setup:**
1. Coach selects 5 questions for a check-in form:
   - Q1: "Sleep quality (1-10)" - Weight: 8
   - Q2: "Exercise today?" - Weight: 5
   - Q3: "Stress level (1-10)" - Weight: 7
   - Q4: "Energy level (1-10)" - Weight: 6
   - Q5: "Additional notes" - Weight: 2

### **Client Completes Check-in:**
1. Q1: Sleep = 8 → Score: 8, Weighted: `8 × 8 = 64`
2. Q2: Exercise = Yes → Score: 8, Weighted: `8 × 5 = 40`
3. Q3: Stress = 6 → Score: 6, Weighted: `6 × 7 = 42`
4. Q4: Energy = 7 → Score: 7, Weighted: `7 × 6 = 42`
5. Q5: Notes = "Feeling good" → Score: 5, Weighted: `5 × 2 = 10`

### **Calculation:**
- `totalWeightedScore = 64 + 40 + 42 + 42 + 10 = 198`
- `totalWeight = 8 + 5 + 7 + 6 + 2 = 28`
- `maxPossibleScore = 28 × 10 = 280`
- `finalScore = (198 / 280) × 100 = 70.71%` → **71%**

### **Traffic Light:**
- **Lifestyle Client**: 71% → 🟠 **Orange Zone** (34-80%)
- **High Performance Client**: 71% → 🔴 **Red Zone** (0-75%)

---

## 📝 **Key Points**

1. **Number of Questions**: More questions = more data points, but the final score is always a percentage (0-100%), so it's normalized regardless of question count.

2. **Question Weights**: Higher-weighted questions have more impact. A question with weight 10 contributes twice as much as a question with weight 5.

3. **Client Thresholds**: The same score (e.g., 71%) can be:
   - 🟠 Orange for a Lifestyle client
   - 🔴 Red for a High Performance client

4. **Unanswered Questions**: Skipped questions are excluded from the calculation (only answered questions count).

5. **Text Questions**: Always score 5/10 (neutral), so they have minimal impact on the final score.

---

## 🎯 **Why This System Works**

- **Flexible**: Works with any number of questions
- **Weighted**: Important questions can have more impact
- **Normalized**: Final score is always 0-100%, regardless of question count
- **Client-Specific**: Same score means different things for different client types
- **Fair**: Accounts for question importance through weights










