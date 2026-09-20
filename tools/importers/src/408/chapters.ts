export const networkChapterMappings = [
  { number: 1, title: '计算机网络体系结构', chapter: 'network_architecture' },
  { number: 2, title: '物理层', chapter: 'physical_layer' },
  { number: 3, title: '数据链路层', chapter: 'data_link_layer' },
  { number: 4, title: '网络层', chapter: 'network_layer' },
  { number: 5, title: '传输层', chapter: 'transport_layer' },
  { number: 6, title: '应用层', chapter: 'application_layer' },
] as const;

export type NetworkChapter = (typeof networkChapterMappings)[number]['chapter'];

export function mapNetworkChapter(chapterNumber: number, chapterTitle: string) {
  const mapping = networkChapterMappings.find((item) => item.number === chapterNumber);
  if (!mapping) return undefined;
  const normalizedTitle = chapterTitle.trim();
  if (normalizedTitle && normalizedTitle !== mapping.title) return undefined;
  return mapping.chapter;
}
