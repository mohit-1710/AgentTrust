'use client';

import type { FormEvent, JSX, KeyboardEvent } from 'react';
import { useRef, useState } from 'react';
import { Send } from 'lucide-react';
import styles from './AskAI.module.css';

export interface AskButtonProps {
  onSubmit: (question: string) => void;
}

export function AskButton({ onSubmit }: AskButtonProps): JSX.Element {
  const [input, setInput] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const trimmed = input.trim();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!trimmed) return;

    onSubmit(trimmed);
    setInput('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;

    event.preventDefault();
    formRef.current?.requestSubmit();
  }

  return (
    <form className={styles.prompt} data-filled={trimmed ? 'true' : 'false'} ref={formRef} onSubmit={handleSubmit}>
      <textarea
        aria-label="Ask a question..."
        maxLength={500}
        onChange={(event) => setInput(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask a question..."
        rows={1}
        value={input}
      />
      <kbd>⌘I</kbd>
      <button aria-label="Send message" disabled={!trimmed} type="submit">
        <Send aria-hidden="true" size={14} strokeWidth={2} />
      </button>
    </form>
  );
}
