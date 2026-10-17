import assets from "@/assets/emoji-map.json";
import { avatarEmoji } from "@/lib/game-types";

export function Emoji({ value, className = "" }: { value: string; className?: string }) {
  const url = (assets as Record<string, string>)[value];
  return url ? (
    <img src={url} alt="" width={48} height={48} className={`emoji-art ${className}`} />
  ) : (
    <span aria-hidden="true" className={className}>
      {value}
    </span>
  );
}

export function PlayerAvatar({
  id,
  className = "",
}: {
  id?: string | null | undefined;
  className?: string;
}) {
  return (
    <span className={`avatar-puck ${className}`}>
      <Emoji value={avatarEmoji(id)} />
    </span>
  );
}
