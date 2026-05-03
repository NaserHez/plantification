import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Search, Leaf, ArrowLeft, Heart, MessageCircle, Send, Trash2, Loader2, Image as ImageIcon, X, Share2, MoreHorizontal, Flag, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";
import BottomNav from "@/components/BottomNav";
import ReportDialog from "@/components/ReportDialog";
import { compressImage, MAX_UPLOAD_BYTES } from "@/lib/image-compress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface PublicGarden {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  garden_bio: string | null;
  plant_count: number;
  preview_images: string[];
}

interface PostAuthor {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author?: PostAuthor;
}

interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  plant_id?: string | null;
  plant_name?: string | null;
  author?: PostAuthor;
  like_count: number;
  liked_by_me: boolean;
  comment_count: number;
}

function timeAgo(iso: string, t: (k: any) => string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("justNow");
  if (mins < 60) return `${mins}${t("minutesAgo")}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}${t("hoursAgo")}`;
  return `${Math.floor(hrs / 24)}${t("daysAgo")}`;
}

export default function CommunityPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"feed" | "gardens">("feed");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Gardens
  const [gardens, setGardens] = useState<PublicGarden[]>([]);
  const [gardensLoading, setGardensLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Feed
  const [posts, setPosts] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedSearch, setFeedSearch] = useState("");
  const [hiddenPostIds, setHiddenPostIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("hidden_post_ids");
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch { return new Set<string>(); }
  });
  const [reportTarget, setReportTarget] = useState<{ type: "post" | "comment"; postId: string; commentId?: string } | null>(null);
  const [newPost, setNewPost] = useState("");
  const [postImage, setPostImage] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const postRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);

  // Load public gardens
  useEffect(() => {
    async function load() {
      setGardensLoading(true);
      const { data: plants } = await supabase
        .from("plants")
        .select("user_id, name, image_url")
        .eq("is_public", true)
        .order("created_at", { ascending: false });

      if (!plants || plants.length === 0) {
        setGardens([]);
        setGardensLoading(false);
        return;
      }

      const userMap = new Map<string, { count: number; images: string[] }>();
      for (const p of plants) {
        const entry = userMap.get(p.user_id) || { count: 0, images: [] };
        entry.count++;
        if (p.image_url && entry.images.length < 4) entry.images.push(p.image_url);
        userMap.set(p.user_id, entry);
      }

      const userIds = [...userMap.keys()];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, garden_bio")
        .in("user_id", userIds);

      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
      const result: PublicGarden[] = userIds.map((uid) => {
        const profile = profileMap.get(uid);
        const info = userMap.get(uid)!;
        return {
          user_id: uid,
          display_name: profile?.display_name || null,
          avatar_url: profile?.avatar_url || null,
          garden_bio: profile?.garden_bio || null,
          plant_count: info.count,
          preview_images: info.images,
        };
      });
      setGardens(result.sort((a, b) => b.plant_count - a.plant_count));
      setGardensLoading(false);
    }
    load();
  }, []);

  // Load feed
  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    const { data: postRows } = await supabase
      .from("community_posts")
      .select("id, user_id, content, image_url, created_at, plant_id")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!postRows || postRows.length === 0) {
      setPosts([]);
      setFeedLoading(false);
      return;
    }

    const postIds = postRows.map((p) => p.id);
    const userIds = [...new Set(postRows.map((p) => p.user_id))];
    const plantIds = [...new Set(postRows.map((p) => p.plant_id).filter(Boolean) as string[])];

    const [{ data: profiles }, { data: likes }, { data: comments }, plantsRes] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds),
      supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds),
      supabase.from("post_comments").select("post_id").in("post_id", postIds),
      plantIds.length
        ? supabase.from("plants").select("id, name, nickname").in("id", plantIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
    const plantMap = new Map(((plantsRes as any).data || []).map((p: any) => [p.id, p.nickname || p.name]));
    const likeMap = new Map<string, { count: number; mine: boolean }>();
    (likes || []).forEach((l) => {
      const entry = likeMap.get(l.post_id) || { count: 0, mine: false };
      entry.count++;
      if (l.user_id === currentUserId) entry.mine = true;
      likeMap.set(l.post_id, entry);
    });
    const commentCount = new Map<string, number>();
    (comments || []).forEach((c) => commentCount.set(c.post_id, (commentCount.get(c.post_id) || 0) + 1));

    setPosts(
      postRows.map((p) => ({
        ...p,
        author: profileMap.get(p.user_id) as PostAuthor | undefined,
        plant_name: (p.plant_id ? plantMap.get(p.plant_id) : null) as string | null,
        like_count: likeMap.get(p.id)?.count || 0,
        liked_by_me: likeMap.get(p.id)?.mine || false,
        comment_count: commentCount.get(p.id) || 0,
      }))
    );
    setFeedLoading(false);
  }, [currentUserId]);

  // Scroll to deep-linked post
  useEffect(() => {
    if (feedLoading || posts.length === 0) return;
    const hash = window.location.hash;
    if (!hash.startsWith("#post-")) return;
    const id = hash.slice(6);
    const el = postRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary/50");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary/50"), 2400);
    }
  }, [feedLoading, posts]);

  useEffect(() => {
    if (currentUserId !== null) loadFeed();
  }, [loadFeed, currentUserId]);

  const handlePostImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPostImage(file);
    setPostImagePreview(URL.createObjectURL(file));
  };

  const handleCreatePost = async () => {
    if (!newPost.trim() && !postImage) return;
    if (!currentUserId) {
      toast.error("Please sign in");
      return;
    }
    setPosting(true);
    try {
      let image_url: string | null = null;
      if (postImage) {
        const path = `${currentUserId}/posts/${Date.now()}-${postImage.name}`;
        const { error: upErr } = await supabase.storage.from("plant-images").upload(path, postImage);
        if (upErr) throw upErr;
        const { data } = supabase.storage.from("plant-images").getPublicUrl(path);
        image_url = data.publicUrl;
      }
      const { error } = await supabase.from("community_posts").insert({
        user_id: currentUserId,
        content: newPost.trim(),
        image_url,
      });
      if (error) throw error;
      setNewPost("");
      setPostImage(null);
      setPostImagePreview(null);
      await loadFeed();
    } catch (err: any) {
      toast.error(err.message || "Failed to post");
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (post: Post) => {
    if (!currentUserId) return;
    // optimistic
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, liked_by_me: !p.liked_by_me, like_count: p.like_count + (p.liked_by_me ? -1 : 1) }
          : p
      )
    );
    if (post.liked_by_me) {
      await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", currentUserId);
    } else {
      await supabase.from("post_likes").insert({ post_id: post.id, user_id: currentUserId });
    }
  };

  const loadComments = async (postId: string) => {
    const { data } = await supabase
      .from("post_comments")
      .select("id, user_id, content, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    const userIds = [...new Set((data || []).map((c) => c.user_id))];
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds)
      : { data: [] as any[] };
    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: (data || []).map((c) => ({ ...c, author: profileMap.get(c.user_id) as PostAuthor | undefined })),
    }));
  };

  const toggleComments = async (postId: string) => {
    const isOpen = !openComments[postId];
    setOpenComments((prev) => ({ ...prev, [postId]: isOpen }));
    if (isOpen && !commentsByPost[postId]) await loadComments(postId);
  };

  const handleSendComment = async (postId: string) => {
    const text = (newComment[postId] || "").trim();
    if (!text || !currentUserId) return;
    const { error } = await supabase
      .from("post_comments")
      .insert({ post_id: postId, user_id: currentUserId, content: text });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewComment((prev) => ({ ...prev, [postId]: "" }));
    await loadComments(postId);
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comment_count: p.comment_count + 1 } : p))
    );
  };

  const handleDeletePost = async (postId: string) => {
    const { error } = await supabase.from("community_posts").delete().eq("id", postId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleSharePost = async (postId: string) => {
    const url = `${window.location.origin}/community#post-${postId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Plantification post", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success(t("postLinkCopied"));
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(url);
          toast.success(t("postLinkCopied"));
        } catch { /* ignore */ }
      }
    }
  };

  const handleHidePost = (postId: string) => {
    setHiddenPostIds((prev) => {
      const next = new Set(prev);
      next.add(postId);
      try { localStorage.setItem("hidden_post_ids", JSON.stringify([...next])); } catch {}
      return next;
    });
    toast.success(t("contentHidden"));
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    const { error } = await supabase.from("post_comments").delete().eq("id", commentId);
    if (error) { toast.error(error.message); return; }
    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: (prev[postId] || []).filter((c) => c.id !== commentId),
    }));
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, comment_count: Math.max(0, p.comment_count - 1) } : p))
    );
  };

  const filteredGardens = gardens.filter((g) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (g.display_name || "").toLowerCase().includes(q) || (g.garden_bio || "").toLowerCase().includes(q);
  });

  const visiblePosts = posts.filter((p) => !hiddenPostIds.has(p.id));
  const filteredPosts = (() => {
    const q = feedSearch.trim().toLowerCase();
    if (!q) return visiblePosts;
    return visiblePosts.filter((p) =>
      (p.content || "").toLowerCase().includes(q) ||
      (p.author?.display_name || "").toLowerCase().includes(q) ||
      (p.plant_name || "").toLowerCase().includes(q)
    );
  })();

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/20 to-primary/5 px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-full bg-card/60 backdrop-blur">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-serif font-bold text-foreground">{t("community")}</h1>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <div className="px-4 pt-3">
          <TabsList className="grid grid-cols-2 w-full rounded-xl">
            <TabsTrigger value="feed" className="rounded-lg">{t("feed")}</TabsTrigger>
            <TabsTrigger value="gardens" className="rounded-lg">{t("gardens")}</TabsTrigger>
          </TabsList>
        </div>

        {/* FEED TAB */}
        <TabsContent value="feed" className="px-4 pt-4 space-y-4 m-0">
          {/* Composer */}
          <div className="bg-card rounded-2xl border border-border/50 p-3 space-y-2">
            <Textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder={t("postPlaceholder")}
              rows={2}
              maxLength={500}
              className="rounded-xl resize-none border-0 bg-muted/40 focus-visible:ring-1"
            />
            {postImagePreview && (
              <div className="relative inline-block">
                <img src={postImagePreview} alt="" className="max-h-40 rounded-xl object-cover" />
                <button
                  onClick={() => { setPostImage(null); setPostImagePreview(null); }}
                  className="absolute top-1 right-1 bg-background/80 backdrop-blur p-1 rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <label className="cursor-pointer p-2 rounded-lg hover:bg-muted text-muted-foreground">
                <ImageIcon className="w-4 h-4" />
                <input type="file" accept="image/*" capture="environment" hidden onChange={handlePostImage} />
              </label>
              <Button
                size="sm"
                onClick={handleCreatePost}
                disabled={posting || (!newPost.trim() && !postImage)}
                className="rounded-xl gap-1.5"
              >
                {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {posting ? t("posting") : t("post")}
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("searchPosts")}
              value={feedSearch}
              onChange={(e) => setFeedSearch(e.target.value)}
              className="pl-9 bg-card/60 backdrop-blur border-border/50 rounded-xl h-9 text-sm"
            />
          </div>

          {/* Posts list */}
          {feedLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">{t("loading")}...</div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">
                {feedSearch ? t("noPostsMatch") : t("noPosts")}
              </p>
            </div>
          ) : (
            filteredPosts.map((p) => (
              <article
                key={p.id}
                ref={(el) => { postRefs.current[p.id] = el; }}
                id={`post-${p.id}`}
                className="bg-card rounded-2xl border border-border/50 p-4 space-y-3 transition-shadow"
              >
                <div className="flex items-center gap-2.5">
                  <button onClick={() => navigate(`/garden/${p.user_id}`)}>
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={p.author?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {(p.author?.display_name || "?")[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {p.author?.display_name || t("anonymousGardener")}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {timeAgo(p.created_at, t)}
                      {p.plant_name && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 text-primary">
                          · <Leaf className="w-2.5 h-2.5" /> {p.plant_name}
                        </span>
                      )}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                        aria-label="Post actions"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      <DropdownMenuItem onClick={() => handleSharePost(p.id)} className="gap-2 text-xs">
                        <Share2 className="w-3.5 h-3.5" /> {t("sharePost")}
                      </DropdownMenuItem>
                      {p.user_id !== currentUserId && (
                        <>
                          <DropdownMenuItem
                            onClick={() => setReportTarget({ type: "post", postId: p.id })}
                            className="gap-2 text-xs text-destructive focus:text-destructive"
                          >
                            <Flag className="w-3.5 h-3.5" /> {t("reportPost")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleHidePost(p.id)} className="gap-2 text-xs">
                            <EyeOff className="w-3.5 h-3.5" /> {t("hideContent")}
                          </DropdownMenuItem>
                        </>
                      )}
                      {p.user_id === currentUserId && (
                        <DropdownMenuItem
                          onClick={() => handleDeletePost(p.id)}
                          className="gap-2 text-xs text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> {t("deletePost")}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {p.content && <p className="text-sm text-foreground whitespace-pre-wrap">{p.content}</p>}
                {p.image_url && (
                  <div className="rounded-xl overflow-hidden bg-muted">
                    <img src={p.image_url} alt="" className="w-full max-h-96 object-cover" loading="lazy" />
                  </div>
                )}

                <div className="flex items-center gap-1 pt-1 border-t border-border/50">
                  <button
                    onClick={() => toggleLike(p)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      p.liked_by_me ? "text-bloom" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${p.liked_by_me ? "fill-bloom" : ""}`} />
                    {p.like_count}
                  </button>
                  <button
                    onClick={() => toggleComments(p.id)}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <MessageCircle className="w-4 h-4" />
                    {p.comment_count}
                  </button>
                  <button
                    onClick={() => handleSharePost(p.id)}
                    className="ml-auto flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground"
                    title={t("sharePost")}
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>

                {openComments[p.id] && (
                  <div className="pt-2 border-t border-border/50 space-y-2">
                    {(commentsByPost[p.id] || []).map((c) => (
                      <div key={c.id} className="flex items-start gap-2 group">
                        <Avatar className="w-7 h-7 shrink-0">
                          <AvatarImage src={c.author?.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                            {(c.author?.display_name || "?")[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 bg-muted/50 rounded-xl px-3 py-2 min-w-0">
                          <p className="text-[11px] font-semibold text-foreground">
                            {c.author?.display_name || t("anonymousGardener")}
                            <span className="ml-2 text-[10px] text-muted-foreground font-normal">
                              {timeAgo(c.created_at, t)}
                            </span>
                          </p>
                          <p className="text-xs text-foreground whitespace-pre-wrap">{c.content}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted opacity-60 group-hover:opacity-100 transition-opacity"
                              aria-label="Comment actions"
                            >
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            {c.user_id !== currentUserId ? (
                              <DropdownMenuItem
                                onClick={() => setReportTarget({ type: "comment", postId: p.id, commentId: c.id })}
                                className="gap-2 text-xs text-destructive focus:text-destructive"
                              >
                                <Flag className="w-3.5 h-3.5" /> {t("reportComment")}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleDeleteComment(p.id, c.id)}
                                className="gap-2 text-xs text-destructive focus:text-destructive"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> {t("deleteComment")}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 pt-1">
                      <Input
                        value={newComment[p.id] || ""}
                        onChange={(e) => setNewComment((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendComment(p.id);
                          }
                        }}
                        placeholder={t("addComment")}
                        className="rounded-xl h-9 text-xs"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleSendComment(p.id)}
                        disabled={!(newComment[p.id] || "").trim()}
                        className="rounded-xl h-9 w-9 shrink-0"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </article>
            ))
          )}
        </TabsContent>

        {/* GARDENS TAB */}
        <TabsContent value="gardens" className="px-4 pt-3 m-0">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("searchGardens")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card/60 backdrop-blur border-border/50 rounded-xl h-9 text-sm"
            />
          </div>
          <div className="space-y-3">
            {gardensLoading ? (
              <div className="text-center py-12 text-muted-foreground text-sm">{t("loading")}...</div>
            ) : filteredGardens.length === 0 ? (
              <div className="text-center py-12">
                <Leaf className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground text-sm">{t("noPublicGardens")}</p>
              </div>
            ) : (
              filteredGardens.map((g) => (
                <button
                  key={g.user_id}
                  onClick={() => navigate(`/garden/${g.user_id}`)}
                  className="w-full bg-card rounded-2xl border border-border/50 p-4 text-left hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={g.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                        {(g.display_name || "?")[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{g.display_name || t("anonymousGardener")}</p>
                      <p className="text-xs text-muted-foreground">{g.plant_count} {t("plantsShared")}</p>
                    </div>
                  </div>
                  {g.garden_bio && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{g.garden_bio}</p>
                  )}
                  {g.preview_images.length > 0 && (
                    <div className="flex gap-1.5 overflow-hidden rounded-xl">
                      {g.preview_images.map((img, i) => (
                        <div key={i} className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {reportTarget && (
        <ReportDialog
          open={!!reportTarget}
          onOpenChange={(open) => { if (!open) setReportTarget(null); }}
          targetType={reportTarget.type}
          postId={reportTarget.postId}
          commentId={reportTarget.commentId}
        />
      )}

      <BottomNav />
    </div>
  );
}
