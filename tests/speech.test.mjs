import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STT_STATE,
  createSttController,
  isSecureContextForMic,
  pickTranscript,
  resolveRecognitionCtor,
  sttErrorMessage,
} from '../lib/speech.js';
import { normalize, similarityScore } from '../lib/similarity.js';

test('SpeechRecognition과 webkitSpeechRecognition을 모두 인식한다', () => {
  const std = function Std() {};
  const webkit = function Webkit() {};
  assert.equal(resolveRecognitionCtor({ SpeechRecognition: std }), std);
  assert.equal(resolveRecognitionCtor({ webkitSpeechRecognition: webkit }), webkit);
  assert.equal(resolveRecognitionCtor({}), null);
  assert.equal(resolveRecognitionCtor(null), null);
});

test('HTTPS와 localhost에서만 마이크 사용을 허용한다', () => {
  assert.equal(isSecureContextForMic({ protocol: 'https:', hostname: 'example.com' }), true);
  assert.equal(isSecureContextForMic({ protocol: 'http:', hostname: 'localhost' }), true);
  assert.equal(isSecureContextForMic({ protocol: 'http:', hostname: '127.0.0.1' }), true);
  assert.equal(isSecureContextForMic({ protocol: 'http:', hostname: 'example.com' }), false);
  assert.equal(isSecureContextForMic({ protocol: 'http:', hostname: 'example.com' }, true), true);
});

function createFakeRecognition() {
  const instances = [];
  class FakeRecognition {
    constructor() {
      this.started = 0;
      this.stopped = 0;
      this.aborted = 0;
      instances.push(this);
    }
    start() {
      this.started += 1;
      if (this.started > 1) throw new Error('InvalidStateError');
      this.onstart?.();
    }
    stop() {
      this.stopped += 1;
      this.onend?.();
    }
    abort() {
      this.aborted += 1;
    }
    emitResult(transcript, isFinal = true) {
      this.onresult?.({ results: [Object.assign([{ transcript }], { isFinal })] });
      this.onend?.();
    }
    emitError(code) {
      this.onerror?.({ error: code });
      this.onend?.();
    }
  }
  return { FakeRecognition, instances };
}

function setup() {
  const { FakeRecognition, instances } = createFakeRecognition();
  const transcripts = [];
  const statuses = [];
  const controller = createSttController({
    RecognitionCtor: FakeRecognition,
    secure: true,
    lang: 'ko-KR',
    onChange: (state) => statuses.push(state.status),
    onResult: (value) => transcripts.push(value),
  });
  return { controller, instances, transcripts, statuses };
}

test('정상 흐름: 시작 → 인식 → 결과 전달 → 종료', () => {
  const { controller, instances, transcripts } = setup();
  assert.equal(controller.available, true);
  assert.equal(controller.start(), true);
  assert.equal(controller.getState().status, STT_STATE.LISTENING);
  assert.equal(instances[0].lang, 'ko-KR');

  instances[0].emitResult('안녕하세요');
  assert.deepEqual(transcripts, ['안녕하세요']);
  assert.equal(controller.getState().status, STT_STATE.DONE);
  assert.equal(controller.isActive, false, '종료 후 녹음 중 상태가 남지 않는다');
});

test('버튼 연타 시 start가 중복 호출되지 않는다 (InvalidStateError 방지)', () => {
  const { controller, instances } = setup();
  assert.equal(controller.start(), true);
  assert.equal(controller.start(), false);
  assert.equal(controller.start(), false);
  assert.equal(instances.length, 1);
  assert.equal(instances[0].started, 1);
  assert.equal(controller.getState().status, STT_STATE.LISTENING);
});

test('마이크 권한 거부는 안내 메시지로 이어진다', () => {
  const { controller, instances } = setup();
  controller.start();
  instances[0].emitError('not-allowed');
  assert.equal(controller.getState().status, STT_STATE.ERROR);
  assert.equal(controller.getState().error, 'not-allowed');
  assert.match(sttErrorMessage('not-allowed'), /마이크 권한/);
  assert.equal(controller.isActive, false);

  // 거부 후에도 다시 시도할 수 있다
  assert.equal(controller.start(), true);
});

test('아무 말도 하지 않으면 no-speech로 안내한다', () => {
  const { controller, instances } = setup();
  controller.start();
  instances[0].onend();
  assert.equal(controller.getState().error, 'no-speech');
  assert.match(sttErrorMessage('no-speech'), /소리가 들리지 않았어요/);
});

test('빈 인식 결과는 empty로 처리한다', () => {
  const { controller, instances, transcripts } = setup();
  controller.start();
  instances[0].emitResult('   ');
  assert.equal(transcripts.length, 0);
  assert.equal(controller.getState().error, 'empty');
});

test('네트워크·마이크 오류 코드에 각각 안내가 있다', () => {
  ['network', 'audio-capture', 'service-not-allowed', 'aborted'].forEach((code) => {
    assert.notEqual(sttErrorMessage(code), sttErrorMessage('unknown'));
  });
  assert.equal(sttErrorMessage('made-up-code'), sttErrorMessage('unknown'));
});

test('미지원 브라우저와 비보안 환경을 구분한다', () => {
  const unsupported = createSttController({ RecognitionCtor: null, secure: true });
  assert.equal(unsupported.available, false);
  assert.equal(unsupported.getState().status, STT_STATE.UNSUPPORTED);
  assert.equal(unsupported.start(), false);

  const { FakeRecognition } = createFakeRecognition();
  const insecure = createSttController({ RecognitionCtor: FakeRecognition, secure: false });
  assert.equal(insecure.available, false);
  assert.equal(insecure.getState().status, STT_STATE.INSECURE);
  assert.equal(insecure.start(), false);
});

test('인식 중 화면을 이동하면(destroy) 이후 콜백이 상태를 바꾸지 않는다', () => {
  const { controller, instances, transcripts } = setup();
  controller.start();
  const statusBefore = controller.getState().status;
  controller.destroy();
  assert.equal(instances[0].aborted, 1);

  instances[0].onresult?.({ results: [[{ transcript: '늦은 결과' }]] });
  assert.equal(transcripts.length, 0);
  assert.equal(controller.getState().status, statusBefore);
  assert.equal(controller.start(), false);
});

test('stop 후에는 녹음 중 상태가 남지 않는다', () => {
  const { controller, instances } = setup();
  controller.start();
  controller.stop();
  assert.equal(controller.isActive, false);
  assert.equal(instances[0].stopped, 1);
});

test('사용자가 직접 멈추면 오류 안내가 남지 않는다', () => {
  const { controller, instances } = setup();
  controller.start();
  controller.stop(); // stop()이 onend를 호출한다
  assert.equal(controller.getState().status, STT_STATE.IDLE);
  assert.equal(controller.getState().error, null, '멈추기는 no-speech 오류가 아니다');

  // 멈춘 뒤에도 다시 시작할 수 있고, 이번에는 정상적으로 no-speech를 감지한다
  assert.equal(controller.start(), true);
  instances[1].onend();
  assert.equal(controller.getState().error, 'no-speech');
});

test('멈춘 뒤 늦게 도착한 aborted 이벤트도 오류로 처리하지 않는다', () => {
  const { controller, instances } = setup();
  controller.start();
  controller.stop();
  instances[0].onerror?.({ error: 'aborted' });
  assert.equal(controller.getState().status, STT_STATE.IDLE);
  assert.equal(controller.getState().error, null);
});

test('화면 이동(stop + reset) 후 늦게 온 onend는 오류 안내를 남기지 않는다', () => {
  const { FakeRecognition, instances } = createFakeRecognition();
  // stop()이 onend를 즉시 부르지 않는 브라우저 동작을 재현한다.
  FakeRecognition.prototype.stop = function stop() {
    this.stopped = (this.stopped || 0) + 1;
  };
  const statuses = [];
  const controller = createSttController({
    RecognitionCtor: FakeRecognition,
    secure: true,
    onChange: (state) => statuses.push(state),
  });

  controller.start();
  controller.stop();
  controller.reset(); // 다음 문항으로 이동
  assert.equal(controller.getState().status, STT_STATE.IDLE);

  // 뒤늦게 도착한 onend
  instances[0].onend();
  assert.equal(controller.getState().status, STT_STATE.IDLE);
  assert.equal(controller.getState().error, null, '이동 후 no-speech 오류가 남지 않는다');

  // 다음 시도는 정상적으로 no-speech를 감지한다
  controller.start();
  instances[1].onend();
  assert.equal(controller.getState().error, 'no-speech');
});

test('여러 결과 중 최종 후보를 고른다', () => {
  const event = {
    results: [
      Object.assign([{ transcript: '안녕' }], { isFinal: true }),
      Object.assign([{ transcript: '안녕하세요' }], { isFinal: true }),
    ],
  };
  assert.equal(pickTranscript(event), '안녕하세요');
  assert.equal(pickTranscript(null), '');
  assert.equal(pickTranscript({ results: [] }), '');
});

test('정규화는 대소문자·공백·문장부호만 흡수하고 의미 글자는 보존한다', () => {
  assert.equal(normalize('  Hello, World!  '), 'helloworld');
  assert.equal(normalize('안녕하세요.'), '안녕하세요');
  assert.equal(normalize('안녕 하세요'), '안녕하세요');
  assert.equal(normalize('오늘 날씨가 좋아요!'), '오늘날씨가좋아요');
  // 숫자와 한글 낱자는 지워지지 않는다
  assert.equal(normalize('4번 문제'), '4번문제');
  assert.equal(normalize(''), '');
});

test('문장부호·공백·대소문자 차이만 있으면 만점으로 채점한다', () => {
  assert.equal(similarityScore('안녕하세요', ' 안녕하세요! '), 100);
  assert.equal(similarityScore('저는 학생입니다', '저는학생입니다.'), 100);
  assert.equal(similarityScore('Thank you', 'thank you!'), 100);
});

test('다른 문장은 점수가 낮고, 빈 입력은 0점이다', () => {
  assert.equal(similarityScore('안녕하세요', ''), 0);
  assert.equal(similarityScore('', '안녕하세요'), 0);
  const partial = similarityScore('오늘 날씨가 좋아요', '오늘 날씨가');
  assert.ok(partial > 0 && partial < 100, '부분 일치는 중간 점수: ' + partial);
  assert.ok(similarityScore('안녕하세요', '전혀 다른 말') < 40);
});
