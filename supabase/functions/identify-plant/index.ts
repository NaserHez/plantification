import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// In-memory cache (per edge worker). Keyed by imageHash+language+aiFlag.
interface CacheEntry { value: any; ts: number }
const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const CACHE_MAX = 200;

function cacheGet(key: string) {
  const e = CACHE.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS) { CACHE.delete(key); return null; }
  return e.value;
}
function cacheSet(key: string, value: any) {
  if (CACHE.size >= CACHE_MAX) {
    const oldest = CACHE.keys().next().value;
    if (oldest) CACHE.delete(oldest);
  }
  CACHE.set(key, { value, ts: Date.now() });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const t0 = Date.now();
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

    const body = await req.json();
    const image = body.image;
    const imageHash = body.imageHash;
    const useAiValidation = body.useAiValidation !== false;
    // Sanitize language: only allow short alphanumeric codes (e.g. en, ar, pt, pt-PT)
    const rawLang = typeof body.language === 'string' ? body.language : 'en';
    const language = /^[a-zA-Z]{2}(-[a-zA-Z]{2})?$/.test(rawLang) ? rawLang : 'en';
    if (!image || typeof image !== 'string') {
      return new Response(
        JSON.stringify({ error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const base64Image = image.includes(',') ? image.split(',')[1] : image;

    // Compute hash if not provided
    let hash = imageHash as string | undefined;
    if (!hash) {
      const buf = new TextEncoder().encode(base64Image.slice(0, 4096) + ':' + base64Image.length);
      const digest = await crypto.subtle.digest('SHA-256', buf);
      hash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    const cacheKey = `${hash}|${language || 'en'}|${useAiValidation ? 1 : 0}`;
    const cached = cacheGet(cacheKey);
    if (cached) {
      return new Response(
        JSON.stringify({
          ...cached,
          diagnostics: { ...(cached.diagnostics || {}), cached: true, totalMs: Date.now() - t0 },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Request enriched plant details for higher accuracy
    const detailsParam = [
      'common_names', 'taxonomy', 'description', 'image', 'synonyms',
      'edible_parts', 'watering', 'best_light_condition', 'best_soil_type',
    ].join(',');

    const idUrl = `https://api.plant.id/v3/identification?details=${encodeURIComponent(detailsParam)}&language=${encodeURIComponent(language || 'en')}`;
    const tPid = Date.now();
    const response = await fetch(idUrl, {
      method: 'POST',
      headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: [base64Image],
        similar_images: true,
        health: 'all',
        classification_level: 'all',
        classification_raw: false,
      }),
    });
    const plantIdMs = Date.now() - tPid;
    const plantIdStatus = response.status;

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Plant.id API error:', response.status, errorText);

      // Gemini-only fallback when Plant.id is unavailable (rate limit, quota, etc.)
      const aiKey = Deno.env.get('LOVABLE_API_KEY');
      if (aiKey) {
        try {
          const fallback = await identifyWithGemini(base64Image, language, aiKey);
          if (fallback) {
            const result = {
              ...fallback,
              imageHash: hash,
              diagnostics: {
                plantIdStatus,
                plantIdMs,
                aiMs: fallback.diagnostics?.aiMs || 0,
                aiUsed: true,
                aiBoosted: false,
                aiAgreement: false,
                ambiguous: false,
                cached: false,
                fallback: 'gemini',
                plantIdError: plantIdStatus === 429 ? 'rate_limit' : `http_${plantIdStatus}`,
                totalMs: Date.now() - t0,
              },
            };
            cacheSet(cacheKey, result);
            return new Response(JSON.stringify(result), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } catch (e) {
          console.error('Gemini fallback error:', e);
        }
      }

      return new Response(
        JSON.stringify({
          error: plantIdStatus === 429
            ? 'Plant identification quota exceeded. Please try again later.'
            : 'Plant identification service temporarily unavailable',
          isMock: false,
          diagnostics: { plantIdStatus, plantIdMs, totalMs: Date.now() - t0, cached: false, aiUsed: false },
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const suggestions = data.result?.classification?.suggestions || [];
    let suggestion = suggestions[0];

    if (!suggestion) {
      return new Response(
        JSON.stringify({
          error: 'No plant identified',
          isMock: false,
          diagnostics: { plantIdStatus, plantIdMs, totalMs: Date.now() - t0, cached: false, aiUsed: false },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiKey = Deno.env.get('LOVABLE_API_KEY');
    const top = suggestions.slice(0, 5);
    const topProb = top[0]?.probability || 0;
    const secondProb = top[1]?.probability || 0;
    const ambiguous = topProb < 0.85 || (topProb - secondProb) < 0.15;
    let aiBoosted = false;
    let aiAgreement = false;
    let aiUsed = false;
    let aiMs = 0;

    if (useAiValidation && aiKey && top.length > 1 && ambiguous) {
      aiUsed = true;
      const tAi = Date.now();
      try {
        const candidateList = top.map((s: any, i: number) =>
          `${i + 1}. ${s.name}${s.details?.common_names?.length ? ' (' + s.details.common_names.slice(0, 3).join(', ') + ')' : ''}`
        ).join('\n');
        const visionRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${aiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: `You are a botanist. Look at this plant photo and choose the MOST LIKELY species from the candidates below. Reply with ONLY the number (1-${top.length}) of the best match. If none clearly match, reply "0".\n\nCandidates:\n${candidateList}` },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
              ],
            }],
            max_tokens: 10,
          }),
        });
        if (visionRes.ok) {
          const v = await visionRes.json();
          const reply = (v.choices?.[0]?.message?.content || '').trim();
          const pick = parseInt(reply.match(/\d+/)?.[0] || '0', 10);
          if (pick >= 1 && pick <= top.length) {
            const chosen = top[pick - 1];
            aiAgreement = chosen.name === suggestion.name;
            if (!aiAgreement) suggestion = chosen;
            aiBoosted = true;
          }
        }
      } catch (e) {
        console.error('AI cross-validation error:', e);
      }
      aiMs = Date.now() - tAi;
    }

    const baseConfidence = Math.round((suggestion.probability || 0) * 100);
    const refinedConfidence = aiBoosted
      ? Math.min(99, baseConfidence + (aiAgreement ? 10 : 5))
      : baseConfidence;

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

    let careTips = "";
    const langMap: Record<string, string> = { en: "English", ar: "Arabic", pt: "European Portuguese (Portugal)" };
    const langName = langMap[language] || "English";
    try {
      if (aiKey) {
        const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${aiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [{
              role: 'user',
              content: `Give brief care tips (3-4 sentences) for the plant "${suggestion.name}" in ${langName}. Include watering, sunlight, soil, and common issues. Prioritize organic/biological treatments. Be concise and practical. Respond entirely in ${langName}.`,
            }],
            max_tokens: 220,
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

    const sci = suggestion.details?.taxonomy?.species || suggestion.name;
    const result = {
      name: suggestion.details?.common_names?.[0] || suggestion.name,
      scientificName: sci,
      commonNames: suggestion.details?.common_names?.slice(0, 5)
        || (suggestions.slice(0, 3).map((s: any) => s.name) || []),
      confidence: refinedConfidence,
      rawConfidence: baseConfidence,
      alternatives: top.slice(0, 5).map((s: any) => ({
        name: s.details?.common_names?.[0] || s.name,
        scientificName: s.name,
        commonNames: s.details?.common_names?.slice(0, 3) || [],
        probability: Math.round((s.probability || 0) * 100),
      })),
      taxonomy: suggestion.details?.taxonomy || null,
      description: suggestion.details?.description?.value || null,
      similarImages: suggestion.similar_images?.slice(0, 4).map((img: any) => img.url) || [],
      careTips,
      healthAssessment,
      verifiedByAI: aiBoosted,
      isMock: false,
      imageHash: hash,
      diagnostics: {
        plantIdStatus,
        plantIdMs,
        aiMs,
        aiUsed,
        aiBoosted,
        aiAgreement,
        ambiguous,
        cached: false,
        totalMs: Date.now() - t0,
      },
    };

    cacheSet(cacheKey, result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', isMock: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
