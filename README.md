# ABA Harmony Scheduler

An AI-enhanced scheduling system for ABA services.

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm

### Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables:
   Create a `.env` file in the root directory and add your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
   (You can use `.env.example` as a template).

### Database Setup

Run the SQL script provided in `supabase_schema.sql` in your Supabase SQL Editor to create the necessary tables and policies.

### Running the App

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

## Recent Changes

- Migrated data layer to Supabase.
- Renamed 'Therapist' to 'Staff' throughout the application.
- Added dedicated 'insurance_qualifications' table.
- Added environment variable support for Supabase configuration.
