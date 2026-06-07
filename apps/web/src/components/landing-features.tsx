"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";

interface LandingFeature {
  body: string;
  imageAlt: string;
  imageHeight: number;
  imageSrc: string;
  imageWidth: number;
  size: "large" | "medium" | "small";
  title: string;
  tone: "blue" | "green" | "rose" | "yellow";
}

const featureTones: Record<LandingFeature["tone"], string> = {
  blue: "from-primary/12 via-primary/5 to-background",
  green: "from-emerald-500/12 via-emerald-500/5 to-background",
  rose: "from-rose-500/12 via-rose-500/5 to-background",
  yellow: "from-amber-500/16 via-amber-500/5 to-background",
};

const featureSizes: Record<LandingFeature["size"], string> = {
  large: "lg:col-span-2 lg:row-span-2 lg:min-h-[520px]",
  medium: "lg:col-span-2",
  small: "",
};

interface LandingFeaturesProps {
  features: LandingFeature[];
  subtitle: string;
  title: string;
}

export function LandingFeatures({
  title,
  subtitle,
  features,
}: LandingFeaturesProps) {
  return (
    <section id="features" className="mx-auto w-11/12 py-16 lg:w-2/3 lg:py-24">
      <div className="mb-8 max-w-xl space-y-3">
        <h2 className="font-serif text-xl lg:text-2xl">{title}</h2>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>

      <div className="grid auto-rows-[minmax(260px,auto)] gap-3 lg:grid-cols-4">
        {features.map((feature) => (
          <article
            key={feature.title}
            className={`border-border bg-background flex min-h-64 flex-col justify-between overflow-hidden rounded-2xl border shadow-sm ${featureSizes[feature.size]}`}
          >
            <div
              className={`relative flex-1 overflow-hidden bg-linear-to-br ${featureTones[feature.tone]}`}
            >
              <FeatureImage feature={feature} />
            </div>

            <div className="space-y-2 p-5">
              <h3 className="font-medium">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-6">
                {feature.body}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FeatureImage({ feature }: { feature: LandingFeature }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className="absolute inset-x-0 bottom-0"
      initial={{
        opacity: 0,
        y: shouldReduceMotion ? 0 : 24,
        scale: shouldReduceMotion ? 1 : 0.98,
      }}
      animate={{
        opacity: isLoaded ? 1 : 0,
        y: isLoaded || shouldReduceMotion ? 0 : 24,
        scale: isLoaded || shouldReduceMotion ? 1 : 0.98,
      }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <Image
        src={feature.imageSrc}
        width={feature.imageWidth}
        height={feature.imageHeight}
        quality={100}
        alt={feature.imageAlt}
        draggable={false}
        onLoad={() => setIsLoaded(true)}
        className="h-auto w-full drop-shadow-2xl select-none"
      />
    </motion.div>
  );
}
