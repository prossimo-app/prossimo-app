"use client";

import type { HTMLMotionProps } from "motion/react";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Popover } from "@base-ui/react/popover";
import { motion } from "motion/react";

interface DownloadButtonProps {
  label: string;
}

const MotionPopoverButton = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<"button">
>(function MotionPopoverButton({ children, ...props }, ref) {
  const motionProps = props as HTMLMotionProps<"button">;

  return (
    <motion.button
      {...motionProps}
      ref={ref}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 32,
        mass: 0.8,
      }}
    >
      {children}
    </motion.button>
  );
});

export function DownloadButton({ label }: DownloadButtonProps) {
  const router = useRouter();

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={label}
        className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex h-9 cursor-pointer items-center justify-center rounded-2xl px-4 text-sm font-medium shadow-sm transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        render={(props) => (
          <MotionPopoverButton
            {...props}
            type="button"
            onClick={(event) => {
              if (isMobileUserAgent(navigator.userAgent)) {
                event.preventDefault();
                router.push("/download");
                return;
              }

              props.onClick?.(event);
            }}
          >
            {label}
          </MotionPopoverButton>
        )}
      />
      <Popover.Portal>
        <Popover.Positioner sideOffset={8}>
          <Popover.Popup className="border-border bg-background text-foreground z-50 rounded-xl border p-3 shadow-lg outline-none">
            <Popover.Arrow className="fill-background stroke-border h-2 w-4" />
            <Popover.Title className="sr-only">{label}</Popover.Title>
            <Image
              src="/landing/qr-code.svg"
              width={180}
              height={180}
              alt={label}
              draggable={false}
              className="block rounded-2xl"
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function isMobileUserAgent(userAgent: string) {
  return (
    /Android|iPhone|iPad|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && /Mobile/i.test(userAgent))
  );
}
