import assert from 'node:assert/strict';
import { test } from 'node:test';
import { searchPages } from './search.ts';

const pages = [
  { url: '/overview', title: 'Overview', description: 'Native NEAR spending', content: 'Exact service trust and stable payment IDs.' },
  { url: '/trust', title: 'Service trust', description: 'Owner-approved identity', content: 'Native NEAR identity, payout and endpoint hash.' },
  { url: '/pending', title: 'Pending payments', description: 'Keep the same operation ID', content: 'Pending is not refundable or safe to resend.' },
];

test('ranks title matches and retains Fumadocs page/snippet shape', () => {
  const result = searchPages(pages, 'service TRUST');
  assert.deepEqual(result[0], { id: '/trust', url: '/trust', type: 'page', content: 'Service trust' });
  assert.equal(result[1]?.type, 'text');
  assert.equal(result[1]?.url, '/trust');
  assert.deepEqual(result.filter((entry) => entry.type === 'page').map((entry) => entry.url), ['/trust', '/overview']);
});

test('requires every literal term and returns relevant native pending page', () => {
  const pending = searchPages(pages, 'pending refundable');
  assert.equal(pending[0]?.url, '/pending');
  assert.match(pending[1]!.content, /not refundable or safe to resend/);
  assert.deepEqual(searchPages(pages, 'pending nonexistent'), []);
  assert.deepEqual(searchPages(pages, '.*'), []);
});

test('empty and oversized queries are bounded; pages are not mutated', () => {
  const original = structuredClone(pages);
  assert.deepEqual(searchPages(pages, '  '), []);
  assert.deepEqual(searchPages(pages, 'x'.repeat(201)), []);
  assert.equal(searchPages(Array.from({ length: 30 }, (_, i) => ({ ...pages[0]!, url: `/${i}` })), 'NEAR').length, 24);
  assert.deepEqual(pages, original);
});
