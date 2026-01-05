# Profile Personalization - Layout Confirmation

## Confirmed Layout: Horizontal with Circular Photo on Left

Based on user request, the profile section will maintain the **horizontal layout** with:
- **Circular photo/initials** on the **left**
- **Name + Quote/Icon** on the **right**

This matches the current layout and provides a clean, familiar design.

---

## Layout Structure

```
┌─────────────────────────────────────────┐
│  [○]  Brett Earl                        │
│        💪 "Progress, not perfection"    │
└─────────────────────────────────────────┘
```

### Desktop Sidebar Header
- Circular photo/initials (left)
- Name (bold, white)
- Icon + Quote (smaller, white, opacity 90%)

### Mobile Menu Header
- Circular photo/initials (left)
- Name (bold, white)
- Icon + Quote (smaller, white, opacity 90%)

---

## Visual Design

### Photo/Initials Circle
- **Size**: 48px (desktop), 40px (mobile)
- **Shape**: Perfect circle (rounded-full)
- **Border**: None (clean look)
- **Background**: White with opacity if photo, or theme color if initials
- **Position**: Left side, aligned with text

### Name
- **Font**: Bold, white
- **Size**: Large (desktop), Base (mobile)
- **Position**: Directly to right of photo

### Quote Section
- **Layout**: Icon + Quote on same line (or stacked on mobile if needed)
- **Icon**: Small emoji/icon before quote
- **Quote**: White text, opacity 90%
- **Size**: Small text
- **Position**: Below name

---

## Implementation Notes

1. **Maintain Current Layout**: Keep horizontal flex layout
2. **Circular Photo**: Ensure `rounded-full` for perfect circle
3. **Spacing**: Proper spacing between photo and text
4. **Responsive**: Adjust sizes for mobile but keep layout
5. **Theme Color**: Background uses personalized color (or default golden brown)

---

## Example Layouts

### With Customization
```
┌─────────────────────────────────────────┐
│  [📷]  Brett Earl                       │
│        🌱 "Every day is a fresh start"  │
└─────────────────────────────────────────┘
Background: Ocean Blue (#3b82f6)
```

### Without Customization (Default)
```
┌─────────────────────────────────────────┐
│  [BE]  Brett Earl                       │
│        "Wellness journey"               │
└─────────────────────────────────────────┘
Background: Golden Brown (#daa450)
No icon
```

---

Ready to implement with this confirmed layout!

