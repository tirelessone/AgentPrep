// @vitest-environment jsdom

import 'fake-indexeddb/auto';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { questionManifest } from './content';
import { db } from './db';

afterEach(async () => {
  cleanup();
  await db.attempts.clear();
  await db.favorites.clear();
  await db.reviews.clear();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('starts a local practice without revealing the answer before submission', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /开始刷题/ }));

    expect(screen.getByText(/受控执行器校验并执行工具调用/)).toBeInTheDocument();
    expect(screen.queryByText(/模型只能提出结构化工具调用/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'AI Tutor' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/受控执行器校验并执行工具调用/));
    fireEvent.click(screen.getByRole('button', { name: '提交答案' }));

    expect(await screen.findByText('回答正确')).toBeInTheDocument();
    expect(screen.getByText(/模型只能提出结构化工具调用/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'AI Tutor' })).toBeInTheDocument();
    await waitFor(() => expect(db.attempts.count()).resolves.toBe(1));
  });

  it('sends answers only after submission and cannot mutate the verified question', async () => {
    const firstQuestion = questionManifest.questions[0]!;
    if (firstQuestion.type !== 'single_choice')
      throw new Error('Expected the first demo to be single choice.');
    const verifiedAnswer = firstQuestion.correctChoiceId;
    let requestBody: unknown;
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(
        'event: token\ndata: {"text":"保持标准答案不变。"}\n\nevent: done\ndata: {}\n\n',
        { headers: { 'content-type': 'text/event-stream' } },
      );
    });
    vi.stubGlobal('fetch', fetcher);

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /开始刷题/ }));
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText(/受控执行器校验并执行工具调用/));
    fireEvent.click(screen.getByRole('button', { name: '提交答案' }));
    await screen.findByRole('heading', { name: 'AI Tutor' });
    fireEvent.click(screen.getByRole('button', { name: '询问 Tutor' }));

    expect(await screen.findByText('保持标准答案不变。')).toBeInTheDocument();
    expect(requestBody).toMatchObject({ context: { submitted: true, correctChoiceIds: ['b'] } });
    expect(firstQuestion.correctChoiceId).toBe(verifiedAnswer);
  });

  it('offers the browser install prompt when available', async () => {
    const prompt = vi.fn(async () => undefined);
    render(<App />);
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    });
    window.dispatchEvent(event);

    fireEvent.click(await screen.findByRole('button', { name: '安装应用' }));
    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
  });
});
