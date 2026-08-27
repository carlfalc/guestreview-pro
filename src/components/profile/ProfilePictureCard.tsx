import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, Trash2 } from "lucide-react";
import {
  useProfileAvatar,
  useInvalidateProfileAvatar,
  uploadProfileAvatar,
  removeProfileAvatar,
} from "@/hooks/use-profile-avatar";

export function ProfilePictureCard({ fallback }: { fallback: string }) {
  const { data } = useProfileAvatar();
  const invalidate = useInvalidateProfileAvatar();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      await uploadProfileAvatar(file);
      await invalidate();
      toast.success("Profile picture updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onRemove() {
    setBusy(true);
    try {
      await removeProfileAvatar(data?.path ?? null);
      await invalidate();
      toast.success("Profile picture removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove picture");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="rounded-3xl border-border/70 shadow-[var(--shadow-card)]">
      <CardContent className="flex flex-wrap items-center gap-5 p-6">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-xl font-semibold text-accent-foreground">
          {data?.url ? (
            <img
              src={data.url}
              alt="Your profile picture"
              className="h-full w-full object-cover"
            />
          ) : (
            (fallback || "?").slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Profile picture</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a photo, logo or icon. PNG, JPG, WEBP or GIF, up to 2MB.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="rounded-full"
              size="sm"
            >
              <Upload className="mr-2 h-4 w-4" />
              {data?.url ? "Change picture" : "Upload picture"}
            </Button>
            {data?.url ? (
              <Button
                onClick={onRemove}
                disabled={busy}
                variant="ghost"
                size="sm"
                className="rounded-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove
              </Button>
            ) : null}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
      </CardContent>
    </Card>
  );
}
