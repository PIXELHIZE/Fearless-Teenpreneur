'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '@/components/AppShell';
import ProgressHeader from '@/components/ProgressHeader';
import { speakItems } from '@/lib/content';
import { similarityScore } from '@/lib/similarity';
import { STT_STATE, createSttController, sttErrorMessage } from '@/lib/speech';
import useTts from '@/hooks/useTts';
import { TTS_STATE } from '@/lib/tts';

const PASS_SCORE = 70;

export default function SpeakPage() {
  const total = speakItems.length;
  const [index, setIndex] = useState(0);
  const [heard, setHeard] = useState('');
  const [score, setScore] = useState(null);
  const [stt, setStt] = useState({ status: STT_STATE.IDLE, error: null });

  const controllerRef = useRef(null);
  const targetRef = useRef(speakItems[0]);
  const item = speakItems[index];
  targetRef.current = item;

  const tts = useTts({ lang: 'ko-KR', rate: 0.95 });

  useEffect(() => {
    const controller = createSttController({
      lang: 'ko-KR',
      onChange: (next) => setStt(next),
      onResult: (transcript) => {
        // 인식 결과는 최신 문항 기준으로 채점한다.
        setHeard(transcript);
        setScore(similarityScore(targetRef.current.text, transcript));
      },
    });
    controllerRef.current = controller;
    setStt(controller.getState());

    return () => {
      // 화면 이동 중 인식이 진행 중이면 안전하게 종료한다.
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  const listening =
    stt.status === STT_STATE.REQUESTING ||
    stt.status === STT_STATE.LISTENING ||
    stt.status === STT_STATE.PROCESSING;

  const available =
    stt.status !== STT_STATE.UNSUPPORTED && stt.status !== STT_STATE.INSECURE;

  const statusText = useMemo(() => {
    switch (stt.status) {
      case STT_STATE.UNSUPPORTED:
      case STT_STATE.INSECURE:
        return sttErrorMessage(stt.error);
      case STT_STATE.REQUESTING:
        return '마이크를 준비하고 있어요. 권한을 허용해 주세요.';
      case STT_STATE.LISTENING:
        return '듣고 있어요. 문장을 말해 주세요.';
      case STT_STATE.PROCESSING:
        return '인식한 내용을 확인하고 있어요.';
      case STT_STATE.DONE:
        return '결과를 확인하세요.';
      case STT_STATE.ERROR:
        return sttErrorMessage(stt.error);
      default:
        return '마이크를 눌러 따라 말해 보세요.';
    }
  }, [stt.status, stt.error]);

  const toggleRecord = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller || !controller.available) return;

    if (controller.isActive) {
      controller.stop();
      return;
    }

    // 새 시도 시작: 이전 결과를 비우고 TTS는 멈춘다.
    setHeard('');
    setScore(null);
    tts.stop();
    controller.start();
  }, [tts]);

  const retry = useCallback(() => {
    const controller = controllerRef.current;
    setHeard('');
    setScore(null);
    controller?.reset();
  }, []);

  const move = useCallback(
    (step) => {
      const nextIndex = index + step;
      if (nextIndex < 0 || nextIndex >= total) return;
      controllerRef.current?.stop();
      controllerRef.current?.reset();
      tts.stop();
      setIndex(nextIndex);
      setHeard('');
      setScore(null);
    },
    [index, total, tts]
  );

  const passed = score !== null && score >= PASS_SCORE;
  const ttsFailed = tts.status === TTS_STATE.ERROR;

  return (
    <AppShell
      title="따라말하기"
      back
      footer={
        <>
          <button
            type="button"
            className="btn ghost"
            onClick={() => move(-1)}
            disabled={index === 0}
          >
            이전
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => move(1)}
            disabled={index + 1 === total}
          >
            다음
          </button>
        </>
      }
    >
      <ProgressHeader
        current={index + 1}
        total={total}
        rightLabel={'통과 기준 ' + PASS_SCORE + '점'}
      />

      <div className="speak-target">
        <p className="sentence">{item.text}</p>
        <p className="meaning">{item.meaning}</p>
      </div>

      <div className="speak-actions">
        <button
          type="button"
          className={'mic-btn' + (listening ? ' recording' : '')}
          onClick={toggleRecord}
          disabled={!available}
          aria-pressed={listening}
          aria-label={listening ? '음성 인식 멈추기' : '음성 인식 시작'}
        >
          <span className="icon" aria-hidden="true">
            ●
          </span>
          {listening ? '멈추기' : '말하기'}
        </button>
      </div>

      <p className="speak-status" role="status" aria-live="polite">
        {statusText}
      </p>

      <div className="speak-tools">
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => tts.play(item.text)}
          disabled={!tts.supported || listening}
        >
          {tts.isSpeaking(item.text) ? '재생 중…' : '듣기'}
        </button>
        <button
          type="button"
          className="btn ghost sm"
          onClick={retry}
          disabled={listening || (!heard && stt.status !== STT_STATE.ERROR)}
        >
          다시 시도
        </button>
      </div>

      {ttsFailed ? (
        <p className="notice" role="status">
          {tts.message}
        </p>
      ) : null}

      {heard ? (
        <div className="card speak-heard">
          <p className="label">내가 말한 내용</p>
          <p className="value">{heard}</p>
          <div className={'result-banner ' + (passed ? 'ok' : 'ng')} style={{ marginTop: 12 }}>
            <span className="label">
              <span aria-hidden="true">{passed ? '✓ ' : '✕ '}</span>
              {passed ? '통과' : '다시 도전'}
            </span>
            <span className="score-row">
              <span className="num">{score}</span>
              <span>점 일치</span>
            </span>
          </div>
        </div>
      ) : null}

      {!available ? (
        <p className="notice">
          음성 인식은 Chrome, Edge 등 Web Speech API를 지원하는 브라우저의 HTTPS 또는 localhost
          환경에서 동작합니다. iOS Safari는 지원이 제한적이에요.
        </p>
      ) : null}
    </AppShell>
  );
}
