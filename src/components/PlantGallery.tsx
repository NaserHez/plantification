import { useState, useRef, useCallback, useEffect } from "react";
import { Plus, Trash2, Loader2, ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { uploadPlantImage, compressImage } from "@/lib/supabase-helpers";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

interface PlantPhoto {
  id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
}

interface Props {
  plantId: string;
}

export default function PlantGallery({ plantId }: Props) {
  const { t } = useLanguage();
  const [photos, setPhotos] = useState<PlantPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchPhotos = async () => {
      const { data } = await supabase
        .from("plant_photos")
        .select("id, image_url, caption, created_at")
        .eq("plant_id", plantId)
        .order("created_at", { ascending: false });
      setPhotos(data || []);
    };
    fetchPhotos();
  }, [plantId]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const compressed = await compressImage(file);
      const resp = await fetch(compressed);
      const blob = await resp.blob();
      const fileName = `gallery-${Date.now()}.jpg`;
      const imageUrl = await uploadPlantImage(user.id, blob, fileName);

      const { data, error } = await supabase
        .from("plant_photos")
        .insert({ plant_id: plantId, user_id: user.id, image_url: imageUrl })
        .select()
        .single();

      if (error) throw error;
      setPhotos((prev) => [data, ...prev]);
      toast.success(t("photoAdded"));
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [plantId, t]);

  const handleDelete = async (photoId: string) => {
    const { error } = await supabase.from("plant_photos").delete().eq("id", photoId);
    if (error) {
      toast.error("Failed to delete");
    } else {
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      toast.success(t("photoDeleted"));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-primary" /> {t("photoGallery")}
        </label>
        <Button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          {t("addPhoto")}
        </Button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />

      {photos.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{t("noPhotos")}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group aspect-square rounded-xl overflow-hidden border border-border">
              <img
                src={photo.image_url}
                alt=""
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setViewingPhoto(photo.image_url)}
              />
              <button
                onClick={() => handleDelete(photo.id)}
                className="absolute top-1 right-1 p-1 rounded-full bg-foreground/60 text-background opacity-0 group-hover:opacity-100 transition-opacity"
                title={t("deletePhoto")}
              >
                <Trash2 className="w-3 h-3" />
              </button>
              <span className="absolute bottom-1 left-1 text-[9px] text-background/80 bg-foreground/40 px-1 rounded">
                {new Date(photo.created_at).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {viewingPhoto && (
        <div
          className="fixed inset-0 z-50 bg-foreground/80 flex items-center justify-center p-4"
          onClick={() => setViewingPhoto(null)}
        >
          <button className="absolute top-4 right-4 p-2 rounded-full bg-background/20 text-background">
            <X className="w-6 h-6" />
          </button>
          <img src={viewingPhoto} alt="" className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      )}
    </div>
  );
}
