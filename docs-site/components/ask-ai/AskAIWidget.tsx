'use client';

import type { JSX } from 'react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AssistantSparkleIcon } from './AssistantSparkleIcon';
import { AskButton } from './AskButton';
import { OPEN_ASSISTANT_EVENT, type OpenAssistantEventDetail } from './events';
import styles from './AskAI.module.css';

const ChatPanel = dynamic(() => import('./ChatPanel'), { ssr: false });

export interface InitialQuestion {
  id: number;
  text: string;
}

export function AskAIWidget(): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [initialQuestion, setInitialQuestion] = useState<InitialQuestion | null>(null);
  const questionIdRef = useRef(0);

  useEffect(() => {
    if (isOpen) {
      document.documentElement.dataset.askAiOpen = 'true';
    } else {
      delete document.documentElement.dataset.askAiOpen;
    }

    return () => {
      delete document.documentElement.dataset.askAiOpen;
    };
  }, [isOpen]);

  useEffect(() => {
    function handleOpenAssistant(event: Event): void {
      const detail = (event as CustomEvent<OpenAssistantEventDetail>).detail;

      if (detail?.question) {
        questionIdRef.current += 1;
        setInitialQuestion({ id: questionIdRef.current, text: detail.question });
      }

      setIsOpen(true);
    }

    window.addEventListener(OPEN_ASSISTANT_EVENT, handleOpenAssistant);

    return () => {
      window.removeEventListener(OPEN_ASSISTANT_EVENT, handleOpenAssistant);
    };
  }, []);

  const handlePromptSubmit = useCallback((text: string): void => {
    questionIdRef.current += 1;
    setInitialQuestion({ id: questionIdRef.current, text });
    setIsOpen(true);
  }, []);

  const handleInitialQuestionHandled = useCallback((id: number): void => {
    setInitialQuestion((current) => (current?.id === id ? null : current));
  }, []);

  return (
    <>
      <button
        aria-pressed={isOpen}
        aria-label="Toggle assistant panel"
        className={styles.sidebarToggle}
        data-active={isOpen ? 'true' : 'false'}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <AssistantSparkleIcon className={styles.sparkleIcon} size={18} />
      </button>
      {!isOpen ? <AskButton onSubmit={handlePromptSubmit} /> : null}
      <ChatPanel
        initialQuestion={initialQuestion}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onInitialQuestionHandled={handleInitialQuestionHandled}
      />
    </>
  );
}
