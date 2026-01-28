# ABA Harmony Scheduler

A sophisticated scheduling application for ABA therapy services with intelligent optimization and drag-and-drop functionality.

## 🚀 Quick Start

The application is **ready to preview and test** with sample data already loaded!

1. **Open the application** in your browser
2. **Select a date** in the header
3. **Click "Generate for [Date]"** to create an optimized schedule
4. **Drag and drop sessions** to reschedule them
5. **Explore the features** using the tabs

## ✨ Key Features

### Drag and Drop Scheduling
- **Click and drag** any session block to reschedule
- **Visual feedback** with drag handles and drop zones
- **Real-time validation** prevents conflicts
- **Instant updates** save automatically to database

### Intelligent Schedule Generation
- **CSO Algorithm** (Cat Swarm Optimization) creates optimal schedules
- **Constraint satisfaction** handles complex requirements:
  - Insurance qualifications matching
  - Allied health needs (OT, SLP)
  - Team alignments
  - Lunch breaks
  - Callouts and unavailability
- **Iterative optimization** with "Evolve Current" feature

### Comprehensive Management
- **Clients & Therapists**: Full CRUD operations with team assignments
- **Base Schedules**: Reusable templates for recurring patterns
- **Callouts**: Track unavailability for clients and therapists
- **Bulk Import**: CSV upload for clients and therapists
- **Filtering**: Focus on specific teams, therapists, or clients

### Modern UI/UX
- **Color-coded teams** for easy visual organization
- **Session type indicators**: ABA, OT, SLP, Lunch/Indirect
- **Interactive guide** shows instructions and legend
- **Responsive design** works on desktop and tablets
- **Real-time sync** across browser tabs

## 📊 Sample Data

Pre-loaded with demonstration data:
- **3 Teams**: Red, Blue, and Green (color-coded)
- **6 Therapists**: Various qualifications (BCBA, RBT, Clinical Fellow)
- **6 Clients**: Different insurance and allied health needs

## 🎯 Testing the Application

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for detailed testing scenarios and instructions.

Quick test workflow:
1. Navigate to **Clients** tab to see sample clients
2. Check **Therapists** tab to view available therapists
3. Go to **View Schedule** tab
4. Select tomorrow's date
5. Click **Generate** and watch the algorithm work
6. Try **dragging** a session to a new time/therapist
7. Click on a session to **edit** details
8. Use **filters** to focus on specific teams or clients

## 🔧 Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Real-time)
- **Algorithm**: Cat Swarm Optimization for scheduling
- **Build**: Vite
- **Features**: Drag & Drop API, JSONB storage, Row Level Security

## 📁 Project Structure

```
├── components/          # React components
│   ├── ScheduleView.tsx    # Main schedule grid with drag & drop
│   ├── ClientForm.tsx      # Client management
│   ├── TherapistForm.tsx   # Therapist management
│   └── icons/              # Icon components
├── services/           # Data services
│   ├── clientService.ts    # Client operations
│   ├── therapistService.ts # Therapist operations
│   ├── csoService.ts       # Scheduling algorithm
│   └── ...
├── lib/               # Utilities
│   └── supabase.ts        # Database client
├── types.ts           # TypeScript definitions
├── App.tsx            # Main application
└── supabase/          # Database
    └── migrations/        # Schema migrations
```

## 🎨 Session Types

- **ABA** (Blue): Applied Behavior Analysis therapy sessions
- **OT** (Green): Occupational Therapy sessions
- **SLP** (Purple): Speech-Language Pathology sessions
- **Lunch/Indirect** (Yellow): Break and administrative time

## 🔐 Security

- Row Level Security (RLS) enabled on all tables
- Environment variables for API keys
- Input validation on all operations
- Conflict prevention in scheduling

## 📖 Additional Documentation

- [FEATURES.md](./FEATURES.md) - Detailed feature descriptions
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Complete testing scenarios
- [seed-sample-data.sql](./seed-sample-data.sql) - Sample data script

## 🚦 Status

✅ Fully functional and ready for preview
✅ Sample data loaded
✅ All features operational
✅ Database configured
✅ Build optimized

## 💡 Tips

- **Generate first**: Always generate a schedule before trying to drag blocks
- **Check filters**: If schedule looks empty, clear filters
- **Use Evolve**: After manual edits, use "Evolve Current" to re-optimize
- **Save base schedules**: Create templates for frequently used patterns
- **Add callouts**: Mark therapist vacations or client absences

## 🎉 Try These Features

1. **Drag and Drop**: Move sessions around the schedule
2. **Algorithm**: Generate optimized schedules automatically
3. **Filters**: View specific teams or clients
4. **Base Schedules**: Create reusable templates
5. **Callouts**: Add unavailability and see it respected
6. **Bulk Import**: Upload CSV files of clients/therapists

---

**Ready to schedule!** Open the application and start by selecting a date and generating your first schedule.
