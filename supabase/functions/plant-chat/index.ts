import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const body = await req.json();
    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    const rawLang = typeof body.language === 'string' ? body.language : 'en';
    const language = /^[a-zA-Z]{2}(-[a-zA-Z]{2})?$/.test(rawLang) ? rawLang : 'en';
    const plantContext = typeof body.plantContext === 'string' ? body.plantContext.slice(0, 4000) : '';
    const weatherContext = typeof body.weatherContext === 'string' ? body.weatherContext.slice(0, 2000) : '';

    // Strip any user-injected system role; clamp content length and types
    const messages = rawMessages
      .filter((m: any) => m && typeof m === 'object' && typeof m.content === 'string')
      .map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content.slice(0, 4000),
      }))
      .slice(-30);

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: 'No messages provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Detect the language of the last user message to respond in the same language
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    const userText = lastUserMsg?.content || '';

    // Simple heuristic: if message contains Arabic characters, respond in Arabic
    // If it contains Portuguese-specific characters or the app language is pt, respond in Portuguese
    const hasArabic = /[\u0600-\u06FF]/.test(userText);
    const hasPortuguese = /[àáãâéêíóôõúçÀÁÃÂÉÊÍÓÔÕÚÇ]/.test(userText);
    
    let detectedLang = language || 'en';
    if (hasArabic) detectedLang = 'ar';
    else if (hasPortuguese) detectedLang = 'pt';

    const langInstructions: Record<string, string> = {
      en: 'Respond in English.',
      ar: 'Respond entirely in Arabic (العربية). Use right-to-left friendly formatting.',
      pt: 'Respond entirely in European Portuguese (Português de Portugal). Use "tu" form.',
    };
    const langNote = langInstructions[detectedLang] || langInstructions.en;

    const gardenContext = plantContext
      ? `\n\nThe user has these plants in their garden:\n${plantContext}\n\nUse this information to give personalized advice. Reference their specific plants by name when relevant.`
      : '';

    const weatherInfo = weatherContext
      ? `\n\nCurrent weather conditions:\n${weatherContext}\n\nUse this weather data to give relevant planting and care advice based on current conditions.`
      : '';

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: `You are a friendly, expert plant care assistant called "Plantification AI". You help users with:
- Plant identification and care questions
- Watering schedules and frequencies
- Sunlight requirements
- Soil and nutrient recommendations
- Pest and disease diagnosis and treatment
- Seasonal care tips
- Propagation advice
- Best planting times for different plants and regions
- Companion planting recommendations (which plants grow well together)
- Pesticide recommendations (organic and chemical options, application methods, safety precautions)
- Fertilizer recommendations (NPK ratios, organic vs synthetic, application frequency and timing)
- Weather-related planting advice (when to plant based on temperature, frost risk, rain, wind, humidity)

When asked about weather or planting conditions:
- Use the provided weather data to give specific, actionable advice
- Recommend whether it's a good day to plant, transplant, or water
- Warn about frost risk, heat stress, or excessive rain
- Suggest adjustments to care routines based on current conditions

When recommending pesticides or fertilizers:
- Always suggest organic/natural options first (neem oil, insecticidal soap, compost tea, fish emulsion, etc.)
- Include chemical options when appropriate with proper safety warnings
- Specify application rates and frequency
- Mention safety precautions (gloves, ventilation, pet/child safety)
- Consider the specific plant type when recommending products

CRITICAL: Always respond in the SAME LANGUAGE as the user's last message. If they write in Arabic, respond in Arabic. If they write in Portuguese, respond in Portuguese. If they write in English, respond in English.

Keep answers concise, practical, and actionable. Use emojis sparingly for warmth. If unsure, say so rather than guessing. Format responses with markdown for readability.

${langNote}${gardenContext}${weatherInfo}`
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again shortly.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI usage limit reached. Please add credits.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (e) {
    console.error('plant-chat error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
