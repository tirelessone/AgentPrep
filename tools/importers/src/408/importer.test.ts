import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { networkChapterMappings } from './chapters';
import { import408Network } from './importer';
import { stable408AssetName } from './media';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  );
});

async function workspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agentprep-408-'));
  temporaryDirectories.push(root);
  const sourceRoot = path.join(root, 'source');
  const assetOutput = path.join(root, 'assets');
  await mkdir(sourceRoot, { recursive: true });
  return { root, sourceRoot, assetOutput };
}

function question(overrides: Record<string, unknown> = {}) {
  return {
    id: 'network-1',
    book: '计算机网络',
    chapter: 1,
    chapter_title: '计算机网络体系结构',
    section: '1.1',
    section_title: 'Synthetic fixture',
    num: 1,
    type: 'single_choice',
    question: 'Which answer is correct?',
    options: { A: 'First', B: 'Second' },
    answer: ['B'],
    explanation: 'Second is correct.',
    source_file: 'fixtures/network.md',
    ...overrides,
  };
}

function inputText(questions: readonly unknown[]) {
  return JSON.stringify({
    version: 1,
    generated_at: '2026-07-04T05:22:33.089Z',
    total: questions.length,
    stats: {},
    questions,
  });
}

async function importFixture(
  questions: readonly unknown[],
  paths: Awaited<ReturnType<typeof workspace>>,
) {
  const input = inputText(questions);
  return import408Network({
    inputText: input,
    sourceRoot: paths.sourceRoot,
    assetOutput: paths.assetOutput,
    sourceVersion: 'fixture-commit',
    expectedInputSha256: createHash('sha256').update(input).digest('hex'),
  });
}

describe('408 computer network importer', () => {
  it('imports valid single choices across all six canonical chapters', async () => {
    const paths = await workspace();
    const questions = networkChapterMappings.map((mapping, index) =>
      question({
        id: `network-${mapping.number}`,
        chapter: mapping.number,
        chapter_title: mapping.title,
        num: index + 1,
      }),
    );

    const result = await importFixture(questions, paths);
    expect(result.manifest.questions.map((item) => item.chapter)).toEqual(
      networkChapterMappings.map((item) => item.chapter),
    );
    expect(result.report.chapterCounts.physical_layer).toBe(1);
    expect(result.manifest.questions[0]).toMatchObject({
      id: '408-network-1',
      correctChoiceId: 'b',
      difficulty: 'foundation',
      importance: 3,
    });
  });

  it('produces stable ids and ordering for repeated imports', async () => {
    const paths = await workspace();
    const first = await importFixture([question()], paths);
    const second = await importFixture([question()], paths);
    expect(second.manifest.questions.map((item) => item.id)).toEqual(
      first.manifest.questions.map((item) => item.id),
    );
    expect(second.manifest).toEqual(first.manifest);
  });

  it('reports invalid answers and invalid options instead of repairing them', async () => {
    const paths = await workspace();
    const result = await importFixture(
      [
        question({ id: 'valid-control' }),
        question({ id: 'bad-answer', answer: ['Z'] }),
        question({ id: 'bad-options', options: { A: '', B: 'Second' } }),
      ],
      paths,
    );
    expect(result.report).toMatchObject({
      imported: 1,
      skipped: 2,
      invalidAnswerCount: 1,
      invalidOptionsCount: 1,
    });
  });

  it('skips every multiple choice record as unsupported or unreliable', async () => {
    const paths = await workspace();
    const result = await importFixture(
      [
        question({ id: 'valid-control' }),
        question({ id: 'multiple', type: 'multiple_choice', answer: ['A', 'B'] }),
      ],
      paths,
    );
    expect(result.report.multipleChoiceSkipped).toBe(1);
    expect(result.report.imported).toBe(1);
    expect(result.report.skippedIds.find(({ id }) => id === 'multiple')?.reasons).toContain(
      'unsupported_or_unreliable_type',
    );
  });

  it('skips a question when required prompt media is missing', async () => {
    const paths = await workspace();
    const result = await importFixture(
      [
        question({ id: 'valid-control' }),
        question({ id: 'missing-image', question: 'Inspect ![](images/missing.svg) first.' }),
      ],
      paths,
    );
    expect(result.report).toMatchObject({ imported: 1, missingPromptImageCount: 1 });
  });

  it('uses a stable path-derived asset name and emits Question.media', async () => {
    const paths = await workspace();
    const sourcePath = 'images/diagram.svg';
    await mkdir(path.join(paths.sourceRoot, 'images'));
    await writeFile(path.join(paths.sourceRoot, sourcePath), '<svg />');

    const result = await importFixture(
      [question({ question: `Inspect ![frame diagram](${sourcePath}) before answering.` })],
      paths,
    );
    const assetName = stable408AssetName(sourcePath);
    expect(result.manifest.questions[0]?.media).toEqual([
      {
        type: 'image',
        src: `/question-assets/408/${assetName}`,
        alt: 'frame diagram',
      },
    ]);
    expect(await readFile(path.join(paths.assetOutput, assetName), 'utf8')).toBe('<svg />');
  });

  it('fails when a stable target already contains different bytes', async () => {
    const paths = await workspace();
    const sourcePath = 'images/diagram.svg';
    const assetName = stable408AssetName(sourcePath);
    await mkdir(path.join(paths.sourceRoot, 'images'));
    await mkdir(paths.assetOutput);
    await writeFile(path.join(paths.sourceRoot, sourcePath), '<svg>source</svg>');
    await writeFile(path.join(paths.assetOutput, assetName), '<svg>different</svg>');

    await expect(
      importFixture([question({ question: `Inspect ![](${sourcePath}) first.` })], paths),
    ).rejects.toThrow('Asset collision');
  });
});
