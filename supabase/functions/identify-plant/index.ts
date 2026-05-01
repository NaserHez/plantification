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

    const apiKey = Deno.env.get('PLANT_ID_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'PLANT_ID_API_KEY not configured', isMock: true }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { image, language } = await req.json();
    if (!image) {
      return new Response(
        JSON.stringify({ error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const base64Image = image.includes(',') ? image.split(',')[1] : image;

    console.log('Calling Plant.id API with health assessment...');

    const response = await fetch('https://api.plant.id/v3/identification', {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images: [base64Image],
        similar_images: true,
        health: 'all',
      }),
    });

    console.log('Plant.id response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Plant.id API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Plant identification service temporarily unavailable', isMock: false }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const suggestion = data.result?.classification?.suggestions?.[0];

    if (!suggestion) {
      return new Response(
        JSON.stringify({ error: 'No plant identified', isMock: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse health assessment
    const healthResult = data.result?.disease;
    let healthAssessment = null;
    if (healthResult) {
      const isHealthy = healthResult.is_healthy?.binary ?? true;
      const diseases = (healthResult.suggestions || [])
        .filter((d: any) => d.name !== 'healthy')
        .slice(0, 5)
        .map((d: any) => ({
          name: d.name,
          probability: Math.round((d.probability || 0) * 100),
          description: d.details?.description || null,
          treatment: d.details?.treatment?.biological?.join('. ') || d.details?.treatment?.chemical?.join('. ') || null,
        }));
      healthAssessment = { isHealthy, diseases };
    }

    // Generate care tips using Lovable AI
    let careTips = "";
    const langMap: Record<string, string> = { en: "English", ar: "Arabic", pt: "European Portuguese (Portugal)" };
    const langName = langMap[language] || "English";
    try {
      const aiKey = Deno.env.get('LOVABLE_API_KEY');
      if (aiKey) {
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
                content: `Give brief care tips (3-4 sentences) for the plant "${suggestion.name}" in ${langName}. Include watering, sunlight, soil, and common issues. Be concise and practical. Respond entirely in ${langName}.`,
              },
            ],
            max_tokens: 200,
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          careTips = aiData.choices?.[0]?.message?.content || "";
        }
      }
    } catch (e) {
      console.error('AI care tips error:', e);
    }

    const result = {
      name: suggestion.name,
      scientificName: suggestion.name,
      commonNames: data.result?.classification?.suggestions?.slice(0, 3).map((s: any) => s.name) || [],
      confidence: Math.round((suggestion.probability || 0) * 100),
      similarImages: suggestion.similar_images?.slice(0, 3).map((img: any) => img.url) || [],
      careTips,
      healthAssessment,
      isMock: false,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: error.message, isMock: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
