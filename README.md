# ABA Harmony Scheduler - Supabase Migration Guide

This guide walks you through everything you need to do to get the application working with your Supabase backend.

## Step 1: Initialize your Supabase Database

1.  Open your [Supabase Dashboard](https://supabase.com/dashboard).
2.  Select your project.
3.  Click on the **SQL Editor** icon in the left sidebar.
4.  Click **New Query**.
5.  Copy the entire content of the `supabase_schema.sql` file (found in this repository) and paste it into the editor.
6.  Click **Run**.
    *   *Note: This will create all necessary tables (`staff`, `clients`, `teams`, etc.) and set up public access policies.*

## Step 2: Configure Environment Variables

1.  In the root directory of this project, create a file named `.env`.
2.  Paste the following lines into the `.env` file:
    ```env
    VITE_SUPABASE_URL=https://vopitvfczkbluenvbvgv.supabase.co
    VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZvcGl0dmZjemtibHVlbnZidmd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNDU2NzcsImV4cCI6MjA4NTYyMTY3N30.qu1f3kpbMZ_dx7azaT40eHD1sohYfyHw15CBc-H5a-M
    ```
3.  Save the file.

## Step 3: Install and Run

1.  Open your terminal in the project root.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```

## Why was it not working?

1.  **Missing Tables**: The system was trying to load data from tables that hadn't been created yet in your Supabase project (404 errors).
2.  **Environment Configuration**: The application requires the `.env` file to know where your database is. Without it, the app would crash on startup.
3.  **Terminology Shift**: We renamed "Therapists" to "Staff" as requested. Some internal mappings needed to be updated to match the new database schema.

## Troubleshooting

-   **Blank Screen?** Ensure you have run `npm install` and that your `.env` file is present. I have added a "Safety Mode" that prevents the app from crashing even if the config is missing.
-   **No Data?** Make sure you clicked **Run** in the Supabase SQL Editor with the `supabase_schema.sql` content.
-   **Still Stuck?** Check your browser's console (F12) for any specific error messages.
