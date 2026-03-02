
-- Create plant_photos table for photo gallery
CREATE TABLE public.plant_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plant_id UUID NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plant_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own plant photos"
ON public.plant_photos FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plant photos"
ON public.plant_photos FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own plant photos"
ON public.plant_photos FOR DELETE
USING (auth.uid() = user_id);
