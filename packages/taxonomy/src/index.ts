import { z } from 'zod';

export const subjectSchema = z.enum([
  'computer_network',
  'operating_system',
  'data_structure',
  'mysql',
  'sql',
  'machine_learning',
  'deep_learning',
  'llm',
  'agent',
]);

export const difficultySchema = z.enum(['foundation', 'intermediate', 'advanced']);
export const importanceSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export type Subject = z.infer<typeof subjectSchema>;
export type Difficulty = z.infer<typeof difficultySchema>;
export type Importance = z.infer<typeof importanceSchema>;

export interface SubjectDefinition {
  id: Subject;
  label: string;
  order: number;
}

export interface ChapterDefinition {
  id: string;
  subject: Subject;
  label: string;
  order: number;
}

export const subjectCatalog = [
  { id: 'computer_network', label: '计算机网络', order: 10 },
  { id: 'operating_system', label: '操作系统', order: 20 },
  { id: 'data_structure', label: '数据结构', order: 30 },
  { id: 'mysql', label: 'MySQL', order: 40 },
  { id: 'sql', label: 'SQL', order: 50 },
  { id: 'machine_learning', label: '机器学习', order: 60 },
  { id: 'deep_learning', label: '深度学习', order: 70 },
  { id: 'llm', label: 'LLM', order: 80 },
  { id: 'agent', label: 'Agent / RAG', order: 90 },
] as const satisfies readonly SubjectDefinition[];

export const chapterCatalog = [
  { id: 'network_architecture', subject: 'computer_network', label: '网络体系结构', order: 10 },
  { id: 'application_layer', subject: 'computer_network', label: '应用层', order: 20 },
  { id: 'transport_layer', subject: 'computer_network', label: '传输层', order: 30 },
  { id: 'network_layer', subject: 'computer_network', label: '网络层', order: 40 },
  { id: 'data_link_layer', subject: 'computer_network', label: '数据链路层', order: 50 },

  { id: 'os_basics', subject: 'operating_system', label: '操作系统基础', order: 10 },
  { id: 'process_thread', subject: 'operating_system', label: '进程与线程', order: 20 },
  { id: 'scheduling', subject: 'operating_system', label: '调度', order: 30 },
  { id: 'synchronization', subject: 'operating_system', label: '同步与互斥', order: 40 },
  { id: 'deadlock', subject: 'operating_system', label: '死锁', order: 50 },
  { id: 'memory_management', subject: 'operating_system', label: '内存管理', order: 60 },
  { id: 'file_system', subject: 'operating_system', label: '文件系统', order: 70 },
  { id: 'io', subject: 'operating_system', label: '输入输出', order: 80 },

  { id: 'linear_structure', subject: 'data_structure', label: '线性结构', order: 10 },
  { id: 'tree', subject: 'data_structure', label: '树', order: 20 },
  { id: 'graph', subject: 'data_structure', label: '图', order: 30 },
  { id: 'search', subject: 'data_structure', label: '查找', order: 40 },
  { id: 'sort', subject: 'data_structure', label: '排序', order: 50 },
  { id: 'hash', subject: 'data_structure', label: '哈希', order: 60 },

  { id: 'architecture', subject: 'mysql', label: '体系结构', order: 10 },
  { id: 'index', subject: 'mysql', label: '索引', order: 20 },
  { id: 'transaction', subject: 'mysql', label: '事务', order: 30 },
  { id: 'mvcc', subject: 'mysql', label: 'MVCC', order: 40 },
  { id: 'lock', subject: 'mysql', label: '锁', order: 50 },
  { id: 'log', subject: 'mysql', label: '日志', order: 60 },
  { id: 'optimization', subject: 'mysql', label: '性能优化', order: 70 },

  { id: 'query', subject: 'sql', label: '基础查询', order: 10 },
  { id: 'join', subject: 'sql', label: '连接查询', order: 20 },
  { id: 'aggregation', subject: 'sql', label: '聚合', order: 30 },
  { id: 'subquery', subject: 'sql', label: '子查询', order: 40 },
  { id: 'window_function', subject: 'sql', label: '窗口函数', order: 50 },
  { id: 'optimization', subject: 'sql', label: '查询优化', order: 60 },

  { id: 'ml_basics', subject: 'machine_learning', label: '机器学习基础', order: 10 },
  { id: 'supervised_learning', subject: 'machine_learning', label: '监督学习', order: 20 },
  { id: 'unsupervised_learning', subject: 'machine_learning', label: '无监督学习', order: 30 },
  { id: 'evaluation', subject: 'machine_learning', label: '模型评估', order: 40 },
  { id: 'optimization', subject: 'machine_learning', label: '优化方法', order: 50 },

  { id: 'neural_network', subject: 'deep_learning', label: '神经网络', order: 10 },
  { id: 'cnn', subject: 'deep_learning', label: 'CNN', order: 20 },
  { id: 'rnn', subject: 'deep_learning', label: 'RNN', order: 30 },
  { id: 'optimization', subject: 'deep_learning', label: '深度学习优化', order: 40 },
  { id: 'normalization', subject: 'deep_learning', label: '归一化', order: 50 },

  { id: 'transformer', subject: 'llm', label: 'Transformer', order: 10 },
  { id: 'attention', subject: 'llm', label: '注意力机制', order: 20 },
  { id: 'tokenizer', subject: 'llm', label: '分词器', order: 30 },
  { id: 'positional_encoding', subject: 'llm', label: '位置编码', order: 40 },
  { id: 'rope', subject: 'llm', label: 'RoPE', order: 50 },
  { id: 'kv_cache', subject: 'llm', label: 'KV Cache', order: 60 },
  { id: 'moe', subject: 'llm', label: 'MoE', order: 70 },
  { id: 'training', subject: 'llm', label: '训练', order: 80 },
  { id: 'alignment', subject: 'llm', label: '对齐', order: 90 },
  { id: 'peft', subject: 'llm', label: '参数高效微调', order: 100 },
  { id: 'quantization', subject: 'llm', label: '量化', order: 110 },
  { id: 'inference', subject: 'llm', label: '推理', order: 120 },

  { id: 'prompting', subject: 'agent', label: '提示工程', order: 10 },
  { id: 'structured_output', subject: 'agent', label: '结构化输出', order: 20 },
  { id: 'tool_calling', subject: 'agent', label: '工具调用', order: 30 },
  { id: 'rag', subject: 'agent', label: 'RAG', order: 40 },
  { id: 'planning', subject: 'agent', label: '规划', order: 50 },
  { id: 'react', subject: 'agent', label: 'ReAct', order: 60 },
  { id: 'reflection', subject: 'agent', label: '反思', order: 70 },
  { id: 'memory', subject: 'agent', label: '记忆', order: 80 },
  { id: 'context_engineering', subject: 'agent', label: '上下文工程', order: 90 },
  { id: 'mcp', subject: 'agent', label: 'MCP', order: 100 },
  { id: 'multi_agent', subject: 'agent', label: '多智能体', order: 110 },
  { id: 'guardrail', subject: 'agent', label: '安全护栏', order: 120 },
  { id: 'evaluation', subject: 'agent', label: 'Agent 评估', order: 130 },
  { id: 'runtime', subject: 'agent', label: '运行时', order: 140 },
] as const satisfies readonly ChapterDefinition[];

const difficultyLabels = {
  foundation: '基础',
  intermediate: '进阶',
  advanced: '高级',
} as const satisfies Record<Difficulty, string>;

export function getSubjectDefinition(subject: Subject) {
  return subjectCatalog.find((item) => item.id === subject)!;
}

export function getSubjectLabel(subject: Subject) {
  return getSubjectDefinition(subject).label;
}

export function getChapters(subject: Subject) {
  return chapterCatalog.filter((item) => item.subject === subject);
}

export function getChapterDefinition(subject: Subject, chapter: string) {
  return chapterCatalog.find((item) => item.subject === subject && item.id === chapter);
}

export function getChapterLabel(subject: Subject, chapter: string) {
  return getChapterDefinition(subject, chapter)?.label ?? '未知章节';
}

export function isCanonicalChapter(subject: Subject, chapter: string) {
  return getChapterDefinition(subject, chapter) !== undefined;
}

export function getDifficultyLabel(difficulty: Difficulty) {
  return difficultyLabels[difficulty];
}
