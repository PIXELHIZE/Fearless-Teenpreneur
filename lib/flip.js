// 카드 뒤집기 상태 전이 (순수 로직)
//
// 핵심: 카드 인덱스와 뒤집힘 상태의 생명주기를 분리한다.
// 이동 시 (1) flip=false로 먼저 초기화 + transition 비활성 (2) 다음 프레임에 인덱스 교체
// 순서를 지켜야 새 카드의 뒷면이 한 프레임도 노출되지 않는다.

export function createFlipState(index = 0) {
  return { index, flipped: false, animate: true, locked: false };
}

export function toggleFlip(state) {
  // 전환 중에는 뒤집기를 막는다.
  if (state.locked) return state;
  return { ...state, flipped: !state.flipped, animate: true };
}

/**
 * 이동 1단계: 뒤집힘 해제 + 애니메이션 차단 + 내비게이션 잠금.
 * 인덱스는 아직 바꾸지 않는다(현재 카드 앞면으로만 돌아간다).
 */
export function beginMove(state, step, total) {
  if (state.locked) return { state, moved: false, nextIndex: state.index };
  const nextIndex = state.index + step;
  if (nextIndex < 0 || nextIndex >= total) {
    return { state, moved: false, nextIndex: state.index };
  }
  return {
    state: { ...state, flipped: false, animate: false, locked: true },
    moved: true,
    nextIndex,
  };
}

/** 이동 2단계: 앞면 상태에서 카드 내용을 교체한다. */
export function commitMove(state, nextIndex) {
  return { ...state, index: nextIndex, flipped: false, animate: false };
}

/** 이동 3단계: 애니메이션과 조작을 다시 허용한다. */
export function finishMove(state) {
  return { ...state, animate: true, locked: false };
}
