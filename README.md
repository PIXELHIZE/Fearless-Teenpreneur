# Study Exam Generator

공부할 내용을 자연어로 입력하면 그 조건에 맞춘 독창적인 수능형 개념 5지선다 문제를 AI가 만들고, 문제 JSON과 해설 JSON으로 분리 저장하는 Next.js 프로젝트입니다. 현재 입력 인터페이스는 터미널 CLI이며, 소개 화면은 Next.js App Router로 구성되어 있습니다.

## 핵심 동작

1. **맞춤 조건 분석** — 사용자의 문장에서 과목, 범위, 수준, 난이도, 문항 수와 강조점을 출제 조건으로 해석합니다.
2. **근거와 형식 조사** — OpenAI Responses API의 웹 검색으로 사실 검증용 1차 출처와 수능 문항의 추상적 설계 특징을 찾습니다.
3. **출처 감사** — 모델이 적은 URL이 실제 웹 검색 결과에 포함됐는지 코드로 교차 확인하고, 기관·도메인·출처 유형을 점수화합니다.
4. **AI 창작 출제** — 사용자 요청을 최우선 설계서로 삼고, 수능의 개념 관계·추론·적용 형식만 참고해 새로운 문항을 직접 만듭니다.
5. **독립 재검증** — 별도의 API 호출이 각 문항의 정답과 네 오답을 다시 웹 검색하고, 기존 문제 복제 의심 여부도 확인합니다.
6. **결정적 필터와 보충** — 선지 중복, 정답 범위, 최소 신뢰도, 근거 URL과 상충 출처를 검사하고 탈락분은 새 문항으로 보충합니다.

실제 시험 문제는 저작권을 존중해 복제하거나 살짝 바꾸지 않습니다. 공개 자료에서는 자료 제시 방식, 사고 수준, 발문과 오답 구성 같은 추상적 형식만 참고합니다. 웹 검색은 문제를 찾는 용도가 아니라 사실을 검증하는 용도입니다.

현재 출력 구조에는 이미지나 별도 보기 필드가 없으므로, 모든 문항은 발문과 다섯 선지만으로 완결되는 개념 문제로 제한합니다. `<보기>`, ㄱ·ㄴ·ㄷ 진술 묶음, 그림, 사진, 표, 그래프, 도표나 별도 실험 자료를 참조하는 문항은 검증 단계에서 자동으로 탈락합니다.

`화법과 언어`, `화법과 작문`, `언어와 매체`, `문학과 독서`처럼 여러 국어 영역을 함께 입력하면 영역을 분리해 균등 배분합니다. 예를 들어 10문항의 `화법과 언어` 요청은 화법 5문항과 언어 5문항으로 생성·검증되며, 한 영역이 부족하면 해당 영역 문항을 추가 생성합니다.

## 요구 환경

- Node.js 22 이상
- 웹 검색 도구를 사용할 수 있는 OpenAI API 프로젝트와 API 키
- macOS, Linux 또는 Windows

## 설치와 API 키 설정

```bash
npm install
cp .env.example .env.local
```

`.env.local`을 열어 본인의 키를 설정합니다.

```dotenv
OPENAI_API_KEY=sk-your-real-key
OPENAI_MODEL=gpt-5.6-sol
OPENAI_TIMEOUT_MS=180000
DEFAULT_QUESTION_COUNT=10
```

API 키는 소스 코드나 브라우저 번들에 넣지 않습니다. `.env.local`은 Git에서 제외되어 있습니다. API 요청은 `store: false`로 보내도록 구현했습니다.

## 터미널에서 사용

대화형 입력:

```bash
npm run exam
```

자연어를 바로 전달:

```bash
npm run exam -- "고등학교 생명과학 세포 호흡을 수능형 중상 난도로 10문제 만들어줘"
```

조사·출제·검증이 진행되는 동안 20초마다 경과 시간이 표시됩니다. 각 API 호출은 기본 3분 안에 응답이 없으면 중단하며 한 번 재시도합니다. 필요하면 `.env.local`의 `OPENAI_TIMEOUT_MS`를 30,000~600,000밀리초 범위에서 조정할 수 있습니다.

옵션 사용:

```bash
npm run exam -- "조선 후기 정치와 경제" --count 15 --output ~/Desktop/korean-history
```

| 옵션 | 설명 |
| --- | --- |
| `-n, --count <1-30>` | 문항 수. 자연어에 쓴 수보다 우선합니다. |
| `--model <id>` | `.env.local`의 모델을 이번 실행에서만 바꿉니다. |
| `-o, --output <path>` | 두 JSON 파일 이름에 공통으로 사용할 기본 경로입니다. `.json`은 생략할 수 있습니다. |
| `-h, --help` | CLI 도움말을 표시합니다. |

## 결과 파일

기본적으로 별도 결과 폴더를 만들지 않고 데스크톱에 다음 두 파일을 저장합니다. `--output` 옵션으로 공통 기본 경로를 바꾸거나 `.env.local`의 `EXAM_OUTPUT_DIR`로 기본 저장 디렉터리를 바꿀 수 있습니다.

- `<생성시각>-<주제>-questions.json` — AI가 새로 만든 발문, 5개 선지, 난이도와 간단한 출처
- `<생성시각>-<주제>-explanations.json` — 문항별 정답, 해설, 학습 목표와 검증 신뢰도

문제 파일에는 정답이나 해설이 들어가지 않습니다. PDF는 생성하지 않습니다.

## Next.js 소개 화면

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다. 현재 화면은 파이프라인과 CLI 사용법을 안내하며 API 키를 클라이언트로 전달하지 않습니다.

## 품질 검사

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

테스트는 문항 수 추론, 출처 점수화, 미검증 문항 탈락, 문제·해설 JSON 분리와 파싱을 확인합니다. API 키를 사용하는 라이브 테스트는 비용과 외부 상태 의존성 때문에 기본 테스트에 포함하지 않습니다.

## 주요 코드

- `scripts/generate-exam.ts` — 자연어 CLI와 결과 저장
- `src/lib/exam/openai-pipeline.ts` — 조사, 생성, 독립 검증, 재생성
- `src/lib/exam/source-audit.ts` — URL 정규화와 출처 품질 점수
- `src/lib/exam/json-output.ts` — 문제 JSON과 해설 JSON 분리 저장
- `src/lib/exam/schemas.ts` — Structured Outputs용 Zod 스키마

## 한계와 안전 장치

- 웹 검색과 다단계 검증은 오류 가능성을 낮추지만 완전한 무오류를 보장하지 않습니다.
- 법률, 의료, 안전, 자격시험 등 고위험 용도에는 해당 분야 전문가의 최종 검토가 필요합니다.
- 실제 시험 자료가 공개되어 있지 않으면 일반적인 5지선다 원칙을 사용하고 조사 공백을 기록합니다.
- 입력이 넓거나 모호하면 신뢰 가능한 출처가 부족해 생성이 중단될 수 있습니다. 이때 학년, 과목, 단원, 난이도, 문항 수를 더 구체적으로 입력하세요.

OpenAI 구현은 공식 [Responses API 문서](https://developers.openai.com/api/reference/resources/responses/methods/create)와 [GPT-5.6 Sol 모델 문서](https://developers.openai.com/api/docs/models/gpt-5.6-sol)를 기준으로 작성했습니다.
