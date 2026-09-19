'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import AppShell from '@/components/AppShell';
import ProgressHeader from '@/components/ProgressHeader';
import { traceItems } from '@/lib/content';

export default function TracePage() {
  const total = traceItems.length;
  const [index, setIndex] = useState(0);
  const [hasStroke, setHasStroke] = useState(false);
  const [warn, setWarn] = useState('');

  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastRef = useRef(null);

  const item = traceItems[index];

  // 캔버스를 화면 크기와 기기 픽셀 비율에 맞춰 준비
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = Math.max(10, rect.width * 0.05);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#3b6ef6';
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    drawingRef.current = false;
    lastRef.current = null;
    setHasStroke(false);
    setWarn('');
  }, []);

  useEffect(() => {
    setupCanvas();
    const onResize = () => {
      setupCanvas();
      clearCanvas();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [setupCanvas, clearCanvas]);

  // 글자가 바뀌면 캔버스를 비운다
  useEffect(() => {
    clearCanvas();
  }, [index, clearCanvas]);

  function pointOf(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  const start = useCallback((event) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (error) {
      // 캡처를 지원하지 않는 환경은 무시
    }
    drawingRef.current = true;
    lastRef.current = pointOf(event);
    setWarn('');
  }, []);

  const move = useCallback((event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const point = pointOf(event);
    const last = lastRef.current || point;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastRef.current = point;
    setHasStroke(true);
  }, []);

  const end = useCallback((event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    drawingRef.current = false;
    lastRef.current = null;
  }, []);

  const next = useCallback(() => {
    if (!hasStroke) {
      setWarn('글자를 따라 써 주세요.');
      return;
    }
    setIndex((prev) => (prev + 1 >= total ? 0 : prev + 1));
  }, [hasStroke, total]);

  return (
    <AppShell
      title="따라쓰기"
      back
      footer={
        <>
          <button type="button" className="btn ghost" onClick={clearCanvas}>
            지우기
          </button>
          <button type="button" className="btn" onClick={next}>
            {index + 1 === total ? '처음부터' : '다음 글자'}
          </button>
        </>
      }
    >
      <ProgressHeader current={index + 1} total={total} rightLabel="손가락으로 쓰기" />

      <div className="trace-stage">
        <div className="trace-grid" aria-hidden="true" />
        <div className="trace-ghost" aria-hidden="true">
          {item.text}
        </div>
        <canvas
          ref={canvasRef}
          className="trace-canvas"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
          role="img"
          aria-label={item.text + ' 따라쓰기 영역'}
        />
      </div>

      <p className="trace-guide">{item.guide}</p>
      {warn ? <p className="trace-empty">{warn}</p> : null}
    </AppShell>
  );
}
