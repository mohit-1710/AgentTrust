import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { AgentTrustLogoMark } from '@/components/docs/AgentTrustLogoMark';
import { appName, gitConfig } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="agenttrust-brand">
          <AgentTrustLogoMark className="agenttrust-brand-mark" />
          <span>{appName}</span>
        </span>
      ),
      url: 'https://agenttrust.tech',
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
