import Image from "next/image";
import { initial } from "@/lib/format";

export default function StoreAvatar({
  name,
  logoUrl,
  size = 34,
}: {
  name: string | null | undefined;
  logoUrl?: string | null;
  size?: number;
}) {
  const radius = Math.round(size * 0.27);
  const fontSize = Math.round(size * 0.38);

  if (logoUrl) {
    // object-contain keeps wide wordmarks whole instead of cropping them to fill the tile.
    const pad = Math.max(2, Math.round(size * 0.09));
    return (
      <div
        className="bg-white border border-separator overflow-hidden flex items-center justify-center flex-shrink-0"
        style={{ width: size, height: size, borderRadius: radius, padding: pad }}
      >
        <Image
          src={logoUrl}
          alt={name ?? ""}
          width={size}
          height={size}
          className="w-full h-full object-contain"
          unoptimized
        />
      </div>
    );
  }

  return (
    <div
      className="bg-fill text-[#48484A] flex items-center justify-center font-semibold flex-shrink-0"
      style={{ width: size, height: size, fontSize, borderRadius: radius }}
    >
      {initial(name)}
    </div>
  );
}
