import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function diagnoseWithGemini(base64Image: string, language: string) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return null;

  const langMap: Record<string, string> = { en: "English", ar: "Arabic", pt: "European Portuguese (Portugal)" };
  const langName = langMap[language] || "English";
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a plant pathologist. Analyze this plant photo for visible health issues. Prioritize organic and biological remedies over chemicals. Return ONLY valid JSON, no markdown, in this exact shape:
{
  "isHealthy": true,
  "overallConfidence": 0,
  "diseases": [{"name":"issue name","probability":0,"description":"visible symptoms","cause":"likely cause","treatment":"organic/biological treatment","chemicalTreatment":null,"prevention":"prevention steps","similarImages":[]}],
  "careRecommendations": {
    "watering": {"frequency":"specific schedule","amount":"specific amount","tips":"watering advice"},
    "sunlight":"light advice",
    "nutrients":"feeding advice",
    "preventiveCare":"prevention advice",
    "urgentActions":"immediate actions or null",
    "seasonalAdvice":"seasonal advice"
  }
}
Respond in ${langName}. Use a conservative confidence when the image is unclear.`
            },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          ],
        },
      ],
      max_tokens: 1100,
    }),
  });

  if (!response.ok) {
    console.error('Gemini diagnosis HTTP error:', response.status, await response.text());
    return null;
  }

  const data = await response.json();
  let text = data.choices?.[0]?.message?.content || '';
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0) return null;

  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return {
      isHealthy: parsed.isHealthy !== false,
      overallConfidence: Math.round(Number(parsed.overallConfidence) || 70),
      diseases: Array.isArray(parsed.diseases) ? parsed.diseases.slice(0, 5).map((d: any) => ({
        name: d.name || 'Plant stress',
        probability: Math.round(Number(d.probability) || 0),
        description: d.description || null,
        cause: d.cause || null,
        treatment: d.treatment || null,
        chemicalTreatment: d.chemicalTreatment || null,
        prevention: d.prevention || null,
        similarImages: [],
      })) : [],
      careRecommendations: parsed.careRecommendations || null,
      diagnostics: { source: 'gemini' },
    };
  } catch (e) {
    console.error('Gemini diagnosis JSON parse failed:', e);
    return null;
  }
}

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const apiKey = Deno.env.get('PLANT_ID_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'PLANT_ID_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { image, language } = await req.json();
    const langMap: Record<string, string> = { en: "English", ar: "Arabic", pt: "European Portuguese (Portugal)" };
    const langName = langMap[language] || "English";
    if (!image) {
      return new Response(
        JSON.stringify({ error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const base64Image = image.includes(',') ? image.split(',')[1] : image;

    // Use the health_assessment endpoint for more detailed results
    const response = await fetch('https://api.plant.id/v3/health_assessment', {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images: [base64Image],
        similar_images: true,
        health: 'all',
        details: [
          'local_name',
          'description',
          'url',
          'treatment',
          'cause',
          'classification',
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Plant.id API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Plant identification service temporarily unavailable' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const healthResult = data.result?.disease;

    let healthAssessment = { isHealthy: true, diseases: [] as any[], overallConfidence: 0 };
    if (healthResult) {
      const isHealthy = healthResult.is_healthy?.binary ?? true;
      const overallConfidence = Math.round((healthResult.is_healthy?.probability ?? 0) * 100);
      const diseases = (healthResult.suggestions || [])
        .filter((d: any) => d.name !== 'healthy')
        .slice(0, 5)
        .map((d: any) => ({
          name: d.name,
          probability: Math.round((d.probability || 0) * 100),
          description: d.details?.description || null,
          cause: d.details?.cause || null,
          treatment: d.details?.treatment?.biological?.join('. ') || null,
          chemicalTreatment: d.details?.treatment?.chemical?.join('. ') || null,
          prevention: d.details?.treatment?.prevention?.join('. ') || null,
          similarImages: (d.similar_images || []).slice(0, 2).map((img: any) => ({
            url: img.url,
            similarity: Math.round((img.similarity || 0) * 100),
          })),
        }));
      healthAssessment = { isHealthy, diseases, overallConfidence };
    }

    // Generate care recommendations using Lovable AI with richer context
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let careRecommendations = null;
    if (LOVABLE_API_KEY) {
      try {
        const plantName = data.result?.classification?.suggestions?.[0]?.name || 'unknown plant';
        const diseaseDetails = healthAssessment.diseases.map(d =>
          `${d.name} (${d.probability}% confidence)${d.cause ? `, cause: ${d.cause}` : ''}`
        ).join('; ') || 'none detected';

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `You are a certified plant pathologist and horticulturist. Provide precise, actionable care recommendations based on the plant species and detected conditions. Prioritize organic/biological treatments over chemical ones. Return ONLY valid JSON, no markdown or extra text. Respond entirely in ${langName}.`
              },
              {
                role: 'user',
                content: `Plant: "${plantName}"
Health: ${healthAssessment.isHealthy ? 'healthy' : 'issues detected'} (confidence: ${healthAssessment.overallConfidence}%)
Detected conditions: ${diseaseDetails}

Provide detailed care recommendations as JSON:
{
  "watering": {"frequency": "specific schedule", "amount": "specific amount", "tips": "species-specific watering advice"},
  "sunlight": "specific light requirements for this species",
  "nutrients": "specific fertilizer type, NPK ratio, and schedule",
  "preventiveCare": "species-specific preventive measures",
  "urgentActions": "immediate steps if issues detected, or null if healthy",
  "seasonalAdvice": "current season care adjustments"
}`
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
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
