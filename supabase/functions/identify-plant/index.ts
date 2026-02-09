import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('PLANT_ID_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'PLANT_ID_API_KEY not configured', isMock: true }),
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

    // Strip data URI prefix if present
    const base64Image = image.includes(',') ? image.split(',')[1] : image;

    console.log('Calling Plant.id API...');
    console.log('Image base64 length:', base64Image.length);

    const response = await fetch('https://api.plant.id/v3/identification', {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        images: [base64Image],
        similar_images: true,
      }),
    });

    console.log('Plant.id response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Plant.id API error:', errorText);
      return new Response(
        JSON.stringify({ error: `Plant.id API error: ${response.status}`, details: errorText, isMock: false }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Plant.id response received, suggestions:', data.result?.classification?.suggestions?.length);

    const suggestion = data.result?.classification?.suggestions?.[0];

    if (!suggestion) {
      return new Response(
        JSON.stringify({ error: 'No plant identified', isMock: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = {
      name: suggestion.name,
      scientificName: suggestion.name,
      commonNames: data.result?.classification?.suggestions?.slice(0, 3).map((s: any) => s.name) || [],
      confidence: Math.round((suggestion.probability || 0) * 100),
      similarImages: suggestion.similar_images?.slice(0, 3).map((img: any) => img.url) || [],
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
