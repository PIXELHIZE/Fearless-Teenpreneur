# teum Interface System · v0.4

**White. Black. One blue.**

전 연령 어학 서비스의 모바일 우선 디자인 시스템. 서비스 이름은 **teum**이며 항상 소문자로 표기한다. 현재 범위는 공용 컴포넌트·토큰·조합 규칙·모션이며, 제품 기능과 API 개발은 포함하지 않는다. v0.1의 그린 팔레트와 기능 화면은 이 버전으로 대체한다.

## 브랜드와 컬러

화이트 바탕, 블랙 타이포그래피, 코발트 블루 포인트. 여백과 선명한 대비, 1px 경계선으로 정돈된 인상을 만든다. 그라디언트, 유색 그림자, 장식용 다색 아이콘은 사용하지 않는다.

기본 행동은 블랙, 가장 중요한 행동·선택·포커스는 블루다. 화면 색 비중의 출발점은 White & neutral 80%, Black & type 15%, Blue 5%. 강제 비율이 아니라 강조를 절제하기 위한 기준이다.

| 의미 토큰 | Light | Dark | 역할 |
|---|---|---|---|
| background | #FFFFFF | #101012 | 페이지 |
| foreground | #111113 | #FAFAFA | 텍스트 |
| card | #FFFFFF | #19191C | 독립 면 |
| muted | #F5F5F7 | #232326 | 보조 면 |
| muted-foreground | #65656F | #AAAAB4 | 보조 텍스트 |
| border | #E5E5E9 | #34343A | 장식 구분선 |
| input | #85858F | #858590 | 컨트롤 경계 |
| primary | #111113 | #FAFAFA | 기본 행동 |
| primary-foreground | #FFFFFF | #111113 | 기본 버튼 글자 |
| brand | #315EFF | #94AAFF | 대표색 |
| brand-foreground | #FFFFFF | #101012 | 대표색 위 글자 |
| accent | #EEF2FF | #202945 | 선택 보조 면 |
| accent-foreground | #2449CE | #A7B8FF | 선택 면 글자 |
| ring | #315EFF | #94AAFF | 포커스 |
| destructive | #111113 | #FAFAFA | 파괴 행동의 의미 토큰 |

오류·완료에도 새 컬러를 추가하지 않는다. 체크 / X / 정보 / 느낌표 아이콘, 명시적 문구, 실선·점선으로 구분한다. destructive는 색만으로 의미를 전달하지 않으며 파괴 행동의 명확한 라벨과 확인 절차를 동반한다. 입력 경계에는 장식용 border 대신 input을 쓴다.

토큰 구조: 원시 색값 → 의미 토큰 → 컴포넌트 variant. 제품 코드에 임의 HEX를 추가하지 않는다. 대표 원시 팔레트 견본은 dark에서도 원래 HEX를 보여주고, 실제 컴포넌트는 dark 의미 토큰을 사용한다.

## teum 로고

기본형은 코발트 블루 `t.` 심볼과 소문자 `teum` 워드마크의 조합이다. 심볼의 점은 유지하되 정식 서비스명에는 점을 붙이지 않는다. 두 요소는 공통 획과 곡선으로 구성한 폰트 독립 아웃라인 SVG다.

최소 보호 여백은 심볼 높이 H의 1/4. 심볼 최소 24px, 조합형 높이 30px, 워드마크 단독 너비 80px를 권장한다. 브라우저 16px favicon만 작은 크기 예외로 둔다. 비율·간격·점 위치를 변경하거나 그림자·그라디언트를 추가하지 않는다.

`components/system/logo.tsx`의 Logo 컴포넌트를 사용하며, 도형은 `lib/logo-geometry.json`에서 관리한다. SVG·PNG·흰색형·검정형과 상세 규칙은 `teum-logo/`에 제공한다. 생성 스크립트는 `scripts/export-logo.mjs`다.

## 타이포그래피

Pretendard Variable 기본, Apple SD Gothic Neo / Noto Sans KR / system-ui 대체. 구현은 rem을 사용한다. 기본 본문·입력은 16px. 한글은 keep-all, 긴 외국어·URL은 overflow-wrap으로 넘침을 막는다.

| 역할 | 크기 / 줄 높이 | 굵기 |
|---|---|---|
| Display | 48 / 58px, 모바일 36 / 44px | 650 |
| Page title | 28 / 38px | 650 |
| Section | 20 / 28px | 600 |
| Body | 16 / 26px | 400 |
| Label | 14 / 20px | 550 |
| Supporting | 14 / 22px | 400 |
| Caption | 12 / 18px | 500 |

모바일 주 행동은 16 / 24px. 제목만 음수 자간을 적용하고 본문은 기본 자간을 유지한다. 숫자 비교는 tabular-nums. 언어 콘텐츠에는 lang과 필요한 경우 dir을 적용한다. 갤러리의 토큰명·치수 표시는 메타데이터이며 제품 본문 크기의 예시가 아니다.

## 간격·형태·앱 규격

| 항목 | 기준 |
|---|---|
| 간격 | 4, 8, 12, 16, 20, 24, 32, 48, 64px |
| 모서리 | 작은 요소 8px, 버튼·입력 12px, 카드 16px, dialog·sheet 24px, 캡슐 999px |
| 선 | 1px, 선택은 내부 ring 또는 2px. 선택으로 레이아웃이 밀리지 않도록 함 |
| 그림자 | 일반 카드 없음. 오버레이만 중립 그림자 |
| 아이콘 | Lucide 20px 기본, 모바일 내비게이션 24px, stroke 1.75 |
| 터치 | 독립 조작 영역 48 × 48 CSS px 이상 |
| 높이 | 기본 버튼·입력 min 48px, 모바일 주 행동 min 52px |
| 기준 프레임 | 390px; 320·360·390·430px 검수 |
| 좌우 여백 | 모바일 20px, 320px는 16px, 태블릿 24px, 데스크톱 32px |
| 읽기 폭 | 입력·학습 최대 520px, 넓은 화면 최대 640px |
| 안전 영역 | env(safe-area-inset-*), 모바일 키보드와 고정 요소 겹침 방지 |

고정 height보다 min-height를 쓴다. 7열 날짜 선택은 320px에서 폭 40px 예외를 허용한다. 실제 제품은 모바일 한 열을 기본으로 확장하며, 갤러리의 사이드바는 디자인 시스템 문서 탐색용이다.

## 공용 컴포넌트

shadcn/ui의 소스를 프로젝트에서 소유하고, 토큰과 크기를 제품 기준에 맞게 조정한다. 기반은 Radix이며 기본 접근성·키보드·포커스 동작을 보존한다.

| 그룹 | 컴포넌트 | 상태·변형 |
|---|---|---|
| Actions | Button, MotionButton | 색상 variant와 별도로 shape=rounded / pill, disabled / loading / focus |
| Forms | Input, Textarea, Label, Checkbox, Switch, SearchField, Select, RadioGroup, Slider, ToggleGroup | empty / filled / focus / invalid / disabled / checked / range |
| Navigation | Tabs, Accordion, BottomNavigation, Pagination, Stepper, ListItem | selected / idle / expanded / collapsed / current / complete / boundary |
| Surfaces | Card, Dialog, Sheet, Popover, DropdownMenu, Separator, Tooltip | 기본 / 보조 / anchored / modal |
| Feedback | Badge, Progress, Skeleton, StatusNotice, Toast, EmptyState, Avatar | 중립 / 정보 / 완료 / 주의 / 오류 / empty / fallback |
| Motion | MotionButton, MotionReveal, AnimatedProgress, FlipSurface | 눌림 / 등장 / 값 변경 / 앞뒤 전환 |

원시 컴포넌트는 도메인 API를 모른다. Button 스타일은 합성 부모의 `data-slot` 변경에도 유지되도록 `data-ui="button"`으로 식별한다. Button은 시험을 제출하지 않고 loading·disabled를 전달받는다. Input은 저장하지 않는다. 현재 갤러리의 상호작용은 상태와 모션 검토용이다.

### 사용 규칙

- Button: 행동 그룹마다 강한 강조 하나. 로딩 중 라벨·폭 유지, aria-busy와 중복 활성화 방지. 아이콘 단독은 접근성 이름 필수. MotionButton은 네이티브 버튼 사용을 기본으로 한다.
- Field: 라벨 → 입력 → 도움말·오류. placeholder는 라벨 대체 불가. aria-invalid와 aria-describedby로 오류 연결. 오류는 X와 원인 문구 병기.
- Switch: 기본 트랙 52×32px, 손잡이 24px, 내부 여백 4px, 이동 20px. 작은 트랙 44×26px, 손잡이 20px, 여백 3px, 이동 18px. 두 크기의 실제 버튼은 각각 52×48px, 48×48px로 터치 영역을 유지한다. 180ms 전환과 위치·텍스트로 상태를 표시하며 비활성은 조작할 수 없다.
- Capsule: `Button`, `MotionButton`, `Badge`, `TabsList`에 `shape="pill"`을 전달한다. 짧은 행동·상태·선택에 사용하며 일반 입력과 큰 표면의 12/16/24px 곡률은 유지한다. 원형 아이콘 버튼은 pill + icon 조합이다. 배지는 정보 요소이며 독립 터치 타깃으로 사용하지 않는다.
- Tabs: 같은 맥락 안에서 표현을 바꿀 때 사용. 다른 페이지는 링크로 이동. 방향키 등 Radix 동작 보존.
- Card: 패딩 24px, 모바일 20px. 카드 안의 카드 반복은 구분선으로 단순화. 클릭 가능한 카드에 다른 버튼을 중첩하지 않는다.
- Dialog: 최대 너비 440px, 화면 좌우 최소 16px, 공통 패딩 24px, 제목 22px·설명 15px, 영역 간 24px. 하단 액션은 동일 폭, 닫기는 우측 상단 48px 영역이다. 설명 전체를 닫기 버튼의 여백으로 밀지 않는다. Escape, 포커스 가두기·복귀를 유지하고 짧은 결정을 담는다.
- Sheet: 기본 방향은 bottom. 모바일의 짧은 보조 선택에 사용. 하단형은 최대 너비 560px, 최대 높이 90dvh, 상단 모서리 24px, 패딩 24px와 하단 안전 영역을 사용한다. 긴 내용은 내부 스크롤하며 닫기 버튼을 제공한다. 장식용 드래그 핸들은 사용하지 않는다.
- Overlay: 배경 흐림 없이 중립 스크림 36%(dark 60%)로 분리한다. 대화상자는 y 8px / scale .98에서 280ms 진입, 180ms 종료한다. 시트는 화면 밖에서 자신의 높이 100%만큼 올라오며 진입 420ms, 종료 300ms로 움직인다. 좌·우·상단형도 해당 방향의 크기 100%를 이동한다. 시트 종료 시 스크림도 300ms로 함께 사라진다. 모션 감소 설정에서는 즉시 상태를 전환한다.
- Status: 단순 결과 role=status, 즉시 수정이 필요한 오류 role=alert. 색 없이도 의미가 분명해야 한다.
- Tooltip: 부가 설명에만 사용. 필수 정보는 상시 노출한다.
- Skeleton: 실제 콘텐츠 자리 유지. 작업 진행률을 모르면 가짜 %를 쓰지 않는다.

### 확장 라이브러리 · v0.4

14개 컴포넌트 계열을 추가한다. 갤러리의 Library에서 선택·입력 / 탐색·목록 / 안내·레이어로 묶어 기본 상태와 상호작용을 검토한다. 상태는 호스트가 전달하며 서비스 데이터나 API에 의존하지 않는다.

| 공용 요소 | 주요 계약 | 사용 기준 |
|---|---|---|
| SearchField | label, value, onValueChange | 검색어 지우기 후 입력 포커스 유지. 필터링 로직은 호출자 담당 |
| Select | value, onValueChange, Trigger/Content/Item | 단일 선택. 52px 트리거, 48px 항목, 가장자리 16px 확보 |
| RadioGroup | value, onValueChange, RadioGroupItem | 소수의 선택지를 동시에 보여줌. 라벨 포함 행 전체 터치 |
| Slider | value[], onValueChange, thumbLabels | 단일 값·범위. 다중 손잡이에 개별 접근성 이름 제공 |
| ToggleGroup | type=single/multiple, value, onValueChange | 켜고 끄는 필터·선택 칩. 키보드 방향키 지원 |
| Avatar | size=sm/default/lg, Image/Fallback/Group | 32/40/56px. 이미지 실패 시 글자·아이콘 대체 |
| ListItem | title, description, leading, trailing, onClick | List 안에서 사용. 행 내부에 다른 인터랙션 중첩 금지 |
| Pagination | page, pageCount, onPageChange | 1부터 시작. 현재·인접 3개 숫자, 양끝 버튼 비활성 |
| Stepper | steps, currentStep | 0부터 시작. steps.length면 모두 완료. 표시와 이동 버튼 분리 |
| BottomNavigation | items, value, onValueChange | 3~5개의 최상위 목적지. 실제 위치·라우팅은 앱 셸 담당 |
| DropdownMenu | Trigger/Content/Item/CheckboxItem | 보조 행동·체크·비활성 상태. 최소 항목 높이 48px |
| Popover | open, onOpenChange, Trigger/Content | 맥락 안의 짧은 안내·설정. 제목 ID와 설명 ID 연결 |
| Toast | Provider/Viewport/Toast/Title/Description/Close | 기본 수동 닫기. polite 안내, F8 진입·Escape·스와이프 |
| EmptyState | icon, title, description, action | 데이터 없음·검색 결과 없음. 이유와 다음 행동 하나 |

Select·RadioGroup·Slider·ToggleGroup·Avatar·DropdownMenu·Popover는 shadcn CLI에서 설치한 Radix 기반 소스를 사용한다. Toast도 Radix의 공지·키보드·스와이프 동작을 사용한다. 추가 스타일은 `styles/components.css`, 상호작용 견본은 `components/system/component-library.tsx`에서 관리한다.

Toast는 기본 duration=Infinity다. 호출자가 시간을 지정할 수 있지만 중요한 내용은 본문에도 남긴다. BottomNavigation은 기본적으로 문서 흐름에 배치하며 fixed 적용 시 본문 하단 여백과 안전 영역을 함께 확보한다. 외국어 라벨에는 필요에 따라 lang을 지정한다.

## GSAP 모션 규칙

| 토큰 | 시간 | 적용 |
|---|---|---|
| press | 120ms | 버튼 scale 1 → .97 |
| state | 180ms | 프로그레스·값 변경 |
| reveal | 240ms | y 12 → 0, opacity 0 → 1 |
| surface | 280ms | 대화상자의 짧은 진입 |
| sheet-enter | 420ms | 화면 아래 translateY(100%) → 0 |
| sheet-exit | 300ms | translateY(0) → 100% |
| flip | 360ms | 앞뒤 면 rotateY 전환 |
| stagger | 40ms | 그룹 내 항목 순차 등장 |

기본 easing은 power2.out, 회전은 power2.inOut. 일반 피드백 이동은 16px 이내, scale 변화는 3% 이내다. 화면 가장자리에서 등장하는 시트는 크기 100%를 이동하는 예외이며 cubic-bezier(.22, 1, .36, 1)로 감속한다. 종료는 cubic-bezier(.4, 0, 1, 1)을 사용한다. 무한 장식 루프와 과한 바운스는 사용하지 않는다. 터치와 키보드도 같은 상태 변화를 제공한다.

React에서는 useGSAP·contextSafe로 언마운트 정리를 처리한다. 빠른 반복 입력은 overwrite 또는 최신 목표값으로 처리한다. prefers-reduced-motion이면 이동·회전을 생략하고 즉시 최종 상태로 전환한다. 로딩은 모션이 없어도 문구로 의미를 전달한다. [GSAP React](https://gsap.com/resources/React/), [matchMedia](https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/).

Dialog·Sheet는 shadcn/Radix의 상태 기반 CSS 전환을 사용한다. GSAP은 별도 버튼 래퍼·콘텐츠·프로그레스·카드에 적용해 동일 요소의 transform을 두 시스템이 경쟁하지 않게 한다.

## 개발 인계

소스: 저장소 루트. Next.js App Router + TypeScript + Tailwind CSS + shadcn/ui + GSAP. package-lock.json이 설치 버전을 고정한다.

```text
app/                  디자인 시스템 갤러리
components/ui/        shadcn 공용 소스
components/system/    브랜드·상태·모션 래퍼
styles/tokens.css     의미 토큰
styles/components.css 확장 공용 UI 및 견본 스타일
lib/motion.ts         시간·easing 토큰
components.json       shadcn 설정
README.md             실행·사용법
```

토큰 CSS는 app/globals.css에서 가져온다. dark 클래스로 다크 테마를 사용한다. Pretendard는 공식 배포 CDN에서 가져오며 연결이 없으면 시스템 글꼴로 대체한다. [shadcn 테마 규칙](https://ui.shadcn.com/docs/theming), [Next.js 설치 안내](https://ui.shadcn.com/docs/installation/next).

검수: light/dark, 320·390·768·1280px, 글자 확대, 긴 다국어 문장, 키보드·포커스, disabled/loading/invalid, 스크린리더, reduced-motion, 빠른 반복 클릭, 언마운트 정리. 전체 접근성 적합성 인증을 의미하지 않는다.

일반 글자 대비 4.5:1, 큰 글자 3:1을 기준으로 한다. 제품의 48px 터치 규격은 WCAG AA 최소 24px와 구분한다. [W3C 대비](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [W3C 터치 대상](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

변경 시 토큰 → 컴포넌트 → 갤러리 → 명세를 같은 버전으로 갱신한다. 기능 개발은 이 시스템의 검토 이후 별도로 진행한다.
