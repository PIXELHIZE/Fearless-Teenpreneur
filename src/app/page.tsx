const stages = [
  {
    number: "01",
    title: "자료 조사",
    body: "공식 자료와 공개된 실제 시험·예시 자료를 웹에서 찾아 출제 범위와 형식만 추출합니다.",
  },
  {
    number: "02",
    title: "문항 설계",
    body: "별도 보기나 그림 없이 풀 수 있는 독창적 개념 5지선다를 만들고 난이도를 배분합니다.",
  },
  {
    number: "03",
    title: "독립 검증",
    body: "별도 검증 단계가 정답과 오답을 다시 검색합니다. 근거가 약한 문항은 수정하거나 버립니다.",
  },
  {
    number: "04",
    title: "JSON 분리 저장",
    body: "문제와 간단한 출처는 문제 JSON에, 정답과 설명은 해설 JSON에 나누어 저장합니다.",
  },
];

export default function Home() {
  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Study Exam Generator 홈">
          <span className="brand-mark">S</span>
          <span>Study Exam Generator</span>
        </a>
        <div className="status">
          <span className="status-dot" />
          CLI first · Next.js 16
        </div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow">EVIDENCE-GROUNDED ASSESSMENT</div>
        <h1>
          공부할 내용을 말하면,
          <br />
          <span>검증된 시험지</span>로 바꿉니다.
        </h1>
        <p className="hero-copy">
          자연어 한 줄을 출제 조건으로 삼아 AI가 새로운 5지선다 문제를 직접
          만듭니다. 현재는 그림·표·별도 보기 없이 풀 수 있는 수능형 개념 문제만
          생성합니다.
        </p>

        <div className="terminal" aria-label="터미널 사용 예시">
          <div className="terminal-bar">
            <div className="lights" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <span>Terminal</span>
            <span className="terminal-state">ready</span>
          </div>
          <div className="terminal-body">
            <span className="prompt">$</span>
            <code>
              npm run exam -- &quot;고등학교 생명과학 세포 호흡을 수능형
              중상 난도로 10문제&quot;
            </code>
          </div>
          <div className="terminal-output">
            <span>◆</span> 입력 조건을 분석하고 수능형 개념 문항을 설계합니다.
            <br />
            <span>◆</span> AI가 새 문항을 만든 뒤 사실과 정답을 웹에서 검증합니다.
          </div>
        </div>
      </section>

      <section className="proof-strip" aria-label="핵심 기능">
        <div>
          <strong>5</strong>
          <span>모든 문항의 선택지</span>
        </div>
        <div>
          <strong>2×</strong>
          <span>조사와 검증의 분리</span>
        </div>
        <div>
          <strong>2</strong>
          <span>문제·해설 JSON 파일</span>
        </div>
      </section>

      <section className="process" id="process">
        <div className="section-heading">
          <div>
            <p>검증 파이프라인</p>
            <h2>그럴듯함보다 근거를 먼저 봅니다.</h2>
          </div>
          <p className="section-copy">
            모델의 자기평가만 믿지 않습니다. 웹 검색 결과의 URL과 모델이 제시한
            출처를 코드에서 다시 대조합니다.
          </p>
        </div>
        <div className="stage-grid">
          {stages.map((stage) => (
            <article className="stage-card" key={stage.number}>
              <span>{stage.number}</span>
              <h3>{stage.title}</h3>
              <p>{stage.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="outputs">
        <div className="output-copy">
          <p className="kicker">SEPARATED JSON OUTPUT</p>
          <h2>풀 문제와 볼 해설을 분리해서.</h2>
          <p>
            문제 JSON에는 발문, 5개 선지와 간단한 출처만 담습니다. 해설 JSON에는
            정답, 설명, 학습 목표와 검증 신뢰도를 문항 번호로 연결합니다.
          </p>
        </div>
        <div className="file-stack" aria-label="생성 파일 목록">
          <div>
            <span>JSON</span>
            <strong>날짜-주제-questions.json</strong>
            <small>맞춤형 문제 · 5개 선지 · 간단한 출처</small>
          </div>
          <div>
            <span>JSON</span>
            <strong>날짜-주제-explanations.json</strong>
            <small>정답 · 해설 · 학습 목표 · 신뢰도</small>
          </div>
        </div>
      </section>

      <footer>
        <span>Study Exam Generator</span>
        <span>Human review is still recommended for high-stakes use.</span>
      </footer>
    </main>
  );
}
