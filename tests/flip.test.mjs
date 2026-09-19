import assert from 'node:assert/strict';
import test from 'node:test';
import { beginMove, commitMove, createFlipState, finishMove, toggleFlip } from '../lib/flip.js';

test('초기 상태는 앞면이고 잠금이 아니다', () => {
  const state = createFlipState(0);
  assert.deepEqual(state, { index: 0, flipped: false, animate: true, locked: false });
});

test('뒤집힌 상태에서 이동하면 인덱스 교체 전에 앞면으로 초기화된다', () => {
  const flippedState = toggleFlip(createFlipState(0));
  assert.equal(flippedState.flipped, true);

  const { state, moved, nextIndex } = beginMove(flippedState, 1, 3);
  assert.equal(moved, true);
  assert.equal(nextIndex, 1);
  // 1단계에서는 인덱스가 그대로여야 한다 (새 카드가 뒷면으로 렌더되지 않음)
  assert.equal(state.index, 0);
  assert.equal(state.flipped, false);
  // transition 차단으로 뒤집힘 해제가 애니메이션 없이 즉시 적용된다
  assert.equal(state.animate, false);
  assert.equal(state.locked, true);

  const committed = commitMove(state, nextIndex);
  assert.equal(committed.index, 1);
  assert.equal(committed.flipped, false);
  assert.equal(committed.animate, false);

  const finished = finishMove(committed);
  assert.equal(finished.animate, true);
  assert.equal(finished.locked, false);
  assert.equal(finished.flipped, false);
});

test('이전 카드로 돌아갈 때도 앞면으로 초기화된다', () => {
  let state = createFlipState(2);
  state = toggleFlip(state);
  const move = beginMove(state, -1, 3);
  assert.equal(move.moved, true);
  assert.equal(move.nextIndex, 1);
  assert.equal(move.state.flipped, false);
  assert.equal(commitMove(move.state, move.nextIndex).flipped, false);
});

test('전환 중 연타는 무시된다', () => {
  const first = beginMove(createFlipState(0), 1, 3);
  assert.equal(first.moved, true);
  // 잠금 상태에서 다시 이동 시도
  const second = beginMove(first.state, 1, 3);
  assert.equal(second.moved, false);
  assert.equal(second.state.index, 0);
  // 잠금 상태에서는 뒤집기도 막힌다
  assert.equal(toggleFlip(first.state).flipped, false);
});

test('범위를 벗어난 이동은 상태를 바꾸지 않는다', () => {
  const state = createFlipState(0);
  assert.equal(beginMove(state, -1, 3).moved, false);
  const last = createFlipState(2);
  assert.equal(beginMove(last, 1, 3).moved, false);
});

test('연속 이동 시 어떤 단계에서도 flipped가 true가 되지 않는다', () => {
  let state = toggleFlip(createFlipState(0));
  const seen = [];
  for (let i = 0; i < 3; i += 1) {
    const move = beginMove(state, 1, 6);
    if (!move.moved) break;
    state = move.state;
    seen.push(state.flipped);
    state = commitMove(state, move.nextIndex);
    seen.push(state.flipped);
    state = finishMove(state);
    seen.push(state.flipped);
  }
  assert.equal(seen.every((value) => value === false), true);
  assert.equal(state.index, 3);
});
