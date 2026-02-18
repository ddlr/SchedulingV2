# Solver Setup Guide

This project uses **Google OR-Tools (CP-SAT)** running in a **Supabase Edge Function** to generate optimal schedules.

## 1. Supabase Setup

### Deployment
To deploy the solver to your Supabase project, run the following command from your terminal (ensure you have the [Supabase CLI](https://supabase.com/docs/guides/cli) installed):

```bash
supabase functions deploy solve-schedule
```

### Environment Variables
Supabase automatically provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. However, ensure that the **Service Role Key** has sufficient permissions to read from the `clients`, `therapists`, `teams`, `system_config`, `settings`, and `callouts` tables.

### Authentication
The function is currently configured with `verify_jwt = false` in `config.toml` to simplify the connection from the browser. If you wish to secure it further, you can set it to `true` and ensure the frontend passes the user's JWT.

## 2. Google OR-Tools Setup

**Good news!** There is no separate "Google Cloud" setup required for the scheduler.

Google OR-Tools is an open-source library. The deployment process above automatically installs it into the Supabase Python environment using the `requirements.txt` file located in `supabase/functions/solve-schedule/`.

## 3. Local Development (Optional)

If you want to test the solver locally:

1. Start your local Supabase stack:
   ```bash
   supabase start
   ```

2. Serve the functions locally:
   ```bash
   supabase functions serve
   ```

3. The frontend will automatically attempt to connect to the local function if your `VITE_SUPABASE_URL` points to your local instance.

## 4. Troubleshooting

- **Failed to connect**: Ensure the function is deployed and the name matches exactly (`solve-schedule`).
- **Infeasible**: This means the constraints (like mandatory lunch breaks or insurance matches) cannot be satisfied for all staff. Try relaxing some requirements in the App settings.
- **CORS Errors**: The function includes CORS middleware, but ensure your Supabase project settings allow requests from your frontend domain.
