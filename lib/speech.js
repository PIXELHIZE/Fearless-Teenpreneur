// 음성 인식(STT) 컨트롤러.
// SpeechRecognition 생성자를 주입받을 수 있어 테스트에서 가짜 구현으로 검증한다.

export const STT_STATE = {
  UNSUPPORTED: 'unsupported',
  INSECURE: 'insecure',
  IDLE: 'idle',
  REQUESTING: 'requesting',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  DONE: 'done',
  ERROR: 'error',
};

export const STT_ERROR_MESSAGE = {
  'not-allowed': '마이크 권한이 거부되었어요. 브라우저 설정에서 마이크를 허용해 주세요.',
  'service-not-allowed': '브라우저가 음성 인식을 막았어요. 마이크 권한을 확인해 주세요.',
  'no-speech': '소리가 들리지 않았어요. 마이크에 가까이서 다시 말해 주세요.',
  'audio-capture': '마이크를 찾을 수 없어요. 마이크 연결을 확인해 주세요.',
  network: '네트워크 문제로 인식에 실패했어요. 연결을 확인하고 다시 시도해 주세요.',
  aborted: '인식이 중단되었어요. 다시 시도해 주세요.',
  'language-not-supported': '이 브라우저에서 해당 언어 인식을 지원하지 않아요.',
  empty: '말한 내용을 알아듣지 못했어요. 조금 더 크게 다시 말해 주세요.',
  unsupported: '이 브라우저는 음성 인식을 지원하지 않아요.',
  insecure: '음성 인식은 HTTPS 또는 localhost에서만 사용할 수 있어요.',
  'start-failed': '인식을 시작할 수 없었어요. 잠시 후 다시 시도해 주세요.',
  unknown: '인식에 실패했어요. 다시 시도해 주세요.',
};

export function sttErrorMessage(code) {
  return STT_ERROR_MESSAGE[code] || STT_ERROR_MESSAGE.unknown;
}

export function resolveRecognitionCtor(win) {
  if (!win) return null;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function isSecureContextForMic(loc, isSecure) {
  if (isSecure === true) return true;
  const hostname = loc && loc.hostname ? loc.hostname : '';
  const protocol = loc && loc.protocol ? loc.protocol : '';
  if (protocol === 'https:' || protocol === 'file:') return true;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function pickTranscript(event) {
  if (!event || !event.results) return '';
  const results = event.results;
  let best = '';
  for (let i = 0; i < results.length; i += 1) {
    const result = results[i];
    if (!result || result.length === 0) continue;
    // 최종 결과를 우선하고, 없으면 마지막 후보라도 사용한다.
    const alternative = result[0];
    if (!alternative || !alternative.transcript) continue;
    if (result.isFinal === false && best) continue;
    best = String(alternative.transcript);
  }
  return best.trim();
}

export function createSttController(options = {}) {
  const {
    win = typeof window !== 'undefined' ? window : null,
    lang = 'ko-KR',
    onChange = () => {},
    onResult = () => {},
  } = options;

  const Ctor = options.RecognitionCtor || resolveRecognitionCtor(win);
  const secure = options.secure !== undefined
    ? options.secure
    : isSecureContextForMic(win && win.location, win && win.isSecureContext);

  let initialStatus = STT_STATE.IDLE;
  let initialError = null;
  if (!Ctor) {
    initialStatus = STT_STATE.UNSUPPORTED;
    initialError = 'unsupported';
  } else if (!secure) {
    initialStatus = STT_STATE.INSECURE;
    initialError = 'insecure';
  }

  const state = { status: initialStatus, error: initialError };
  const available = initialStatus === STT_STATE.IDLE;

  let recognition = null;
  let destroyed = false;
  // start() 중복 호출로 InvalidStateError가 나지 않도록 진행 상태를 직접 추적한다.
  let active = false;
  let gotResult = false;
  // 사용자가 직접 멈춤/화면 이동으로 취소한 경우. 늦게 도착하는 onend를 오류로 처리하지 않는다.
  let userAborted = false;

  function emit(next) {
    Object.assign(state, next);
    if (!destroyed) onChange({ ...state });
  }

  function detach() {
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognition.onstart = null;
    recognition.onaudiostart = null;
    recognition = null;
  }

  function build() {
    const instance = new Ctor();
    instance.lang = lang;
    instance.continuous = false;
    instance.interimResults = false;
    instance.maxAlternatives = 1;

    instance.onstart = () => {
      if (destroyed) return;
      emit({ status: STT_STATE.LISTENING, error: null });
    };
    instance.onresult = (event) => {
      if (destroyed) return;
      const transcript = pickTranscript(event);
      gotResult = true;
      if (!transcript) {
        emit({ status: STT_STATE.ERROR, error: 'empty' });
        return;
      }
      emit({ status: STT_STATE.PROCESSING, error: null });
      onResult(transcript);
      emit({ status: STT_STATE.DONE, error: null });
    };
    instance.onerror = (event) => {
      if (destroyed) return;
      gotResult = true; // onend에서 중복 처리하지 않도록 표시
      const code = event && event.error ? event.error : 'unknown';
      // 사용자가 취소한 경우의 aborted는 오류가 아니다.
      if (code === 'aborted' && (userAborted || !active)) {
        emit({ status: STT_STATE.IDLE, error: null });
        return;
      }
      emit({ status: STT_STATE.ERROR, error: code });
    };
    instance.onend = () => {
      active = false;
      if (destroyed) return;
      // 사용자가 멈춘 경우: 오류가 아니라 대기 상태로 돌린다.
      if (userAborted) {
        userAborted = false;
        if (!gotResult) emit({ status: STT_STATE.IDLE, error: null });
        return;
      }
      // 결과도 오류도 없이 종료되면 아무 말도 하지 않은 것으로 처리한다.
      if (!gotResult) {
        emit({ status: STT_STATE.ERROR, error: 'no-speech' });
        return;
      }
      if (state.status === STT_STATE.LISTENING || state.status === STT_STATE.REQUESTING) {
        emit({ status: STT_STATE.IDLE, error: null });
      }
    };

    return instance;
  }

  return {
    get available() {
      return available;
    },
    get isActive() {
      return active;
    },
    getState() {
      return { ...state };
    },
    start() {
      if (destroyed || !available) return false;
      // 연타 방어: 이미 진행 중이면 새 세션을 만들지 않는다.
      if (active) return false;

      gotResult = false;
      userAborted = false;
      active = true;
      emit({ status: STT_STATE.REQUESTING, error: null });

      try {
        recognition = build();
        recognition.start();
        return true;
      } catch (error) {
        active = false;
        detach();
        emit({ status: STT_STATE.ERROR, error: 'start-failed' });
        return false;
      }
    },
    stop() {
      if (!recognition || !active) return;
      active = false;
      userAborted = true;
      try {
        recognition.stop();
      } catch (error) {
        detach();
        userAborted = false;
        emit({ status: STT_STATE.IDLE, error: null });
      }
    },
    reset() {
      if (destroyed || !available) return;
      if (active) return;
      // userAborted는 유지한다. stop() 직후 reset()을 호출하는 경우
      // 아직 도착하지 않은 onend가 no-speech 오류로 오인되지 않아야 한다.
      // (다음 start()에서 초기화된다.)
      emit({ status: STT_STATE.IDLE, error: null });
    },
    destroy() {
      destroyed = true;
      active = false;
      if (recognition) {
        const instance = recognition;
        detach();
        try {
          instance.abort();
        } catch (error) {
          // 이미 종료된 경우 무시
        }
      }
    },
  };
}
