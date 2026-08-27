import { cn } from "@/lib/utils";
import { useProfileAvatar } from "@/hooks/use-profile-avatar";

export function ProfileAvatar({
  fallback,
  className,
  alt = "Your profile picture",
}: {
  fallback: string;
  className?: string;
  alt?: string;
}) {
  const { data } = useProfileAvatar();
  const url = data?.url ?? null;

  return (
    <div
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-xs font-semibold text-accent-foreground",
        className,
      )}
    >
      {url ? (
        <img src={url} alt={alt} className="h-full w-full object-cover" />
      ) : (
        (fallback || "?").slice(0, 1).toUpperCase()
      )}
    </div>
  );
}
