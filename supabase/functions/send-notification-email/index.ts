import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeSecret(value: string | null): string | null {
  if (!value) return null;
  return value.trim().replace(/^['"]|['"]$/g, "");
}

function buildEmailPayload(type: string, payload: any) {
  if (type === "rsvp") {
    const attending = payload?.attending === "yes" ? "Accept" : "Decline";
    const song =
      typeof payload?.songRequest === "string" && payload.songRequest.trim()
        ? payload.songRequest.trim()
        : "None";
    return {
      subject: `Wedding RSVP: ${attending} - ${payload?.firstName ?? ""} ${payload?.lastName ?? ""} (${payload?.email ?? "no-email"})`.trim(),
      htmlContent: `
        <h2>New RSVP Submission</h2>
        <p><strong>Guest Email (typed):</strong> ${payload?.email ?? ""}</p>
        <p><strong>Name:</strong> ${payload?.firstName ?? ""} ${payload?.lastName ?? ""}</p>
        <p><strong>Attending:</strong> ${attending}</p>
        <p><strong>Dietary:</strong> ${payload?.dietary || "None"}</p>
        <p><strong>Song request:</strong> ${song}</p>
        <p><strong>Message:</strong> ${payload?.message || "None"}</p>
        <p><strong>Submitted:</strong> ${payload?.submittedAt || new Date().toISOString()}</p>
      `,
    };
  }

  return {
    subject: `Wedding Contact Message: ${payload?.subject || "No Subject"} (${payload?.email ?? "no-email"})`,
    htmlContent: `
      <h2>New Contact Message</h2>
      <p><strong>Guest Email (typed):</strong> ${payload?.email ?? ""}</p>
      <p><strong>Name:</strong> ${payload?.name ?? ""}</p>
      <p><strong>Subject:</strong> ${payload?.subject || "No Subject"}</p>
      <p><strong>Message:</strong></p>
      <p>${(payload?.message || "").replace(/\n/g, "<br>")}</p>
      <p><strong>Submitted:</strong> ${payload?.createdAt || new Date().toISOString()}</p>
    `,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const BREVO_API_KEY = normalizeSecret(
      Deno.env.get("BREVO_API_KEY") ||
      Deno.env.get("BREVO_KEY") ||
      Deno.env.get("BREVO_SMTP_API_KEY"),
    );

    const TO_EMAIL = (Deno.env.get("NOTIFY_TO_EMAIL") || "youtub132gp@gmail.com").trim();
    const FROM_EMAIL = (Deno.env.get("NOTIFY_FROM_EMAIL") || "shawn345dp@gmail.com").trim();
    const FROM_NAME = (Deno.env.get("NOTIFY_FROM_NAME") || "Wedding Website").trim();

    if (!BREVO_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing Brevo API key secret (BREVO_API_KEY)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { type, payload } = await req.json();
    if (!type || !payload) {
      return new Response(JSON.stringify({ error: "type and payload are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = buildEmailPayload(type, payload);

    const requestBody: Record<string, unknown> = {
      sender: { email: FROM_EMAIL, name: FROM_NAME },
      to: [{ email: TO_EMAIL }],
      subject: email.subject,
      htmlContent: email.htmlContent,
    };

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!brevoRes.ok) {
      const text = await brevoRes.text();
      const hint = BREVO_API_KEY.startsWith("xkeysib-")
        ? "Brevo key format looks valid. Check sender is verified in Brevo and TO/FROM emails are valid."
        : "Key format looks unusual. Use Brevo API key (usually starts with xkeysib-).";
      return new Response(JSON.stringify({ error: "Brevo send failed", details: text, hint }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await brevoRes.json();
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
