
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Create plants table
CREATE TABLE public.plants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  scientific_name TEXT,
  confidence NUMERIC,
  image_url TEXT,
  notes TEXT,
  sunlight TEXT DEFAULT 'medium',
  watering_frequency TEXT DEFAULT 'weekly',
  pot_size TEXT DEFAULT 'medium',
  location TEXT DEFAULT 'indoor',
  last_watered TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plants" ON public.plants FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own plants" ON public.plants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own plants" ON public.plants FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own plants" ON public.plants FOR DELETE USING (auth.uid() = user_id);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_plants_updated_at
BEFORE UPDATE ON public.plants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for plant images
INSERT INTO storage.buckets (id, name, public) VALUES ('plant-images', 'plant-images', true);

CREATE POLICY "Anyone can view plant images" ON storage.objects FOR SELECT USING (bucket_id = 'plant-images');
CREATE POLICY "Authenticated users can upload plant images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'plant-images' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete own plant images" ON storage.objects FOR DELETE USING (bucket_id = 'plant-images' AND auth.uid()::text = (storage.foldername(name))[1]);
