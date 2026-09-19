# teum Interface System v0.4

화이트·블랙·코발트 블루를 사용하는 모바일 우선 디자인 시스템입니다. 공용 UI와 모션을 확인하는 갤러리이며 학습·일정·시험 API는 포함하지 않습니다.

[전체 디자인 규칙](DESIGN_SYSTEM.md) · [로고 키트와 사용 규칙](teum-logo/README.md)

## 실행

```bash
npm ci
npm run dev
```

브라우저에서 http://localhost:3000 을 엽니다. 배포 검증은 `npm run build`, 코드 검사는 `npm run lint`입니다.

## 구성

- `components/ui`: shadcn CLI에서 설치한 Radix 기반 소스. 브랜드·크기·상태 토큰에 맞게 조정했습니다.
- `components/system`: `MotionButton`, `MotionReveal`, `AnimatedProgress`, `FlipSurface`, `StatusNotice`, 검토용 `Gallery`.
- `styles/components.css`: 확장 컴포넌트 14계열의 크기·상태·모션과 갤러리 스타일.
- `styles/tokens.css`: light/dark, 컬러, 간격, 모서리, 글자, 모션 시간.
- `lib/motion.ts`: GSAP의 시간과 easing 기준.
- `app/globals.css`: Tailwind 연결 및 컴포넌트·갤러리 스타일.

```tsx
<MotionButton variant="brand">강조 행동</MotionButton>
<MotionButton variant="brand" shape="pill">캡슐형 행동</MotionButton>
<Badge shape="pill" variant="outline">완료</Badge>
<TabsList shape="pill" aria-label="보기 선택">…</TabsList>
<Switch size="default" aria-label="옵션" />
<MotionButton variant="outline" loading>처리 중</MotionButton>
<AnimatedProgress value={64} label="진행률" />
<StatusNotice tone="error" title="확인 필요">입력 내용을 확인해 주세요.</StatusNotice>
```

기본 버튼은 블랙. 대표색은 `#315EFF`. 오류도 새 컬러 없이 아이콘·명시적 문구·경계로 구분합니다. dark 클래스가 다크 테마를 활성화합니다. GSAP 모션은 OS의 reduced-motion을 존중합니다. Dialog와 Sheet는 Radix의 포커스와 키보드 동작을 유지합니다.

Pretendard는 공식 배포 CDN의 CSS를 불러옵니다. 연결이 없으면 시스템 글꼴로 대체됩니다. 배포 시 조직의 폰트 배포 정책에 따라 자체 호스팅할 수 있습니다.

컴포넌트 추가: `npx shadcn@latest add <component>`. 새로운 소스의 기본 크기·색상·접근성 상태를 이 시스템 기준에 맞춰 검토하세요.

## teum 로고

서비스명은 소문자 `teum`, 심볼은 `t.`입니다. `Logo` 컴포넌트와 `public/brand/`의 아웃라인 SVG를 사용합니다. `lib/logo-geometry.json`이 도형 원본이며 `node scripts/export-logo.mjs`로 배포 파일을 생성합니다.

## 형태·스위치·팝업 기준

- `shape="rounded" | "pill"`은 Button·MotionButton·Badge·TabsList에서 색상 variant와 독립적으로 사용합니다. 캡슐형은 `--radius-pill` 토큰으로 통일합니다.
- Switch는 트랙과 실제 버튼 영역을 분리합니다. 기본은 트랙 52×32 / 손잡이 24 / 여백 4px, 작은 크기는 44×26 / 20 / 3px이며 터치 영역은 항상 48px 이상입니다.
- Dialog는 최대 440px, Sheet 하단형은 최대 560px입니다. 공통 패딩 24px, 모서리 24px, 화면 내 스크롤·안전 영역·Escape·포커스 복귀를 지원합니다.
- Dialog는 진입 280ms / 종료 180ms입니다. Sheet의 기본 방향은 bottom이며 화면 아래 `translateY(100%)`에서 420ms로 진입하고 300ms로 내려갑니다. 스크림도 종료 시간에 맞춰 사라집니다. 스위치는 180ms로 전환합니다. GSAP MotionButton은 캡슐형에도 같은 눌림 모션을 제공합니다.
- Button의 스타일 기준은 `data-ui="button"`입니다. Radix의 `asChild`가 `data-slot`을 덮어써도 닫기 버튼의 크기·정렬·모서리가 유지됩니다.

## 확장 공용 컴포넌트

`/#library`에서 14개 계열의 예시를 확인합니다.

- 선택·입력: SearchField, Select, RadioGroup, Slider, ToggleGroup.
- 탐색·목록: BottomNavigation, Pagination, Stepper, ListItem, Avatar.
- 안내·레이어: DropdownMenu, Popover, Toast, EmptyState.

모든 소스는 `components/ui/`에 있으며 갤러리의 상태 예시는 `components/system/component-library.tsx`에 분리했습니다. 선택·검색·페이지 상태를 props로 전달하므로 제품 기능 없이도 재사용할 수 있습니다.

```tsx
<SearchField label="검색" value={query} onValueChange={setQuery} />
<Slider value={range} onValueChange={setRange} thumbLabels={["최솟값", "최댓값"]} />
<Pagination page={page} pageCount={6} onPageChange={setPage} />
<Stepper steps={steps} currentStep={step} />
<BottomNavigation items={items} value={current} onValueChange={setCurrent} />
<EmptyState icon={<Inbox />} title="항목이 없어요" description="첫 항목을 추가해 보세요." action={<Button>추가하기</Button>} />
```

Pagination의 page는 1부터, Stepper의 currentStep은 0부터 시작합니다. Stepper는 steps.length에서 전부 완료됩니다. BottomNavigation의 위치 고정과 실제 라우팅은 호스트가 담당합니다. Toast는 Provider와 Viewport를 한 번 배치하고 open/onOpenChange로 제어합니다. 기본 수동 닫기, F8로 포커스 진입, Escape와 스와이프 닫기를 제공합니다.

이 버전 검수: 프로덕션 빌드·린트, 1280px 데스크톱 및 320/390px 모바일, 라이트·다크, 검색 초기화, 키보드 슬라이더, 단일·복수 선택, 페이지 경계, 단계 완료, 메뉴·팝오버, 토스트 F8/Escape, 시트 진입·종료와 포커스 복귀.
