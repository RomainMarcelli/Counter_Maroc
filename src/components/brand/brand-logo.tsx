import Image from "next/image";

export function BrandLogo({ size = 48, className = "", priority = false }: { size?: number; className?: string; priority?: boolean }) {
  return <Image src="/logo-mark.svg" width={size} height={size} alt="Logo Marrakech Crew" className={className} priority={priority} />;
}
