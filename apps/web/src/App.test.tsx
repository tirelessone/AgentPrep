// @vitest-environment jsdom

import 'fake-indexeddb/auto';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { App } from './App';
import { db } from './db';

afterEach(async () => {
  await db.attempts.clear();
  await db.favorites.clear();
  await db.reviews.clear();
});

describe('App', () => {
  it('starts a local practice without revealing the answer before submission', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /开始刷题/ }));

    expect(screen.getByText(/受控执行器校验并执行工具调用/)).toBeInTheDocument();
    expect(screen.queryByText(/模型只能提出结构化工具调用/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/受控执行器校验并执行工具调用/));
    fireEvent.click(screen.getByRole('button', { name: '提交答案' }));

    expect(await screen.findByText('回答正确')).toBeInTheDocument();
    expect(screen.getByText(/模型只能提出结构化工具调用/)).toBeInTheDocument();
    await waitFor(() => expect(db.attempts.count()).resolves.toBe(1));
  });
});
