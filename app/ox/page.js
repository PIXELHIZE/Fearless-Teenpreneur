'use client';

import { useCallback, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import ProgressHeader from '@/components/ProgressHeader';
import { oxQuestions } from '@/lib/content';
import { answerLabel, buildReview, calcFinalScore, countCorrect, recordAnswer } from '@/lib/quiz';

export default function OxQuizPage() {
  const questions = oxQuestions;
  const total = questions.length;

  const [index, setIndex] = useState(0);
  // 문제별 응답 기록: { [questionId]: { questionId, questionText, selectedAnswer, ... } }
  const [answers, setAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);

  const question = questions[index];
  const current = question ? answers[question.id] : null;
  const picked = current ? current.selectedAnswer : null;

  const correctCount = useMemo(() => countCorrect(answers), [answers]);
  // 최종 점수는 종료 시점에 정답 수 / 전체 문제 수로 한 번만 계산한다.
  const finalScore = useMemo(
    () => (showResult ? calcFinalScore(correctCount, total) : 0),
    [showResult, correctCount, total]
  );
  const review = useMemo(
    () => (showResult ? buildReview(questions, answers) : []),
    [showResult, questions, answers]
  );

  const pick = useCallback(
    (value) => {
      if (!question) return;
      // 이미 답한 문제는 기록을 덮어쓰지 않아 점수가 중복 반영되지 않는다.
      setAnswers((prev) => recordAnswer(prev, question, value));
    },
    [question]
  );

  const next = useCallback(() => {
    if (index + 1 >= total) {
      setShowResult(true);
      return;
    }
    setIndex((prev) => Math.min(prev + 1, total - 1));
  }, [index, total]);

  const restart = useCallback(() => {
    setIndex(0);
    setAnswers({});
    setShowResult(false);
  }, []);

  // 문제를 불러오지 못한 예외 상황: 0으로 나누지 않고 0점 처리
  if (total === 0) {
    return (
      <AppShell title="OX 퀴즈" back>
        <div className="summary">
          <div className="summary-score">0점</div>
          <p className="summary-sub">문제를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
        </div>
      </AppShell>
    );
  }

  if (showResult) {
    return (
      <AppShell
        title="OX 퀴즈 결과"
        back
        footer={
          <button type="button" className="btn" onClick={restart}>
            다시 풀기
          </button>
        }
      >
        <div className="summary" aria-live="polite">
          <div className="summary-score">{finalScore}점</div>
          <p className="summary-sub">
            100점 만점 · 맞힌 문제 {correctCount} / {total}
          </p>
        </div>

        <h2 className="section-title">문제별 결과</h2>
        <ul className="review-list">
          {review.map((row) => {
            const tone = !row.answered ? 'skip' : row.isCorrect ? 'ok' : 'ng';
            const mark = !row.answered ? '—' : row.isCorrect ? '✓' : '✕';
            const markText = !row.answered ? '미응답' : row.isCorrect ? '맞음' : '틀림';
            return (
              <li key={row.questionId} className={'review-item ' + tone}>
                <div className="review-head">
                  <span className="review-order">{row.order}번</span>
                  <span className={'review-mark ' + tone}>
                    <span aria-hidden="true">{mark}</span>
                    <span>{markText}</span>
                  </span>
                </div>
                <p className="review-question">{row.questionText}</p>
                <div className="review-answers">
                  <span>
                    내 답 <strong>{answerLabel(row.selectedAnswer)}</strong>
                  </span>
                  <span>
                    정답 <strong>{answerLabel(row.correctAnswer)}</strong>
                  </span>
                </div>
                {!row.isCorrect && row.explanation ? (
                  <p className="review-explain">{row.explanation}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </AppShell>
    );
  }

  const isCorrect = picked !== null && picked === question.answer;

  return (
    <AppShell
      title="OX 퀴즈"
      back
      right={<span className="lesson-count">{correctCount}개</span>}
      footer={
        <button type="button" className="btn" disabled={picked === null} onClick={next}>
          {index + 1 === total ? '결과 보기' : '다음 문항'}
        </button>
      }
    >
      <ProgressHeader current={index + 1} total={total} rightLabel={'정답 ' + correctCount} />

      <div className="quiz-card">{question.question}</div>

      <div className="ox-buttons">
        <button
          type="button"
          className={
            'ox-btn o' +
            (picked === true ? ' picked ' + (question.answer === true ? 'correct' : 'wrong') : '')
          }
          onClick={() => pick(true)}
          disabled={picked !== null}
          aria-label="맞다"
          aria-pressed={picked === true}
        >
          O
        </button>
        <button
          type="button"
          className={
            'ox-btn x' +
            (picked === false ? ' picked ' + (question.answer === false ? 'correct' : 'wrong') : '')
          }
          onClick={() => pick(false)}
          disabled={picked !== null}
          aria-label="틀리다"
          aria-pressed={picked === false}
        >
          X
        </button>
      </div>

      {picked !== null ? (
        <div className={'result-banner ox-feedback ' + (isCorrect ? 'ok' : 'ng')} role="status">
          <span className="label">
            <span aria-hidden="true">{isCorrect ? '✓ ' : '✕ '}</span>
            {isCorrect ? '정답입니다' : '오답입니다'}
          </span>
          {question.explain}
        </div>
      ) : null}
    </AppShell>
  );
}
