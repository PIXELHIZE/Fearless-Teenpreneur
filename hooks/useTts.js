'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TTS_MESSAGE, TTS_STATE, createTtsController } from '@/lib/tts';

/**
 * 화면 단위로 하나의 TTS 컨트롤러를 유지하는 훅.
 * 컨트롤러는 마운트 시 1회만 만들고, 정리는 언마운트에서만 수행한다.
 */
export default function useTts(defaults = {}) {
  const controllerRef = useRef(null);
  const [ttsState, setTtsState] = useState({ status: TTS_STATE.IDLE, text: '', error: null });
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  useEffect(() => {
    const controller = createTtsController({
      onChange: (next) => setTtsState(next),
    });
    controllerRef.current = controller;
    setTtsState(controller.getState());

    return () => {
      // 언마운트(화면 이동) 시에만 음성을 정리한다.
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  const play = useCallback((text, config = {}) => {
    const controller = controllerRef.current;
    if (!controller) return false;
    return controller.play(text, { ...defaultsRef.current, ...config });
  }, []);

  const stop = useCallback(() => {
    controllerRef.current?.stop();
  }, []);

  const status = ttsState.status;

  return {
    status,
    speakingText: ttsState.text,
    error: ttsState.error,
    message: TTS_MESSAGE[status] || '',
    supported: status !== TTS_STATE.UNSUPPORTED,
    isBusy: status === TTS_STATE.PREPARING || status === TTS_STATE.SPEAKING,
    isSpeaking: (text) =>
      (status === TTS_STATE.PREPARING || status === TTS_STATE.SPEAKING) && ttsState.text === text,
    play,
    stop,
  };
}
