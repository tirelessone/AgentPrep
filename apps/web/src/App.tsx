const principles = [
  ['离线可学', '学习记录将保存在当前设备，不把后端在线作为刷题前提。'],
  ['来源可查', '每道题都必须携带来源、版本、许可证、转换与审核记录。'],
  ['AI 有边界', 'Tutor 不能修改标准答案，也不能在提交选择前泄露答案。'],
] as const;

export function App() {
  return (
    <main>
      <header className="hero">
        <span className="eyebrow">PHASE 0 · FOUNDATION</span>
        <h1>
          学 Agent，
          <br />
          从可追溯开始。
        </h1>
        <p className="intro">
          AgentPrep 是面向 Agent / LLM 岗秋招的本地优先学习工具。当前工程骨架已就绪，题库和 AI
          功能将在后续阶段逐步开放。
        </p>
        <div className="status" role="status">
          <span aria-hidden="true" />
          本地模式已就绪
        </div>
      </header>

      <section aria-labelledby="principles-title">
        <div className="section-heading">
          <p>BUILD PRINCIPLES</p>
          <h2 id="principles-title">先守住边界，再扩展能力</h2>
        </div>
        <div className="cards">
          {principles.map(([title, description], index) => (
            <article key={title}>
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
