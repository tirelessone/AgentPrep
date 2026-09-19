// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { QuestionPrompt } from '@agentprep/domain';

import { QuestionRenderer } from './QuestionRenderer';

const metadata = {
  id: 'demo-question',
  version: '2.0.0',
  subject: 'agent',
  chapter: 'Agent 基础',
  knowledgePoints: ['工具调用'],
  difficulty: 'foundation',
  importance: 3,
} as const;

afterEach(cleanup);

function renderQuestion(question: QuestionPrompt) {
  const onChange = vi.fn();
  render(<QuestionRenderer disabled={false} question={question} onChange={onChange} />);
  return onChange;
}

describe('QuestionRenderer', () => {
  it('renders a single choice question with radios', () => {
    const onChange = renderQuestion({
      ...metadata,
      type: 'single_choice',
      prompt: '单选题示例',
      choices: [
        { id: 'a', text: '选项 A' },
        { id: 'b', text: '选项 B' },
      ],
    });

    fireEvent.click(screen.getByLabelText('选项 B'));
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(onChange).toHaveBeenLastCalledWith({ type: 'single_choice', selectedChoiceId: 'b' });
  });

  it('renders multiple responsive prompt images with their alt text before choices', () => {
    renderQuestion({
      ...metadata,
      type: 'single_choice',
      prompt: '图片题示例',
      media: [
        {
          type: 'image',
          src: '/question-assets/synthetic/network-frames.svg',
          alt: '两个网络帧',
        },
        {
          type: 'image',
          src: '/question-assets/synthetic/network-queue.svg',
          alt: '分组等待队列',
        },
      ],
      choices: [
        { id: 'a', text: '选项 A' },
        { id: 'b', text: '选项 B' },
      ],
    });

    const firstImage = screen.getByRole('img', { name: '两个网络帧' });
    expect(screen.getByRole('img', { name: '分组等待队列' })).toBeInTheDocument();
    expect(firstImage.parentElement?.nextElementSibling).toHaveClass('choices');
  });

  it('keeps the session usable when an image fails to load', () => {
    const onChange = renderQuestion({
      ...metadata,
      type: 'single_choice',
      prompt: '损坏图片示例',
      media: [
        {
          type: 'image',
          src: '/question-assets/synthetic/missing.svg',
          alt: '无法加载的拓扑图',
        },
      ],
      choices: [
        { id: 'a', text: '仍可选择 A' },
        { id: 'b', text: '仍可选择 B' },
      ],
    });

    fireEvent.error(screen.getByRole('img', { name: '无法加载的拓扑图' }));
    expect(screen.getByRole('status')).toHaveTextContent('图片暂时无法加载');
    fireEvent.click(screen.getByLabelText('仍可选择 B'));
    expect(onChange).toHaveBeenLastCalledWith({ type: 'single_choice', selectedChoiceId: 'b' });
  });

  it('renders a multiple choice question with independently selectable checkboxes', () => {
    const onChange = renderQuestion({
      ...metadata,
      type: 'multiple_choice',
      prompt: '多选题示例',
      choices: [
        { id: 'a', text: '选项 A' },
        { id: 'b', text: '选项 B' },
        { id: 'c', text: '选项 C' },
      ],
    });

    fireEvent.click(screen.getByLabelText('选项 A'));
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(onChange).toHaveBeenLastCalledWith({
      type: 'multiple_choice',
      selectedChoiceIds: ['a'],
    });
  });

  it('renders true/false as a boolean response without choice data', () => {
    const onChange = renderQuestion({
      ...metadata,
      type: 'true_false',
      prompt: '判断题示例',
    });

    fireEvent.click(screen.getByLabelText('错误'));
    expect(onChange).toHaveBeenLastCalledWith({ type: 'true_false', answer: false });
  });

  it('renders an oral prompt without choices or a reference answer', () => {
    renderQuestion({
      ...metadata,
      type: 'oral',
      prompt: '请口述 Agent 执行循环。',
    });

    expect(screen.getByRole('heading', { name: '请口述 Agent 执行循环。' })).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText('参考答案')).not.toBeInTheDocument();
  });
});
