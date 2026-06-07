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
        className="select-none dark:hidden"
        draggable={false}
      />
      <Image
        src="/icon/icon-dark.svg"
        alt={alt}
        width={15}
        height={15}
        className="hidden select-none dark:block"
        draggable={false}
      />
    </>
  );
}
