'use client';

import type { JSX } from 'react';
import styles from './AskAI.module.css';

export interface SuggestionChipProps {
  question: string;
  onSelect: (question: string) => void;
}

export function SuggestionChip({ question, onSelect }: SuggestionChipProps): JSX.Element {
  return (
    <button className={styles.suggestion} type="button" onClick={() => onSelect(question)}>
      {question}
    </button>
  );
}
