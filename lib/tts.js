// TTS 제어 컨트롤러.
// speechSynthesis를 주입받아 동작하므로 브라우저 밖(테스트)에서도 검증할 수 있다.
//
// 상태: idle -> preparing -> speaking -> idle | error

export const TTS_STATE = {
  UNSUPPORTED: 'unsupported',
  IDLE: 'idle',
  PREPARING: 'preparing',
  SPEAKING: 'speaking',
  ERROR: 'error',
};

export const TTS_MESSAGE = {
  [TTS_STATE.UNSUPPORTED]: '이 브라우저는 음성 재생을 지원하지 않아요.',
  [TTS_STATE.IDLE]: '',
  [TTS_STATE.PREPARING]: '음성을 준비하고 있어요.',
  [TTS_STATE.SPEAKING]: '재생 중이에요.',
  [TTS_STATE.ERROR]: '음성을 재생하지 못했어요. 다시 시도해 주세요.',
};

export function createTtsController(options = {}) {
  const {
    synth = typeof window !== 'undefined' ? window.speechSynthesis : null,
    createUtterance = typeof window !== 'undefined' && window.SpeechSynthesisUtterance
      ? (text) => new window.SpeechSynthesisUtterance(text)
      : null,
    onChange = () => {},
  } = options;

  const supported = Boolean(synth && createUtterance);

  const state = {
    status: supported ? TTS_STATE.IDLE : TTS_STATE.UNSUPPORTED,
    text: '',
    error: null,
  };

  // 재생 요청마다 증가. 늦게 도착한 콜백이 최신 재생 상태를 덮어쓰지 못하게 한다.
  let token = 0;
  // 브라우저가 utterance를 GC하면 onend가 오지 않고 음성이 끊기므로 참조를 붙잡아 둔다.
  let currentUtterance = null;
  let destroyed = false;

  function emit(next) {
    Object.assign(state, next);
    onChange({ ...state });
  }

  function isSpeakingText(text) {
    return (
      (state.status === TTS_STATE.SPEAKING || state.status === TTS_STATE.PREPARING) &&
      state.text === text
    );
  }

  function clearUtteranceHandlers() {
    if (!currentUtterance) return;
    currentUtterance.onstart = null;
    currentUtterance.onend = null;
    currentUtterance.onerror = null;
    currentUtterance = null;
  }

  function cancelInternal() {
    token += 1;
    clearUtteranceHandlers();
    if (!supported) return;
    try {
      synth.cancel();
    } catch (error) {
      // 이미 정리된 경우 무시
    }
  }

  return {
    get supported() {
      return supported;
    },
    getState() {
      return { ...state };
    },
    /**
     * @param {string} text 읽을 문장
     * @param {{ lang?: string, rate?: number, restart?: boolean }} config
     * restart=false(기본)면 같은 문장 재생 중 재요청은 무시한다.
     */
    play(text, config = {}) {
      if (destroyed) return false;
      if (!supported) {
        emit({ status: TTS_STATE.UNSUPPORTED, text: '', error: 'unsupported' });
        return false;
      }
      const target = String(text || '').trim();
      if (!target) {
        emit({ status: TTS_STATE.ERROR, text: '', error: 'empty-text' });
        return false;
      }
      // 연타/중복 호출 보호: 같은 문장이 이미 재생 중이면 끊지 않고 그대로 둔다.
      if (isSpeakingText(target) && !config.restart) return false;

      cancelInternal();
      const myToken = token;

      let utterance;
      try {
        utterance = createUtterance(target);
      } catch (error) {
        emit({ status: TTS_STATE.ERROR, text: target, error: 'create-failed' });
        return false;
      }

      utterance.lang = config.lang || 'ko-KR';
      utterance.rate = typeof config.rate === 'number' ? config.rate : 0.95;

      utterance.onstart = () => {
        if (myToken !== token || destroyed) return;
        emit({ status: TTS_STATE.SPEAKING, text: target, error: null });
      };
      utterance.onend = () => {
        if (myToken !== token || destroyed) return;
        clearUtteranceHandlers();
        emit({ status: TTS_STATE.IDLE, text: '', error: null });
      };
      utterance.onerror = (event) => {
        if (myToken !== token || destroyed) return;
        // 사용자가 직접 멈춘 경우(interrupted/canceled)는 오류로 보지 않는다.
        const reason = event && event.error ? event.error : 'unknown';
        clearUtteranceHandlers();
        if (reason === 'interrupted' || reason === 'canceled') {
          emit({ status: TTS_STATE.IDLE, text: '', error: null });
          return;
        }
        emit({ status: TTS_STATE.ERROR, text: target, error: reason });
      };

      currentUtterance = utterance;
      emit({ status: TTS_STATE.PREPARING, text: target, error: null });

      try {
        synth.speak(utterance);
      } catch (error) {
        clearUtteranceHandlers();
        emit({ status: TTS_STATE.ERROR, text: target, error: 'speak-failed' });
        return false;
      }
      return true;
    },
    stop() {
      if (!supported) return;
      cancelInternal();
      if (destroyed) return;
      emit({ status: TTS_STATE.IDLE, text: '', error: null });
    },
    /** 컴포넌트 언마운트 시에만 호출한다. */
    destroy() {
      cancelInternal();
      destroyed = true;
    },
  };
}
