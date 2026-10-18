import assets from "@/assets/emoji-map.json";
import { avatarEmoji } from "@/lib/game-types";

export function Emoji({
  value,
  className = "",
  size = 48,
}: {
  value: string;
  className?: string;
  size?: number;
}) {
  const url = (assets as Record<string, string>)[value];
  return url ? (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className={`emoji-art inline-block select-none ${className}`}
    />
  ) : (
    <span aria-hidden="true" className={className}>
      {value}
    </span>
  );
}

/** Colour accent per avatar — matches the retro toybox palette */
const AVATAR_ACCENT: Record<string, string> = {
  fox: "#f97316", // orange
  owl: "#8b5cf6", // violet
  cat: "#ec4899", // pink
  frog: "#22c55e", // green
  panda: "#94a3b8", // slate
  octopus: "#6366f1", // indigo
  penguin: "#3b82f6", // blue
  bee: "#eab308", // yellow
  shark: "#06b6d4", // cyan
  dragon: "#ef4444", // red
  raccoon: "#78716c", // stone
  unicorn: "#d946ef", // fuchsia
  robot: "#64748b", // steel
  ghost: "#a3e635", // lime
  alien: "#10b981", // emerald
  lion: "#f59e0b", // amber
  crown: "#f2b632", // gold
  skull: "#1e293b", // dark
  wizard: "#7c3aed", // purple
  rocket: "#e11d48", // rose-red
  pumpkin: "#ea580c", // orange-600
  unicorn2: "#d946ef", // fuchsia
};

export function PlayerAvatar({
  id,
  className = "",
  size = 44,
}: {
  id?: string | null | undefined;
  className?: string;
  size?: number;
}) {
  const stickerSrc = id ? `/stickers/avatar-${id}.svg` : null;
  const accent = (id && AVATAR_ACCENT[id]) ?? "#9c9cb0";

  return (
    <span
      className={`avatar-puck inline-flex items-center justify-center ${className}`}
      style={{
        backgroundColor: `${accent}22`,
        borderColor: `${accent}66`,
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.32),
        borderWidth: 2,
        borderStyle: "solid",
        padding: Math.round(size * 0.06),
      }}
    >
      {stickerSrc ? (
        <img
          src={stickerSrc}
          alt=""
          width={size - 8}
          height={size - 8}
          loading="lazy"
          className="select-none drop-shadow-sm"
          onError={(e) => {
            // Fallback to emoji art if the sticker SVG doesn't exist
            const target = e.currentTarget as HTMLImageElement;
            target.style.display = "none";
            const span = document.createElement("span");
            span.textContent = avatarEmoji(id);
            span.style.fontSize = `${size * 0.55}px`;
            span.style.lineHeight = "1";
            target.parentNode?.appendChild(span);
          }}
        />
      ) : (
        <Emoji value={avatarEmoji(id)} size={size - 8} />
      )}
    </span>
  );
}
