import Image from "next/image";

type BrandIconProps = {
  alt: string;
};

export function BrandIcon({ alt }: BrandIconProps) {
  return (
    <>
      <Image
        src="/icon/icon.svg"
        alt={alt}
        width={15}
        height={15}
        className="dark:hidden"
      />
      <Image
        src="/icon/icon-dark.svg"
        alt={alt}
        width={15}
        height={15}
        className="hidden dark:block"
      />
    </>
  );
}
