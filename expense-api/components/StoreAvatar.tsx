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
  const fontSize = Math.round(size * 0.38);

  if (logoUrl) {
    return (
      <div
        className="rounded-full overflow-hidden bg-fill flex-shrink-0"
        style={{ width: size, height: size }}
      >
        <Image
          src={logoUrl}
          alt={name ?? ""}
          width={size}
          height={size}
          className="w-full h-full object-cover"
          unoptimized
        />
      </div>
    );
  }

  return (
    <div
      className="rounded-full bg-fill text-[#48484A] flex items-center justify-center font-semibold flex-shrink-0"
      style={{ width: size, height: size, fontSize }}
    >
      {initial(name)}
    </div>
  );
}
