# 📋 English Internationalization (i18n) Plan

## 🎯 Goal
Convert the entire application from Chinese to English, including:
- UI text and labels
- AI prompts and responses
- Database sample data
- Documentation
- Error messages and notifications

---

## 📊 Implementation Plan

### Phase 1: Core Infrastructure (1-2 days)
**Priority**: High

#### 1.1 Setup i18n Framework
- [ ] Install `next-intl` or `react-i18next` package
- [ ] Create i18n configuration file
- [ ] Setup language detection and switching mechanism
- [ ] Create language context provider

#### 1.2 Create Translation Files Structure
```
src/
  i18n/
    locales/
      en/
        common.json          # Common UI text
        tasks.json           # Task-related text
        ai.json             # AI prompts and responses
        auth.json           # Authentication
        errors.json         # Error messages
      zh/                   # Keep Chinese as fallback
        (same structure)
```

---

### Phase 2: UI Components Translation (2-3 days)
**Priority**: High

#### 2.1 Layout & Navigation Components
**Files to modify**:
- `src/app/layout.tsx`
- `src/app/dashboard/page.tsx`
- `src/components/TaskForm.tsx`
- `src/components/QuickAddTask.tsx`

**Translation keys needed**:
```json
{
  "nav": {
    "dashboard": "Dashboard",
    "logout": "Logout",
    "settings": "Settings"
  },
  "task": {
    "addTask": "Add Task",
    "editTask": "Edit Task",
    "deleteTask": "Delete Task",
    "markComplete": "Mark as Complete",
    "title": "Title",
    "description": "Description",
    "priority": "Priority",
    "deadline": "Deadline",
    "tags": "Tags"
  }
}
```

#### 2.2 Task Management Components
**Files to modify**:
- `src/components/TaskItem.tsx`
- `src/components/SubtaskList.tsx`
- `src/components/TaskTagSelector.tsx`
- `src/components/DraggableTaskItem.tsx`

**Translation keys**:
```json
{
  "priority": {
    "high": "High",
    "medium": "Medium",
    "low": "Low"
  },
  "status": {
    "completed": "Completed",
    "pending": "Pending",
    "overdue": "Overdue"
  }
}
```

#### 2.3 Calendar & Date Components
**Files to modify**:
- `src/components/CalendarView.tsx`
- `src/components/DateScopeSelector.tsx`
- `src/utils/dateUtils.ts`

**Translation keys**:
```json
{
  "calendar": {
    "today": "Today",
    "week": "Week",
    "month": "Month",
    "backToToday": "Back to Today",
    "weekView": "Week View",
    "monthView": "Month View"
  },
  "dateRange": {
    "today": "Today",
    "thisWeek": "This Week",
    "nextWeek": "Next Week",
    "custom": "Custom Range"
  }
}
```

---

### Phase 3: AI System Translation (3-4 days) ⭐ **Most Critical**
**Priority**: Highest

#### 3.1 AI Prompt Templates
**Files to modify**:
- `src/lib/clarificationAI.ts` 
- `src/lib/decompositionAI.ts`
- `src/lib/doubaoService.ts`
- `src/lib/guidanceService.ts`
- `src/lib/timeEstimationAI.ts`

**Strategy**:
1. Extract all Chinese prompts to translation files
2. Create English versions of all prompts
3. Update prompt construction logic to use translations
4. Maintain prompt quality and effectiveness in English

**Example - Clarification AI Prompt** (`src/lib/clarificationAI.ts`):

**Before** (Chinese):
```typescript
const systemPrompt = `你是一位擅长引导思考的任务教练，使用苏格拉底式提问帮助用户澄清任务本身的定义与边界...`
```

**After** (English):
```typescript
const systemPrompt = t('ai.clarification.systemPrompt', {
  defaultValue: `You are a skilled task coach who uses Socratic questioning to help users clarify task definitions and boundaries...`
})
```

**Translation file** (`src/i18n/locales/en/ai.json`):
```json
{
  "clarification": {
    "systemPrompt": "You are a skilled task coach who uses Socratic questioning to help users clarify the definition and boundaries of tasks, making them transition from vague to clear and actionable.\n\n### Core Objective\n\nThrough 3 precise questions, help users **understand what the task is**, making task definitions clear so they can better plan and initiate execution...",
    "userPrompt": "Based on the following task information, generate 3 questions to help users clarify task definitions:",
    "exampleGoodQuestions": {
      "meetingPrep": {
        "audience": "Who is the audience for this presentation (boss/team/client/reviewers)?",
        "purpose": "What is the core purpose of the presentation (progress report/resource request/decision-making/results sharing)?",
        "topic": "What is the main topic or key content of the presentation?"
      }
    }
  },
  "decomposition": {
    "systemPrompt": "You are an intelligent assistant skilled in task analysis and context understanding...",
    "taskTypes": {
      "academicWriting": "Academic Writing (papers/abstracts/reports)",
      "review": "Review/Evaluation (peer review/grading)",
      "exam": "Exam/Assessment (Qualify Exam/interview/defense)"
    }
  }
}
```

#### 3.2 AI Response Messages
**Files to modify**:
- `src/hooks/useWorkflowAssistant.ts`
- `src/components/ChatSidebar.tsx`
- `src/components/InteractiveButtons.tsx`

**Translation keys**:
```json
{
  "ai": {
    "workflow": {
      "initial": {
        "message": "👋 Hello! I'm your AI task assistant. I can help you:",
        "options": {
          "refineSingle": "Refine a Single Task",
          "sortAll": "Sort All Tasks by Priority",
          "end": "End AI Assistance"
        }
      },
      "taskActions": {
        "message": "What would you like to do with this task?",
        "options": {
          "clarify": "Clarify",
          "decompose": "Decompose",
          "estimate": "Estimate Time",
          "back": "Back"
        }
      },
      "clarification": {
        "thinking": "🤔 Analyzing your task...",
        "questions": "Before we start, I'd like to understand some background:",
        "summary": "📋 Task Summary",
        "confirm": "Does this match your understanding?",
        "needRevision": "Need Revision",
        "looksGood": "Looks Good"
      }
    }
  }
}
```

#### 3.3 Dynamic AI Content
**Challenge**: AI generates dynamic content in Chinese
**Solution**: 
1. Add system prompt instruction to respond in English
2. Use language parameter in AI API calls
3. Post-process AI responses if needed

**Example**:
```typescript
const response = await fetch(DOUBAO_CONFIG.endpoint, {
  body: JSON.stringify({
    model: DOUBAO_CONFIG.model,
    messages: [
      { 
        role: 'system', 
        content: systemPrompt + '\n\n**IMPORTANT**: Please respond in English.' 
      },
      { role: 'user', content: userPrompt }
    ],
    // ... other config
  }),
})
```

---

### Phase 4: Authentication & User Profile (1 day)
**Priority**: Medium

#### 4.1 Auth Pages
**Files to modify**:
- `src/app/auth/login/page.tsx`
- `src/app/auth/register/page.tsx`

**Translation keys**:
```json
{
  "auth": {
    "login": {
      "title": "Login",
      "username": "Username",
      "password": "Password",
      "submit": "Sign In",
      "noAccount": "Don't have an account?",
      "register": "Register"
    },
    "register": {
      "title": "Create Account",
      "submit": "Sign Up",
      "hasAccount": "Already have an account?",
      "login": "Login"
    }
  }
}
```

#### 4.2 User Profile
**Files to modify**:
- `src/components/UserProfileModal.tsx`

**Translation keys**:
```json
{
  "profile": {
    "title": "User Profile",
    "major": "Major",
    "grade": "Grade",
    "challenges": "Challenges",
    "workplaces": "Workplaces",
    "save": "Save",
    "cancel": "Cancel"
  }
}
```

---

### Phase 5: Error Messages & Notifications (1 day)
**Priority**: Medium

#### 5.1 Error Messages
**Files to modify**:
- `src/lib/auth.ts`
- `src/lib/tasks.ts`
- `src/components/Toast.tsx`

**Translation keys**:
```json
{
  "errors": {
    "auth": {
      "invalidCredentials": "Invalid username or password",
      "userExists": "Username already exists",
      "networkError": "Network error, please try again"
    },
    "tasks": {
      "createFailed": "Failed to create task",
      "updateFailed": "Failed to update task",
      "deleteFailed": "Failed to delete task",
      "loadFailed": "Failed to load tasks"
    },
    "ai": {
      "apiKeyMissing": "AI API key not configured",
      "requestFailed": "AI request failed",
      "timeout": "Request timed out"
    }
  },
  "success": {
    "taskCreated": "Task created successfully",
    "taskUpdated": "Task updated successfully",
    "taskDeleted": "Task deleted successfully"
  }
}
```

---

### Phase 6: Documentation & Sample Data (1 day)
**Priority**: Low

#### 6.1 Documentation Files
**Files to translate**:
- `README.md` → Create `README.en.md`
- `STRESS_TEST_GUIDE.md` → Create `STRESS_TEST_GUIDE.en.md`
- All other `.md` files in root and subdirectories

#### 6.2 Sample Data
**Files to modify**:
- `task-manager/database/sample-data.sql`
- `task-manager/database/user-profiles-sample-data.sql`

**Example**:
```sql
-- Before
INSERT INTO tasks (user_id, title, description, priority) VALUES
  ('...', '准备下周汇报', '需要整理项目进度', 'high');

-- After
INSERT INTO tasks (user_id, title, description, priority) VALUES
  ('...', 'Prepare Weekly Report', 'Need to organize project progress', 'high');
```

---

## 🛠️ Technical Implementation Details

### Recommended i18n Library: `next-intl`

**Why `next-intl`**:
- ✅ Built specifically for Next.js 14 App Router
- ✅ Server and client component support
- ✅ Type-safe translations
- ✅ Good performance

**Installation**:
```bash
npm install next-intl
```

**Basic Setup**:

1. **Create `src/i18n/request.ts`**:
```typescript
import {getRequestConfig} from 'next-intl/server';
 
export default getRequestConfig(async ({locale}) => ({
  messages: (await import(`./locales/${locale}.json`)).default
}));
```

2. **Update `next.config.ts`**:
```typescript
import createNextIntlPlugin from 'next-intl/plugin';
 
const withNextIntl = createNextIntlPlugin();
 
export default withNextIntl({
  // Your existing Next.js config
});
```

3. **Wrap app in `src/app/layout.tsx`**:
```typescript
import {NextIntlClientProvider} from 'next-intl';
import {getLocale, getMessages} from 'next-intl/server';

export default async function RootLayout({children}) {
  const locale = await getLocale();
  const messages = await getMessages();
 
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

4. **Use in components**:
```typescript
import {useTranslations} from 'next-intl';

function TaskForm() {
  const t = useTranslations('task');
  
  return (
    <form>
      <label>{t('title')}</label>
      <input placeholder={t('titlePlaceholder')} />
    </form>
  );
}
```

---

## 📝 Translation Quality Checklist

### For AI Prompts
- [ ] Maintain Socratic questioning style
- [ ] Keep ADHD-friendly principles
- [ ] Preserve examples and anti-examples
- [ ] Test prompt effectiveness with English responses
- [ ] Ensure cultural appropriateness (e.g., "CHI Review" → "CHI Conference Review")

### For UI Text
- [ ] Use natural, conversational English
- [ ] Keep consistent terminology
- [ ] Consider button text length (English can be longer)
- [ ] Maintain tone and voice

### For Error Messages
- [ ] Clear and actionable
- [ ] User-friendly (not technical jargon)
- [ ] Provide next steps when possible

---

## 🧪 Testing Strategy

### Phase-by-Phase Testing
After each phase:
1. Manual UI testing
2. AI response quality testing
3. Translation completeness check
4. Performance regression testing

### Final Testing
- [ ] Run stress test with English interface
- [ ] Test all AI workflows in English
- [ ] Verify all error scenarios
- [ ] Check mobile responsiveness with English text
- [ ] Browser compatibility testing

---

## 📊 Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Infrastructure | 1-2 days | None |
| Phase 2: UI Components | 2-3 days | Phase 1 |
| Phase 3: AI System | 3-4 days | Phase 1 |
| Phase 4: Auth & Profile | 1 day | Phase 1 |
| Phase 5: Errors & Notifications | 1 day | Phase 1 |
| Phase 6: Documentation | 1 day | None (parallel) |
| **Total** | **9-12 days** | |

---

## 🎯 Priority Ranking

### Must Have (P0)
1. ✅ Phase 1: i18n Infrastructure
2. ✅ Phase 3: AI System (most visible to users)
3. ✅ Phase 2: UI Components

### Should Have (P1)
4. ✅ Phase 4: Authentication
5. ✅ Phase 5: Error Messages

### Nice to Have (P2)
6. ✅ Phase 6: Documentation

---

## 🚀 Quick Start Guide

### Immediate Next Steps

1. **Install i18n package**:
```bash
cd task-manager
npm install next-intl
```

2. **Create basic structure**:
```bash
mkdir -p src/i18n/locales/en
mkdir -p src/i18n/locales/zh
touch src/i18n/request.ts
touch src/i18n/locales/en/common.json
```

3. **Start with high-impact component**:
   - Choose `ChatSidebar.tsx` (most user-facing AI interaction)
   - Extract all Chinese strings
   - Create English translations
   - Test AI workflow

4. **Expand incrementally**:
   - One component at a time
   - Test after each component
   - Commit frequently

---

## 📌 Notes & Considerations

### Language Detection
- Default to English
- Allow manual language switch (future enhancement)
- Store preference in localStorage

### SEO & Metadata
- Update page titles and descriptions
- Add `lang` attribute to HTML
- Create English sitemap

### Performance
- Lazy load translation files
- Only load needed namespaces
- Cache translations client-side

### Maintenance
- Keep Chinese and English in sync
- Use translation keys consistently
- Document new translations

---

## 🤝 Need Help?

If you encounter issues:
1. Check `next-intl` documentation
2. Test AI prompts in AI playground first
3. Get feedback on English phrasing
4. Iterate based on user testing

---

**Last Updated**: 2025-01-23  
**Version**: 1.0.0  
**Branch**: `feature/english-i18n`

