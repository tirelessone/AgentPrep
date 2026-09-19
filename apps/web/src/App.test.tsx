// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('describes the local-first foundation', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /学 Agent/ })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('本地模式已就绪');
    expect(screen.getByText('来源可查')).toBeInTheDocument();
  });
});
