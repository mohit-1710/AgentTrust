"use client";

import { useEffect, useRef, useState } from "react";

import styles from "@/components/HeroSdkCommand.module.css";

export interface HeroSdkCommandProps {
  readonly command: string;
  readonly copiedLabel: string;
  readonly label: string;
}

export default function HeroSdkCommand({
  command,
  copiedLabel,
  label,
}: HeroSdkCommandProps) {
  const [hasCopied, setHasCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command);
      setHasCopied(true);

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setHasCopied(false);
        timeoutRef.current = null;
      }, 1600);
    } catch {
      setHasCopied(false);
    }
  }

  return (
    <button
      type="button"
      className={styles.command}
      aria-label={label}
      onClick={handleCopy}
    >
      <span className={styles.prompt}>$</span>
      <code className={styles.text}>{command}</code>
      <span className={styles.state} aria-live="polite">
        {hasCopied ? copiedLabel : "Copy"}
      </span>
    </button>
  );
}
