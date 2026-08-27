import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const profileAvatarKey = ["profile-avatar"] as const;

export type ProfileAvatar = {
  userId: string | null;
  path: string | null;
  url: string | null;
};

async function loadAvatar(): Promise<ProfileAvatar> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { userId: null, path: null, url: null };

  const { data } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const path = data?.avatar_url ?? null;
  if (!path) return { userId: user.id, path: null, url: null };

  // Remote URLs (e.g. Google profile pictures) are used as-is.
  if (/^https?:\/\//i.test(path)) return { userId: user.id, path, url: path };

  const signed = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
  return { userId: user.id, path, url: signed.data?.signedUrl ?? null };
}

export function useProfileAvatar() {
  return useQuery({
    queryKey: profileAvatarKey,
    queryFn: loadAvatar,
    staleTime: 5 * 60 * 1000,
  });
}

export function useInvalidateProfileAvatar() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: profileAvatarKey });
}

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export async function uploadProfileAvatar(file: File) {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("You need to be signed in.");
  if (!AVATAR_MIME_TYPES.includes(file.type)) {
    throw new Error("Please choose a PNG, JPG, WEBP or GIF image.");
  }
  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error("Images must be 2MB or smaller.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw new Error(uploadError.message);

  const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
  if (error) throw new Error(error.message);

  return path;
}

export async function removeProfileAvatar(currentPath: string | null) {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error("You need to be signed in.");

  if (currentPath && !/^https?:\/\//i.test(currentPath)) {
    await supabase.storage.from("avatars").remove([currentPath]);
  }
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  if (error) throw new Error(error.message);
}
