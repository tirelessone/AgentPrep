import { describe, expect, it } from 'vitest';

import {
  getChapterLabel,
  getChapters,
  getDifficultyLabel,
  getSubjectLabel,
  isCanonicalChapter,
  subjectCatalog,
} from './index';

describe('canonical taxonomy', () => {
  it('maps every subject to its presentation label in stable order', () => {
    expect(subjectCatalog.map(({ id, label }) => [id, label])).toEqual([
      ['computer_network', '计算机网络'],
      ['operating_system', '操作系统'],
      ['data_structure', '数据结构'],
      ['mysql', 'MySQL'],
      ['sql', 'SQL'],
      ['machine_learning', '机器学习'],
      ['deep_learning', '深度学习'],
      ['llm', 'LLM'],
      ['agent', 'Agent / RAG'],
    ]);
  });

  it('maps chapters by subject even when chapter ids repeat', () => {
    expect(getChapterLabel('computer_network', 'transport_layer')).toBe('传输层');
    expect(getChapterLabel('mysql', 'optimization')).toBe('性能优化');
    expect(getChapterLabel('sql', 'optimization')).toBe('查询优化');
    expect(getChapters('agent')).toHaveLength(14);
    expect(isCanonicalChapter('llm', 'rag')).toBe(false);
  });

  it('provides centralized difficulty labels', () => {
    expect(getSubjectLabel('agent')).toBe('Agent / RAG');
    expect(getDifficultyLabel('foundation')).toBe('基础');
    expect(getDifficultyLabel('intermediate')).toBe('进阶');
    expect(getDifficultyLabel('advanced')).toBe('高级');
  });
});
