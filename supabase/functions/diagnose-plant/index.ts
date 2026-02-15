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
    const apiKey = Deno.env.get('PLANT_ID_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'PLANT_ID_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { image } = await req.json();
    if (!image) {
      return new Response(
        JSON.stringify({ error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const base64Image = image.includes(',') ? image.split(',')[1] : image;

    const response = await fetch('https://api.plant.id/v3/identification', {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images: [base64Image],
        health: 'all',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `API error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const healthResult = data.result?.disease;

    let healthAssessment = { isHealthy: true, diseases: [] as any[] };
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

    // Generate care recommendations using Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let careRecommendations = null;
    if (LOVABLE_API_KEY) {
      try {
        const plantName = data.result?.classification?.suggestions?.[0]?.name || 'unknown plant';
        const diseaseNames = healthAssessment.diseases.map(d => d.name).join(', ') || 'none detected';
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-3-flash-preview',
            messages: [
              {
                role: 'system',
                content: 'You are a plant care expert. Return ONLY valid JSON, no markdown or extra text.'
              },
              {
                role: 'user',
                content: `Given a plant (likely "${plantName}") with health status: ${healthAssessment.isHealthy ? 'healthy' : 'issues detected'}, diseases: ${diseaseNames}.
Provide care recommendations as JSON: {"watering":{"frequency":"...","amount":"...","tips":"..."},"sunlight":"...","nutrients":"...","preventiveCare":"..."}`
              }
            ],
          }),
        });
        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const text = aiData.choices?.[0]?.message?.content || '';
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) careRecommendations = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error('AI care tips error:', e);
      }
    }

    return new Response(
      JSON.stringify({ ...healthAssessment, careRecommendations }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
