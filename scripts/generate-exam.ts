#!/usr/bin/env node
import { config } from "dotenv";
import { homedir } from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { generateExam, inferQuestionCount } from "../src/lib/exam/openai-pipeline";
import { writeExamJsonPair } from "../src/lib/exam/json-output";

config({ path: path.join(process.cwd(), ".env.local"), quiet: true });
config({ path: path.join(process.cwd(), ".env"), quiet: true });

const colors = {
  reset: "\u001b[0m",
  green: "\u001b[32m",
  cyan: "\u001b[36m",
  yellow: "\u001b[33m",
  red: "\u001b[31m",
  dim: "\u001b[2m",
};

function paint(color: keyof typeof colors, value: string) {
  return `${colors[color]}${value}${colors.reset}`;
}

function parseArgs(args: string[]) {
  let count: number | undefined;
  let model: string | undefined;
  let outputFile: string | undefined;
  const requestParts: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--count" || arg === "-n") {
      count = Number(args[index + 1]);
      index += 1;
    } else if (arg === "--model") {
      model = args[index + 1];
      index += 1;
    } else if (arg === "--output" || arg === "-o") {
      outputFile = args[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      return { help: true, request: "", count, model, outputFile };
    } else {
      requestParts.push(arg);
    }
  }

  if (count !== undefined && (!Number.isInteger(count) || count < 1 || count > 30)) {
    throw new Error("--count는 1부터 30 사이의 정수여야 합니다.");
  }

  return {
    help: false,
    request: requestParts.join(" ").trim(),
    count,
    model,
    outputFile,
  };
}

function printHelp() {
  console.log(`
${paint("green", "Study Exam Generator")}

사용법
  npm run exam
  npm run exam -- "고등학교 생명과학 세포 호흡 중상 난도 10문제"
  npm run exam -- "한국사 조선 후기" --count 15

옵션
  -n, --count <1-30>   문항 수 (자연어에 쓴 수보다 우선)
  --model <id>         사용할 OpenAI 모델
  -o, --output <path>  두 JSON 파일에 사용할 기본 경로
  -h, --help           도움말

기본 저장 위치
  ~/Desktop/<생성시각>-<주제>-questions.json
  ~/Desktop/<생성시각>-<주제>-explanations.json
`);
}

function slugify(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42)
    .toLocaleLowerCase() || "exam";
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export function defaultOutputRoot() {
  const configured = process.env.EXAM_OUTPUT_DIR?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(homedir(), "Desktop");
}

async function askForRequest() {
  const rl = createInterface({ input, output });
  try {
    console.log(paint("green", "\n어떤 내용을 공부하고 싶으신가요?"));
    console.log(
      paint(
        "dim",
        "예: 고등학교 생명과학의 세포 호흡을 수능형 중상 난도로 10문제 만들어줘",
      ),
    );
    return (await rl.question(paint("cyan", "\n> "))).trim();
  } finally {
    rl.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const request = args.request || (await askForRequest());
  if (!request) throw new Error("학습 주제를 입력해야 합니다.");

  const count = args.count ?? inferQuestionCount(request);
  const targetFile = path.resolve(
    args.outputFile ??
      path.join(defaultOutputRoot(), `${timestamp()}-${slugify(request)}`),
  );

  console.log(
    `\n${paint("green", "생성을 시작합니다.")} ${paint("dim", `목표 ${count}문항`)}`,
  );
  const exam = await generateExam({
    request,
    questionCount: count,
    model: args.model,
    onProgress: ({ message }) => {
      console.log(`${paint("cyan", "◆")} ${message}`);
    },
  });

  console.log(`${paint("cyan", "◆")} 문제 JSON과 해설 JSON을 각각 저장합니다.`);
  const files = await writeExamJsonPair(exam, targetFile);

  console.log(`\n${paint("green", "완료했습니다.")}`);
  console.log(`  문제 JSON  ${files.questionsJson}`);
  console.log(`  해설 JSON  ${files.explanationsJson}`);
  console.log(
    paint(
      "yellow",
      "\n주의: 생성형 AI의 검증은 오류 가능성을 줄이지만 완전한 무오류를 보장하지 않습니다. 고위험 시험에는 전문가 최종 검토를 권장합니다.",
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n${paint("red", "생성 실패:")} ${message}`);
  process.exitCode = 1;
});
