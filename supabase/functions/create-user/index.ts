import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateUserPayload {
  email: string;
  password: string;
  full_name: string;
  role: "admin" | "staff" | "viewer";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    const {
      data: { user: callingUser },
      error: authError,
    } = await anonClient.auth.getUser();

    if (authError || !callingUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await anonClient
      .from("users")
      .select("role")
      .eq("email", callingUser.email)
      .maybeSingle();

    if (!callerProfile || callerProfile.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Only admins can create users" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const payload: CreateUserPayload = await req.json();

    if (!payload.email || !payload.password || !payload.full_name || !payload.role) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, password, full_name, role" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Helper to create auth user, handling orphaned users from previous failed attempts
    const createAuthUser = async () => {
      const result = await adminClient.auth.admin.createUser({
        email: payload.email,
        password: payload.password,
        email_confirm: true,
      });

      if (result.error?.message?.includes("already been registered")) {
        // Check if profile exists — if not, this is an orphaned auth user from a prior failure
        const { data: existingProfile } = await adminClient
          .from("users")
          .select("id")
          .eq("email", payload.email)
          .maybeSingle();

        if (existingProfile) {
          // User genuinely exists in both tables
          return { data: null, error: { message: "A user with this email already exists" } };
        }

        // Orphaned auth user — clean up and retry
        const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers();
        const orphan = (authUsers || []).find((u: { email?: string }) => u.email === payload.email);
        if (orphan) {
          await adminClient.auth.admin.deleteUser(orphan.id);
          return adminClient.auth.admin.createUser({
            email: payload.email,
            password: payload.password,
            email_confirm: true,
          });
        }

        return result;
      }

      return result;
    };

    const { data: authData, error: signUpError } = await createAuthUser();

    if (signUpError) {
      return new Response(JSON.stringify({ error: signUpError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!authData?.user) {
      return new Response(
        JSON.stringify({ error: "Failed to create auth user" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: profileError } = await adminClient.from("users").insert([
      {
        id: authData.user.id,
        email: payload.email,
        full_name: payload.full_name,
        role: payload.role,
        is_active: true,
      },
    ]);

    if (profileError) {
      // Clean up the auth user so we don't leave an orphan
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, user_id: authData.user.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
