'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AppShell from '@/components/AppShell';
import ProgressHeader from '@/components/ProgressHeader';
import { flipCards } from '@/lib/content';
import { beginMove, commitMove, createFlipState, finishMove, toggleFlip } from '@/lib/flip';
import useTts from '@/hooks/useTts';
import { TTS_STATE } from '@/lib/tts';

export default function FlipPage() {
  const total = flipCards.length;
  const [flipState, setFlipState] = useState(() => createFlipState(0));
  const { index, flipped, animate, locked } = flipState;

  const rafRef = useRef([]);
  const tts = useTts({ lang: 'ko-KR' });

  const card = flipCards[index];

  // 예약한 애니메이션 프레임은 언마운트 시 모두 정리한다.
  useEffect(
    () => () => {
      rafRef.current.forEach((id) => cancelAnimationFrame(id));
      rafRef.current = [];
    },
    []
  );

  const move = useCallback(
    (step) => {
      setFlipState((prev) => {
        const { state, moved, nextIndex } = beginMove(prev, step, total);
        if (!moved) return prev;

        // 1) 뒤집힘 해제 + transition 차단 (이 시점에는 아직 이전 카드)
        // 2) 다음 프레임에 카드 교체 → 항상 앞면에서 시작
        // 3) 그 다음 프레임에 transition 복구
        const first = requestAnimationFrame(() => {
          setFlipState((cur) => commitMove(cur, nextIndex));
          const second = requestAnimationFrame(() => {
            setFlipState((cur) => finishMove(cur));
          });
          rafRef.current.push(second);
        });
        rafRef.current.push(first);

        // 카드가 바뀌면 이전 카드의 음성은 정리한다.
        tts.stop();
        return state;
      });
    },
    [total, tts]
  );

  const onFlip = useCallback(() => {
    setFlipState((prev) => toggleFlip(prev));
  }, []);

  const ttsFailed = tts.status === TTS_STATE.ERROR;

  return (
    <AppShell
      title="카드 뒤집기"
      back
      footer={
        <>
          <button
            type="button"
            className="btn ghost"
            onClick={() => move(-1)}
            disabled={index === 0 || locked}
          >
            이전
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => move(1)}
            disabled={index + 1 === total || locked}
          >
            다음
          </button>
        </>
      }
    >
      <ProgressHeader
        current={index + 1}
        total={total}
        rightLabel={flipped ? '뜻 보기' : '단어 보기'}
      />

      <div className="flip-scene">
        <button
          // 카드별 안정적인 key: 카드가 바뀌면 DOM이 교체되어 이전 transform이 남지 않는다.
          key={card.id}
          type="button"
          className={
            'flip-card' + (flipped ? ' flipped' : '') + (animate ? '' : ' no-anim')
          }
          onClick={onFlip}
          aria-label={flipped ? '카드 앞면 보기' : '카드 뒷면 보기'}
          aria-pressed={flipped}
        >
          <span className="flip-face flip-front">
            <span className="tag">단어</span>
            <span className="word">{card.front}</span>
            <span className="sub">탭하면 뒤집혀요</span>
          </span>
          <span className="flip-face flip-back" aria-hidden={!flipped}>
            <span className="tag">뜻</span>
            <span className="word">{card.back}</span>
            <span className="sub">{card.hint}</span>
          </span>
        </button>
      </div>

      <p className="flip-hint">{flipped ? card.hint : '힌트: ' + card.hint}</p>

      <div className="speak-tools">
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => tts.play(card.front)}
          disabled={!tts.supported}
          aria-live="off"
        >
          {tts.isSpeaking(card.front) ? '재생 중…' : '듣기'}
        </button>
      </div>

      {ttsFailed ? (
        <p className="notice" role="status">
          {tts.message}
        </p>
      ) : null}

      <div className="flip-dots" aria-hidden="true">
        {flipCards.map((item, i) => (
          <span key={item.id} className={i === index ? 'on' : ''} />
        ))}
      </div>
    </AppShell>
  );
}
