import { useState } from 'react';

import type { QuestionMedia as QuestionMediaItem } from '@agentprep/domain';

function QuestionImage({ item }: { item: QuestionMediaItem }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <p className="question-media-fallback" role="status">
        图片暂时无法加载：{item.alt}
      </p>
    );
  }

  return (
    <img
      className="question-media-image"
      src={item.src}
      alt={item.alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export function QuestionMedia({ media }: { media?: readonly QuestionMediaItem[] | undefined }) {
  if (!media?.length) return null;

  return (
    <div className="question-media" aria-label="题目图片">
      {media.map((item, index) => (
        <QuestionImage key={`${item.src}-${index}`} item={item} />
      ))}
    </div>
  );
}
