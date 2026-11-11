'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import type { ChatStatus, UIMessage } from 'ai';
import { Copy, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Streamdown } from 'streamdown';
import styles from './AskAI.module.css';

export interface MessageListProps {
  isBusy: boolean;
  messages: UIMessage[];
  onRegenerate: (messageId: string) => void;
  status: ChatStatus;
}

function textFromMessage(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

function ThinkingDots(): JSX.Element {
  return (
    <div aria-label="Assistant is thinking" className={styles.thinking} role="status">
      <span className={styles.thinkingDot} />
      <span className={styles.thinkingDot} />
      <span className={styles.thinkingDot} />
    </div>
  );
}

export function MessageList({
  isBusy,
  messages,
  onRegenerate,
  status,
}: MessageListProps): JSX.Element {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, 'up' | 'down'>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const stickToBottomRef = useRef(true);

  const streamingText = messages.reduce((total, message) => total + textFromMessage(message).length, 0);

  useEffect(() => {
    const scroller = bottomRef.current?.closest('[data-chat-scroller="true"]') as HTMLElement | null;
    scrollerRef.current = scroller;
    if (!scroller) return undefined;

    function handleScroll(): void {
      if (!scroller) return;
      const distanceFromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
      stickToBottomRef.current = distanceFromBottom < 80;
    }

    scroller.addEventListener('scroll', handleScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    // Instant jump while streaming — smooth animations queue up per-token and stutter.
    scroller.scrollTop = scroller.scrollHeight;
  }, [streamingText, messages.length]);

  async function handleCopy(message: UIMessage): Promise<void> {
    const text = textFromMessage(message);
    if (!text) return;

    await navigator.clipboard.writeText(text);
    setCopiedMessageId(message.id);
    window.setTimeout(() => setCopiedMessageId(null), 1200);
  }

  const lastMessage = messages.at(-1);
  const showThinking =
    isBusy &&
    (status === 'submitted' ||
      !lastMessage ||
      lastMessage.role !== 'assistant' ||
      textFromMessage(lastMessage).length === 0);

  return (
    <div className={styles.messages} role="log" aria-live="polite">
      {messages.map((message) => {
        const text = textFromMessage(message);
        const isAssistant = message.role === 'assistant';
        if (isAssistant && text.length === 0) return null;

        return (
          <div className={styles.message} data-role={message.role} key={message.id}>
            <div className={styles.messageLabel}>
              {message.role === 'user' ? 'You' : 'AgentTrust'}
            </div>
            {isAssistant ? (
              <div className={styles.markdown}>
                <Streamdown>{text}</Streamdown>
              </div>
            ) : (
              <p>{text}</p>
            )}
            {isAssistant ? (
              <div className={styles.responseActions} aria-label="Assistant response actions" role="group">
                <button
                  aria-label="Vote that response was good"
                  aria-pressed={votes[message.id] === 'up'}
                  onClick={() => setVotes((current) => ({ ...current, [message.id]: 'up' }))}
                  type="button"
                >
                  <ThumbsUp aria-hidden="true" size={14} />
                </button>
                <button
                  aria-label="Vote that response was not good"
                  aria-pressed={votes[message.id] === 'down'}
                  onClick={() => setVotes((current) => ({ ...current, [message.id]: 'down' }))}
                  type="button"
                >
                  <ThumbsDown aria-hidden="true" size={14} />
                </button>
                <button
                  aria-label={copiedMessageId === message.id ? 'Copied response' : 'Copy chat response'}
                  onClick={() => void handleCopy(message)}
                  type="button"
                >
                  <Copy aria-hidden="true" size={14} />
                </button>
                <button
                  aria-label="Reload last chat"
                  disabled={isBusy}
                  onClick={() => onRegenerate(message.id)}
                  type="button"
                >
                  <RefreshCw aria-hidden="true" size={14} />
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
      {showThinking ? <ThinkingDots /> : null}
      <div aria-hidden="true" ref={bottomRef} />
    </div>
  );
}
