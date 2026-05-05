import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabaseAuth.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const rawName = typeof body.plantName === 'string' ? body.plantName : '';
    const rawLang = typeof body.language === 'string' ? body.language : 'en';
    const language = /^[a-zA-Z]{2}(-[a-zA-Z]{2})?$/.test(rawLang) ? rawLang : 'en';
    // Sanitize plantName: limit length and restrict to safe botanical characters
    const plantName = rawName
      .replace(/[^\p{L}\p{N}\s'\-.×()]/gu, '')
      .trim()
      .slice(0, 100);
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
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
