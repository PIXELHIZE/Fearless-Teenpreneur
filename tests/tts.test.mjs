import assert from 'node:assert/strict';
import test from 'node:test';
import { TTS_STATE, createTtsController } from '../lib/tts.js';

function createFakeSynth() {
  const synth = {
    queue: [],
    cancelCount: 0,
    speak(utterance) {
      synth.queue.push(utterance);
      // 브라우저처럼 비동기로 start를 알린다.
      utterance.onstart?.();
    },
    cancel() {
      synth.cancelCount += 1;
      const pending = [...synth.queue];
      synth.queue = [];
      pending.forEach((utterance) => utterance.onerror?.({ error: 'interrupted' }));
    },
  };
  return synth;
}

function createController(overrides = {}) {
  const synth = createFakeSynth();
  const states = [];
  const controller = createTtsController({
    synth,
    createUtterance: (text) => ({ text }),
    onChange: (state) => states.push(state.status),
    ...overrides,
  });
  return { synth, states, controller };
}

test('한 번 재생하면 끝까지 재생되고 완료 후 idle로 돌아간다', () => {
  const { synth, controller, states } = createController();
  assert.equal(controller.play('안녕하세요'), true);
  assert.equal(controller.getState().status, TTS_STATE.SPEAKING);

  const utterance = synth.queue[0];
  utterance.onend();
  assert.equal(controller.getState().status, TTS_STATE.IDLE);
  assert.deepEqual(states, [TTS_STATE.PREPARING, TTS_STATE.SPEAKING, TTS_STATE.IDLE]);
  // 재생 중 cancel이 호출되지 않았다
  assert.equal(synth.cancelCount, 1); // play 시작 시 1회 정리만
});

test('같은 문장 재생 중 연타하면 중복 재생되지 않고 끊기지 않는다', () => {
  const { synth, controller } = createController();
  controller.play('감사합니다');
  const before = synth.cancelCount;

  assert.equal(controller.play('감사합니다'), false);
  assert.equal(controller.play('감사합니다'), false);
  assert.equal(controller.play('감사합니다'), false);

  assert.equal(synth.queue.length, 1);
  assert.equal(synth.cancelCount, before, '연타해도 진행 중 음성을 취소하지 않는다');
  assert.equal(controller.getState().status, TTS_STATE.SPEAKING);
});

test('restart 옵션을 주면 현재 음성을 끊고 처음부터 다시 재생한다', () => {
  const { synth, controller } = createController();
  controller.play('다시 한 번');
  assert.equal(controller.play('다시 한 번', { restart: true }), true);
  assert.equal(synth.queue.length, 1, '이전 음성은 정리되고 새 음성만 남는다');
  assert.equal(controller.getState().status, TTS_STATE.SPEAKING);
});

test('다른 문장을 재생하면 이전 음성을 정리하고 새 문장을 재생한다', () => {
  const { synth, controller } = createController();
  controller.play('첫 문장');
  controller.play('두 번째 문장');
  assert.equal(synth.queue.length, 1);
  assert.equal(synth.queue[0].text, '두 번째 문장');
  assert.equal(controller.getState().text, '두 번째 문장');
});

test('중단(interrupted)은 오류가 아니라 idle로 처리한다', () => {
  const { controller } = createController();
  controller.play('중단될 문장');
  controller.stop();
  assert.equal(controller.getState().status, TTS_STATE.IDLE);
  assert.equal(controller.getState().error, null);
});

test('실패하면 error 상태가 되고 앱은 계속 동작한다', () => {
  const { synth, controller } = createController();
  controller.play('실패할 문장');
  synth.queue[0].onerror({ error: 'synthesis-failed' });
  assert.equal(controller.getState().status, TTS_STATE.ERROR);
  assert.equal(controller.getState().error, 'synthesis-failed');

  // 실패 후에도 다시 재생할 수 있다
  assert.equal(controller.play('다음 문장'), true);
  assert.equal(controller.getState().status, TTS_STATE.SPEAKING);
});

test('speak 자체가 throw해도 error 상태로 처리한다', () => {
  const { controller } = createController({
    synth: {
      speak() {
        throw new Error('boom');
      },
      cancel() {},
    },
  });
  assert.equal(controller.play('문장'), false);
  assert.equal(controller.getState().status, TTS_STATE.ERROR);
});

test('미지원 환경은 unsupported 상태를 유지한다', () => {
  const controller = createTtsController({ synth: null, createUtterance: null });
  assert.equal(controller.supported, false);
  assert.equal(controller.play('문장'), false);
  assert.equal(controller.getState().status, TTS_STATE.UNSUPPORTED);
});

test('빈 문장은 재생하지 않는다', () => {
  const { controller } = createController();
  assert.equal(controller.play('   '), false);
  assert.equal(controller.getState().error, 'empty-text');
});

test('destroy(언마운트) 후에는 늦게 온 콜백이 상태를 바꾸지 않는다', () => {
  const { synth, controller } = createController();
  controller.play('화면 이동 중 문장');
  const utterance = synth.queue[0];
  controller.destroy();
  assert.equal(synth.cancelCount >= 1, true, '언마운트 시 음성을 정리한다');

  // 늦게 도착한 콜백
  utterance.onend?.();
  utterance.onerror?.({ error: 'network' });
  assert.equal(controller.play('이후 문장'), false, 'destroy 후에는 재생하지 않는다');
});
