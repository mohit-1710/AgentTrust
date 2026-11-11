"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NAV_SCRAMBLE_CHARS,
  NAV_SCRAMBLE_DURATION_MS,
  NAV_SCRAMBLE_INTERVAL_MS,
} from "@/data/navigationEffects";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface UseScrambleTextResult {
  readonly activeIndexes: readonly number[];
  readonly displayCharacters: readonly string[];
  readonly startScramble: () => void;
}

function getMutableIndexes(characters: readonly string[]): number[] {
  return characters.flatMap((character, index) =>
    character.trim().length > 0 ? [index] : [],
  );
}

function getRandomScrambleCharacter(): string {
  const characterIndex = Math.floor(Math.random() * NAV_SCRAMBLE_CHARS.length);

  return NAV_SCRAMBLE_CHARS.charAt(characterIndex);
}

function shuffleIndexes(indexes: readonly number[]): number[] {
  const shuffled = [...indexes];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = shuffled[index];
    const swap = shuffled[swapIndex];

    if (current !== undefined && swap !== undefined) {
      shuffled[index] = swap;
      shuffled[swapIndex] = current;
    }
  }

  return shuffled;
}

export function useScrambleText(label: string): UseScrambleTextResult {
  const originalCharacters = useMemo(() => Array.from(label), [label]);
  const [displayCharacters, setDisplayCharacters] =
    useState<readonly string[]>(originalCharacters);
  const [activeIndexes, setActiveIndexes] = useState<readonly number[]>([]);
  const intervalByIndexRef = useRef<Map<number, number>>(new Map());
  const timeoutIdsRef = useRef<number[]>([]);
  const isReducedMotion = useReducedMotion();

  const clearScramble = useCallback(() => {
    intervalByIndexRef.current.forEach((intervalId) => {
      window.clearInterval(intervalId);
    });
    intervalByIndexRef.current.clear();

    timeoutIdsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    timeoutIdsRef.current = [];
  }, []);

  useEffect(() => clearScramble, [clearScramble]);

  const startScramble = useCallback(() => {
    if (isReducedMotion) {
      return;
    }

    const mutableIndexes = getMutableIndexes(originalCharacters);

    if (mutableIndexes.length === 0) {
      return;
    }

    clearScramble();
    setActiveIndexes(mutableIndexes);
    setDisplayCharacters(originalCharacters);

    mutableIndexes.forEach((characterIndex) => {
      const intervalId = window.setInterval(() => {
        setDisplayCharacters((currentCharacters) => {
          const nextCharacters = [...currentCharacters];
          nextCharacters[characterIndex] = getRandomScrambleCharacter();

          return nextCharacters;
        });
      }, NAV_SCRAMBLE_INTERVAL_MS);

      intervalByIndexRef.current.set(characterIndex, intervalId);
    });

    shuffleIndexes(mutableIndexes).forEach((characterIndex, revealIndex) => {
      const revealDelayMs =
        (NAV_SCRAMBLE_DURATION_MS / mutableIndexes.length) * revealIndex;
      const timeoutId = window.setTimeout(() => {
        const intervalId = intervalByIndexRef.current.get(characterIndex);

        if (intervalId !== undefined) {
          window.clearInterval(intervalId);
          intervalByIndexRef.current.delete(characterIndex);
        }

        setDisplayCharacters((currentCharacters) => {
          const nextCharacters = [...currentCharacters];
          const originalCharacter = originalCharacters[characterIndex];

          if (originalCharacter !== undefined) {
            nextCharacters[characterIndex] = originalCharacter;
          }

          return nextCharacters;
        });
        setActiveIndexes((currentIndexes) =>
          currentIndexes.filter((index) => index !== characterIndex),
        );
      }, revealDelayMs);

      timeoutIdsRef.current.push(timeoutId);
    });
  }, [clearScramble, isReducedMotion, originalCharacters]);

  return {
    activeIndexes,
    displayCharacters,
    startScramble,
  };
}
