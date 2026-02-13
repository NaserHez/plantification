import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { plantName, language } = await req.json();
    if (!plantName) {
      return new Response(
        JSON.stringify({ error: 'No plant name provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const langMap: Record<string, string> = {
      en: "English",
      ar: "Arabic",
      pt: "European Portuguese (Portugal)",
    };
    const langName = langMap[language] || "English";

    const aiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!aiKey) {
      return new Response(
        JSON.stringify({ error: 'AI key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${aiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: `Give brief care tips (3-4 sentences) for the plant "${plantName}" in ${langName}. Include watering, sunlight, soil, and common issues. Be concise and practical. Respond entirely in ${langName}.`,
          },
        ],
        max_tokens: 200,
      }),
    });

    if (!aiRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to generate care tips' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiRes.json();
    const careTips = aiData.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ careTips }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
