import { supabase } from "@/integrations/supabase/client";

export async function identifyPlant(imageBase64: string, language: string = "en") {
  const { data, error } = await supabase.functions.invoke('identify-plant', {
    body: { image: imageBase64, language },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  return data;
}

export async function regenerateCareTips(plantName: string, language: string) {
  const { data, error } = await supabase.functions.invoke('regenerate-care-tips', {
    body: { plantName, language },
  });

  if (error) throw new Error(error.message);
  if (data.error) throw new Error(data.error);
  return data.careTips;
}

export async function uploadPlantImage(userId: string, file: Blob, fileName: string) {
  const path = `${userId}/${Date.now()}-${fileName}`;
  const { data, error } = await supabase.storage
    .from('plant-images')
    .upload(path, file, { contentType: 'image/jpeg' });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('plant-images')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

export function compressImage(file: File, maxSize = 1500, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width *= ratio;
        height *= ratio;
      }
      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
