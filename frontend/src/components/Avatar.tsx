const AVATAR_HUES = [40, 145, 160, 205, 264, 270, 310, 25, 320, 180];

function avatarColor(username: string): string {
  let hash = 0;
  for (const c of username) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return `oklch(56% 0.2 ${AVATAR_HUES[hash % AVATAR_HUES.length]})`;
}

interface AvatarProps {
  username: string;
  avatarUrl?: string | null;
  className?: string;
  textClassName?: string;
}

export default function Avatar({
  username,
  avatarUrl,
  className = "w-[26px] h-[26px]",
  textClassName = "text-[12px]",
}: AvatarProps) {
  const initial = (username[0] ?? "?").toUpperCase();

  return (
    <div
      style={{ background: avatarUrl ? undefined : avatarColor(username) }}
      className={`${className} rounded-full shrink-0 flex items-center justify-center text-white font-bold overflow-hidden ${textClassName}`}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={username} className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </div>
  );
}
