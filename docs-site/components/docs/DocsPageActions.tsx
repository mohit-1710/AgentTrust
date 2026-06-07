'use client';

import type { JSX, MouseEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { OPEN_ASSISTANT_EVENT } from '@/components/ask-ai/events';
import { AssistantSparkleIcon } from '@/components/ask-ai/AssistantSparkleIcon';
import styles from './DocsPageActions.module.css';

interface DocsPageActionsProps {
  markdownUrl: string;
}

const markdownCache = new Map<string, Promise<string>>();

function readMarkdown(markdownUrl: string): Promise<string> {
  const cached = markdownCache.get(markdownUrl);
  if (cached) return cached;

  const request = fetch(markdownUrl).then((response) => {
    if (!response.ok) {
      throw new Error('Unable to read this page as Markdown.');
    }

    return response.text();
  });

  markdownCache.set(markdownUrl, request);
  return request;
}

function CopyPageIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      viewBox="0 0 18 18"
      width="18"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M14.25 5.25H7.25C6.14543 5.25 5.25 6.14543 5.25 7.25V14.25C5.25 15.3546 6.14543 16.25 7.25 16.25H14.25C15.3546 16.25 16.25 15.3546 16.25 14.25V7.25C16.25 6.14543 15.3546 5.25 14.25 5.25Z" />
      <path d="M2.80103 11.998L1.77203 5.07397C1.61003 3.98097 2.36403 2.96397 3.45603 2.80197L10.38 1.77297C11.313 1.63397 12.19 2.16297 12.528 3.00097" />
    </svg>
  );
}

function MenuChevronIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="24"
      viewBox="0 -9 3 24"
      width="8"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0 0L3 3L0 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.5"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function DocsPageActions({ markdownUrl }: DocsPageActionsProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const copiedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    function handlePointerDown(event: PointerEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
    };
  }, []);

  async function handleCopyPage(): Promise<void> {
    if (isCopying) return;

    setIsCopying(true);
    try {
      const markdown = await readMarkdown(markdownUrl);
      await navigator.clipboard.writeText(markdown);
      setIsCopied(true);
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setIsCopied(false), 1400);
    } finally {
      setIsCopying(false);
    }
  }

  function handleAskAssistant(event: MouseEvent<HTMLButtonElement>): void {
    event.preventDefault();
    setIsOpen(false);
    window.dispatchEvent(new CustomEvent(OPEN_ASSISTANT_EVENT));
  }

  return (
    <div
      className={`${styles.actions} docs-page-actions`}
      id="page-context-menu"
      ref={rootRef}
    >
      <button
        aria-busy={isCopying}
        aria-label="Copy page"
        className={styles.copyButton}
        disabled={isCopying}
        onClick={() => void handleCopyPage()}
        type="button"
      >
        <CopyPageIcon className={styles.copyIcon} />
        <span className={styles.copyLabel}>Copy page</span>
      </button>
      <button
        aria-controls="agenttrust-page-actions-menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="More actions"
        className={styles.moreButton}
        onClick={() => setIsOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        <MenuChevronIcon className={styles.menuChevron} />
      </button>

      <div
        aria-orientation="vertical"
        className={styles.menu}
        data-align="end"
        data-side="bottom"
        data-state={isOpen ? 'open' : 'closed'}
        id="agenttrust-page-actions-menu"
        role="menu"
      >
        <button
          aria-busy={isCopying}
          className={styles.menuItem}
          data-copied={isCopied ? 'true' : 'false'}
          disabled={isCopying}
          onClick={() => void handleCopyPage()}
          role="menuitem"
          tabIndex={isOpen ? 0 : -1}
          type="button"
        >
          <span className={styles.iconBox}>
            <CopyPageIcon className={styles.itemIcon} />
          </span>
          <span className={styles.itemText}>
            <span className={styles.itemTitle}>Copy page</span>
            <span className={styles.itemDescription}>Copy page as Markdown for LLMs</span>
          </span>
          <CheckIcon className={styles.checkIcon} />
        </button>

        <button
          className={styles.menuItem}
          onClick={handleAskAssistant}
          role="menuitem"
          tabIndex={isOpen ? 0 : -1}
          type="button"
        >
          <span className={styles.iconBox}>
            <AssistantSparkleIcon className={styles.itemIcon} size={18} />
          </span>
          <span className={styles.itemText}>
            <span className={styles.itemTitle}>Ask AI assistant</span>
            <span className={styles.itemDescription}>Ask questions about this page</span>
          </span>
          <CheckIcon className={styles.checkIcon} />
        </button>
      </div>
    </div>
  );
}
