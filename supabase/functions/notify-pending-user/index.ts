import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Sends an email notification to all admin users when a new pending user registers.
 *
 * Expected JSON body: { user_name: string, user_email: string }
 *
 * Requires these Supabase secrets:
 *   - BREVO_API_KEY     — API key from Brevo (app.brevo.com → SMTP & API → API Keys)
 *   - NOTIFY_FROM_EMAIL — verified sender address in Brevo (e.g. "noreply@kevelyn.cz")
 *   - NOTIFY_FROM_NAME  — (optional) sender display name (e.g. "Kevelyn")
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { user_name, user_email } = await req.json();

    if (!user_name || !user_email) {
      return new Response(
        JSON.stringify({ error: "Missing user_name or user_email" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase admin client to query admin users
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all admin user emails
    const { data: admins, error: adminError } = await supabase
      .from("users")
      .select("email, full_name")
      .eq("app_role", "admin");

    if (adminError) {
      console.error("Error fetching admins:", adminError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch admin users" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    if (!admins || admins.length === 0) {
      return new Response(
        JSON.stringify({ message: "No admin users to notify" }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    const fromEmail = Deno.env.get("NOTIFY_FROM_EMAIL") || "noreply@example.com";
    const fromName = Deno.env.get("NOTIFY_FROM_NAME") || "Kevelyn";

    if (!brevoApiKey) {
      console.error("BREVO_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Brevo Transactional Email API — send to all admins in one request
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: fromName, email: fromEmail },
        to: admins.map((admin) => ({
          email: admin.email,
          name: admin.full_name || admin.email,
        })),
        subject: `Nový uživatel čeká na schválení: ${user_name}`,
        htmlContent: `
          <h2>Nový uživatel čeká na schválení</h2>
          <p><strong>Jméno:</strong> ${user_name}</p>
          <p><strong>Email:</strong> ${user_email}</p>
          <br/>
          <p>Přihlaste se do aplikace a schvalte uživatele v <strong>Nastavení → Schválení</strong>.</p>
        `,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Brevo API error:", response.status, errorBody);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: errorBody }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    return new Response(
      JSON.stringify({ message: `Email sent to ${admins.length} admin(s)`, messageId: result.messageId }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in notify-pending-user:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
