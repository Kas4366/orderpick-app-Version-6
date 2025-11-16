import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PackerInfoPayload {
  rowIndex: number;
  packerName?: string;
  packedTime?: string;
  reorderTime?: string;
  secretKey?: string;
}

interface WebhookRequest {
  appsScriptUrl: string;
  payload: PackerInfoPayload;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { appsScriptUrl, payload }: WebhookRequest = await req.json();

    if (!appsScriptUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing appsScriptUrl" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (!payload || (!payload.packerName && !payload.reorderTime && payload.reorderTime !== '')) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required payload fields" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log(`📤 Proxying webhook request to Google Apps Script...`);
    console.log(`URL: ${appsScriptUrl}`);
    console.log(`Payload:`, payload);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(appsScriptUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      console.log(`📥 Apps Script response (${response.status}):`, responseText);

      let result;
      try {
        result = JSON.parse(responseText);
      } catch {
        result = { success: false, error: `Invalid JSON response: ${responseText}` };
      }

      return new Response(
        JSON.stringify(result),
        {
          status: response.ok ? 200 : response.status,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      if (fetchError.name === "AbortError") {
        console.error("❌ Request to Apps Script timed out");
        return new Response(
          JSON.stringify({ success: false, error: "Request timeout (15s)" }),
          {
            status: 504,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      console.error("❌ Error calling Apps Script:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: `Network error: ${fetchError.message}` }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
  } catch (error: any) {
    console.error("❌ Error in webhook proxy:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
