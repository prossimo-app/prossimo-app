"use client";

import type { HTMLMotionProps } from "motion/react";
import type { ComponentProps } from "react";
import { Accordion } from "@base-ui/react/accordion";
import { motion, useReducedMotion } from "motion/react";

const panelTransition = {
  type: "spring",
  stiffness: 420,
  damping: 36,
  mass: 0.8,
} as const;

interface LandingFaqItem {
  answer: string;
  question: string;
  value: string;
}

interface LandingFaqProps {
  items: LandingFaqItem[];
  subtitle: string;
  title: string;
}

export function LandingFaq({ title, subtitle, items }: LandingFaqProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section id="faq" className="mx-auto w-11/12 py-16 lg:w-2/3 lg:py-24">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-12">
        <div className="max-w-md space-y-3">
          <h2 className="font-serif text-xl lg:text-2xl">{title}</h2>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>

        <Accordion.Root className="border-border border-t">
          {items.map((item) => (
            <Accordion.Item
              key={item.value}
              value={item.value}
              className="border-border group border-b"
            >
              <Accordion.Header>
                <Accordion.Trigger
                  render={(props, state) => (
                    <motion.button
                      {...(props as HTMLMotionProps<"button">)}
                      type="button"
                      className="focus-visible:ring-ring flex w-full cursor-pointer items-center justify-between gap-4 py-5 text-left font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    >
                      <span>{item.question}</span>
                      <motion.span
                        aria-hidden="true"
                        className="text-muted-foreground flex h-4 w-4 shrink-0 items-center justify-center"
                        animate={{ rotate: state.open ? 45 : 0 }}
                        transition={
                          shouldReduceMotion ? { duration: 0 } : panelTransition
                        }
                      >
                        <PlusIcon className="h-4 w-4" />
                      </motion.span>
                    </motion.button>
                  )}
                />
              </Accordion.Header>
              <Accordion.Panel
                keepMounted
                render={(props, state) => {
                  const panelProps = { ...props };
                  delete panelProps.hidden;

                  return (
                    <motion.div
                      {...(panelProps as HTMLMotionProps<"div">)}
                      aria-hidden={!state.open}
                      initial={false}
                      animate={{
                        height: state.open ? "auto" : 0,
                        opacity: state.open ? 1 : 0,
                      }}
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : {
                              height: panelTransition,
                              opacity: { duration: state.open ? 0.18 : 0.12 },
                            }
                      }
                      className="overflow-hidden"
                    >
                      <div className="pb-5">
                        <p className="text-muted-foreground max-w-2xl text-sm leading-6">
                          {item.answer}
                        </p>
                      </div>
                    </motion.div>
                  );
                }}
              />
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </section>
  );
}

function PlusIcon(props: ComponentProps<"svg">) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}
