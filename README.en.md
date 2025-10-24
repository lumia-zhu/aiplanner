# 📋 Task Manager - AI-Powered Planning

A modern task management application built with Next.js + Supabase, featuring user authentication, full CRUD operations, priority management, AI-assisted planning, and deadline reminders.

## ✨ Key Features

### Core Task Management
- 🔐 **User Authentication** - Simple username + password registration and login
- 📝 **Task Management** - Complete CRUD functionality
- 🎯 **Priority Levels** - High/Medium/Low with color-coded labels
- ⏰ **Deadlines** - Set deadlines with automatic overdue highlighting
- ✅ **Completion Status** - Checkbox to mark tasks as complete
- 🔄 **Smart Sorting** - Auto-sort by priority + deadline
- 📱 **Responsive Design** - Optimized for desktop and mobile
- 🎨 **Modern UI** - Clean blue theme with beautiful interface

### AI-Powered Features 🤖
- 💡 **Task Clarification** - AI helps you refine vague tasks into clear, actionable items
- 🎯 **Task Decomposition** - Break down complex tasks into manageable subtasks
- ⏱️ **Time Estimation** - Get intelligent time estimates based on task details
- 📊 **Priority Sorting** - AI-assisted priority organization using Eisenhower Matrix
- 🧠 **Context-Aware** - Considers your major, grade level, and personal challenges

### Calendar & Planning
- 📅 **Calendar View** - Week and month views with task visualization
- 📆 **Date Range Selection** - Filter tasks by custom date ranges
- 🗓️ **Quick Presets** - Today, This Week, Next Week shortcuts
- 📍 **Task Tooltips** - Hover to see all tasks for a specific day

### Import & Integration
- 📚 **Canvas LMS Integration** - Import assignments from Canvas
- 📧 **Outlook Calendar** - Import events from Microsoft Outlook
- 📥 **iCal Support** - Parse and import .ics calendar files

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL + Authentication)
- **AI**: Doubao (ByteDance) API for intelligent task assistance
- **Deployment**: Vercel
- **State Management**: React Hooks
- **Drag & Drop**: @dnd-kit
- **Icons & UI**: Radix UI components

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd task-manager
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# AI Configuration (Doubao API)
NEXT_PUBLIC_DOUBAO_API_KEY=your_doubao_api_key
NEXT_PUBLIC_DOUBAO_ENDPOINT=https://ark.cn-beijing.volces.com/api/v3

# Microsoft OAuth (for Outlook integration)
NEXT_PUBLIC_MICROSOFT_CLIENT_ID=your_microsoft_client_id
NEXT_PUBLIC_MICROSOFT_REDIRECT_URI=http://localhost:3000/dashboard

# Canvas LMS (optional)
NEXT_PUBLIC_CANVAS_DOMAIN=your_canvas_domain
```

### 4. Database Setup

Run the following SQL in your Supabase SQL Editor:

```sql
-- See database/schema.sql for the complete database schema
-- Includes: users, tasks, user_profiles, chat_messages tables
```

Execute the SQL files in order:
1. `database/schema.sql` - Main schema
2. `database/user-profiles-sample-data.sql` - Sample user profiles (optional)

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
task-manager/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── auth/              # Login & Register
│   │   ├── dashboard/         # Main dashboard
│   │   └── api/               # API routes
│   ├── components/            # React components
│   │   ├── TaskForm.tsx       # Task creation/editing
│   │   ├── TaskItem.tsx       # Task display
│   │   ├── CalendarView.tsx   # Calendar component
│   │   ├── ChatSidebar.tsx    # AI chat interface
│   │   └── ...
│   ├── hooks/                 # Custom React hooks
│   │   └── useWorkflowAssistant.ts  # AI workflow logic
│   ├── lib/                   # Utility functions
│   │   ├── supabase.ts        # Supabase client
│   │   ├── doubaoService.ts   # AI service
│   │   ├── clarificationAI.ts # Task clarification
│   │   └── ...
│   ├── types/                 # TypeScript types
│   └── utils/                 # Helper functions
├── database/                  # SQL schemas and migrations
├── docs/                      # Documentation
└── public/                    # Static assets
```

## 🎯 Usage Guide

### Basic Task Management

1. **Create a Task**
   - Click "Add Task" or press `Ctrl/Cmd + K` for quick add
   - Fill in title, description, priority, deadline, and tags
   - Optionally add subtasks

2. **Manage Tasks**
   - Click checkbox to mark complete
   - Drag and drop to reorder
   - Click task title to edit
   - Click 🗑️ to delete

3. **Filter & Sort**
   - Use date range selector to filter by time period
   - Click calendar dates to select custom ranges
   - Tasks auto-sort by priority and deadline

### AI-Assisted Planning

1. **Start AI Assistant**
   - Click "AI-Assisted Planning" button (floats at bottom when tasks are visible)
   - Choose action: Refine single task or Sort all tasks

2. **Task Clarification**
   - Select a task to clarify
   - Answer AI's reflective questions
   - Review AI's structured understanding
   - Confirm to update task with enhanced details

3. **Task Decomposition**
   - Select a task to decompose
   - Provide context about your situation
   - AI suggests logical subtasks
   - Review and confirm to create subtasks

4. **Time Estimation**
   - AI provides estimated duration based on task complexity
   - Considers your experience level and task details
   - Updates task with time estimate

5. **Priority Sorting**
   - Choose matrix-based or feeling-based sorting
   - AI organizes all tasks by importance and urgency
   - Review and apply new priority levels

### Calendar & Date Management

- **Week View**: Default collapsed view showing current week
- **Month View**: Click "Expand" to see full month
- **Navigate**: Click < > arrows or "Back to Today"
- **Select Range**: Click two dates to filter tasks
- **Task Visualization**: See up to 3 task titles per day, hover for full list

## 🔑 Key Features Explained

### AI Workflow Modes

1. **Initial** - Choose between refining single task or sorting all tasks
2. **Single Task Action** - Clarify, Decompose, or Estimate time
3. **Clarification** - Answer questions about task goals and details
4. **Decomposition** - Provide context for intelligent subtask suggestions
5. **Estimation** - Get AI-powered time estimates
6. **Priority Sorting** - Organize tasks by importance/urgency

### User Profile Integration

AI considers your personal context:
- **Major**: Academic field (e.g., "Computer Science")
- **Grade**: Current year (e.g., "Sophomore")
- **Challenges**: Personal difficulties (e.g., "ADHD", "Time management")
- **Workplaces**: Preferred work environments (e.g., "Library", "Café")

This enables more personalized and relevant AI suggestions.

## 🐛 Troubleshooting

### Common Issues

**Tasks not loading?**
- Check Supabase connection in browser console
- Verify `.env.local` configuration
- Ensure database tables exist

**AI not responding?**
- Verify `NEXT_PUBLIC_DOUBAO_API_KEY` is set
- Check API quota/credits
- Look for errors in browser console

**Calendar not showing tasks?**
- Ensure tasks have valid deadline dates
- Check date range filter settings
- Refresh page

### Development Issues

**Module not found errors?**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Build errors?**
```bash
# Check TypeScript errors
npm run build
```

## 📚 Documentation

- [AI Setup Guide](docs/AI_SETUP.md) - Configure Doubao AI
- [Outlook Integration](docs/OUTLOOK_SETUP.md) - Setup Microsoft OAuth
- [Project Setup](PROJECT_SETUP.md) - Detailed setup instructions
- [Stress Test Guide](STRESS_TEST_GUIDE.md) - Performance testing

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is for educational purposes.

## 🙏 Acknowledgments

- Next.js team for the amazing framework
- Supabase for backend infrastructure
- ByteDance for Doubao AI API
- All contributors and testers

---

**Built with ❤️ for better productivity and task management**


