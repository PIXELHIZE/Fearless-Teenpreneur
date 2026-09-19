// OX 퀴즈 점수 환산 및 응답 기록 (순수 로직)

/**
 * 최종 점수는 퀴즈 종료 시점에 정답 수 / 전체 문제 수로 한 번만 계산한다.
 * 전체 문제 수가 0이면 0으로 나누지 않고 0점으로 처리한다.
 */
export function calcFinalScore(correctCount, totalQuestionCount) {
  const total = Number(totalQuestionCount);
  const correct = Number(correctCount);
  if (!Number.isFinite(total) || total <= 0) return 0;
  if (!Number.isFinite(correct) || correct <= 0) return 0;
  const capped = Math.min(correct, total);
  return Math.round((capped / total) * 100);
}

/** 기록에서 정답 수를 센다. 기록이 문제당 1개이므로 중복 가산이 없다. */
export function countCorrect(answers) {
  if (!answers) return 0;
  const list = Array.isArray(answers) ? answers : Object.values(answers);
  return list.filter((item) => item && item.isCorrect === true).length;
}

/**
 * 응답 기록을 questionId 기준으로 저장한다.
 * 이미 답한 문제는 덮어쓰지 않으므로 같은 문제의 점수가 두 번 반영되지 않는다.
 */
export function recordAnswer(answers, question, selectedAnswer) {
  const current = answers || {};
  if (!question || !question.id) return current;
  if (current[question.id]) return current;

  const entry = {
    questionId: question.id,
    questionText: question.question,
    selectedAnswer,
    correctAnswer: question.answer,
    isCorrect: selectedAnswer === question.answer,
    explanation: question.explain || '',
  };

  return { ...current, [question.id]: entry };
}

/** 결과 화면용 목록. 답하지 않은 문제는 selectedAnswer=null(미응답)로 채운다. */
export function buildReview(questions, answers) {
  const list = Array.isArray(questions) ? questions : [];
  const record = answers || {};
  return list.map((question, i) => {
    const saved = record[question.id];
    if (saved) return { ...saved, order: i + 1, answered: true };
    return {
      questionId: question.id,
      questionText: question.question,
      selectedAnswer: null,
      correctAnswer: question.answer,
      isCorrect: false,
      explanation: question.explain || '',
      order: i + 1,
      answered: false,
    };
  });
}

export function answerLabel(value) {
  if (value === true) return 'O';
  if (value === false) return 'X';
  return '미응답';
}
