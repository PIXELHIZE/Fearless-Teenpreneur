import assert from 'node:assert/strict';
import test from 'node:test';
import {
  answerLabel,
  buildReview,
  calcFinalScore,
  countCorrect,
  recordAnswer,
} from '../lib/quiz.js';

test('점수는 문제 수와 무관하게 100점 만점으로 환산된다', () => {
  assert.equal(calcFinalScore(5, 5), 100);
  assert.equal(calcFinalScore(4, 5), 80);
  assert.equal(calcFinalScore(3, 5), 60);
  assert.equal(calcFinalScore(3, 4), 75);
  assert.equal(calcFinalScore(2, 3), 67);
  assert.equal(calcFinalScore(6, 7), 86);
});

test('전체 문제 수가 0이면 0점으로 처리한다', () => {
  assert.equal(calcFinalScore(0, 0), 0);
  assert.equal(calcFinalScore(3, 0), 0);
  assert.equal(calcFinalScore(0, 5), 0);
});

test('정답 수가 전체 문제 수를 넘지 않는다', () => {
  assert.equal(calcFinalScore(9, 5), 100);
});

const questions = [
  { id: 'q1', question: '문제 1', answer: true, explain: '해설 1' },
  { id: 'q2', question: '문제 2', answer: false, explain: '해설 2' },
  { id: 'q3', question: '문제 3', answer: true, explain: '해설 3' },
];

test('응답 기록은 요구 형태로 저장된다', () => {
  const answers = recordAnswer({}, questions[0], true);
  assert.deepEqual(answers.q1, {
    questionId: 'q1',
    questionText: '문제 1',
    selectedAnswer: true,
    correctAnswer: true,
    isCorrect: true,
    explanation: '해설 1',
  });
});

test('같은 문제를 다시 답해도 점수가 중복 반영되지 않는다', () => {
  let answers = recordAnswer({}, questions[0], true);
  answers = recordAnswer(answers, questions[0], false);
  answers = recordAnswer(answers, questions[0], true);
  assert.equal(Object.keys(answers).length, 1);
  assert.equal(answers.q1.selectedAnswer, true);
  assert.equal(countCorrect(answers), 1);
  assert.equal(calcFinalScore(countCorrect(answers), questions.length), 33);
});

test('미응답 문제는 review에서 미응답으로 표시된다', () => {
  let answers = recordAnswer({}, questions[0], true); // 정답
  answers = recordAnswer(answers, questions[1], true); // 오답
  const review = buildReview(questions, answers);

  assert.equal(review.length, 3);
  assert.equal(review[0].isCorrect, true);
  assert.equal(review[0].answered, true);
  assert.equal(review[1].isCorrect, false);
  assert.equal(review[1].explanation, '해설 2');
  assert.equal(review[2].answered, false);
  assert.equal(review[2].selectedAnswer, null);
  assert.equal(answerLabel(review[2].selectedAnswer), '미응답');
  assert.equal(answerLabel(true), 'O');
  assert.equal(answerLabel(false), 'X');
  assert.equal(calcFinalScore(countCorrect(answers), questions.length), 33);
});

test('다양한 문제 수에서 정답 수가 정확히 환산된다', () => {
  const sizes = [3, 4, 5, 7];
  sizes.forEach((size) => {
    const list = Array.from({ length: size }, (_, i) => ({
      id: 'n' + i,
      question: 'q' + i,
      answer: true,
      explain: '',
    }));
    let answers = {};
    // 마지막 한 문제만 틀린다
    list.forEach((q, i) => {
      answers = recordAnswer(answers, q, i !== size - 1);
    });
    const expected = Math.round(((size - 1) / size) * 100);
    assert.equal(calcFinalScore(countCorrect(answers), size), expected);
  });
});
