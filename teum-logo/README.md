# teum · Logo system

서비스명은 **teum**, 기본 표기는 모두 소문자입니다. `t.`는 작은 면에서도 쓰는 심볼이며, 정식 서비스명에 점을 붙이지 않습니다.

`t`의 직선과 둥근 아랫부분, 분리된 점을 핵심 형태로 사용했습니다. `teum` 워드마크도 동일한 획과 곡선의 느낌으로 직접 구성했습니다. 모든 로고 SVG는 텍스트를 포함하지 않는 아웃라인이므로 설치된 폰트와 관계없이 동일하게 표시됩니다. 안내 보드의 설명 글자만 일반 텍스트입니다.

## 파일

| 파일 | 사용 |
|---|---|
| teum-logo-primary.svg | 블루 심볼 + 블랙 워드마크. 흰 배경의 기본 조합 |
| teum-logo-black.svg | 검정 단색 조합 |
| teum-logo-white.svg | 어두운 배경의 흰색 조합 |
| teum-wordmark-black.svg | teum 워드마크 단독 |
| teum-wordmark-white.svg | 어두운 배경의 워드마크 단독 |
| teum-symbol-blue.svg | 기본 앱·프로필 아이콘 |
| teum-symbol-black.svg | 검정 앱·프로필 아이콘 |
| teum-symbol-transparent.svg | 배경 없는 검정 t. 심볼 |
| teum-app-icon-1024.png | 1024px 앱 아이콘 시안, 투명 모서리 포함 |
| teum-logo-primary.png | 투명 배경의 1624 × 400px 기본 로고 |
| teum-logo-board.png / svg | 전체 로고 사용 예시 |

## 사용 규칙

- 대표색 `#315EFF`, 검정 `#111113`, 흰색 `#FFFFFF`.
- 심볼의 바깥 사각형 높이를 H라 할 때 주변에 최소 H/4의 보호 여백을 둡니다. 워드마크 단독은 전체 SVG 높이를 기준으로 동일한 여백을 적용합니다.
- 심볼 권장 최소 크기 24 × 24px. 16px 브라우저 favicon은 작은 크기의 예외입니다.
- 조합형 로고는 높이 30px 이상, 워드마크 단독은 너비 80px 이상을 권장합니다.
- 비율·글자 간격·점 위치·모서리를 개별적으로 바꾸지 않습니다. 늘이기, 외곽선, 그림자, 그라디언트는 사용하지 않습니다.
- 흰색 배경에는 기본형·검정형, 어두운 배경에는 흰색형을 사용합니다. 사진 위에서는 충분한 단색 면과 여백을 확보합니다.
- 로고 자체의 등장 모션은 전체 불투명도 변화까지만 권장합니다. 점을 떼어 반복해서 움직이거나 글자별로 흔들지 않습니다.

## 개발

`components/system/logo.tsx`의 `Logo`를 사용합니다. 도형 원본은 `lib/logo-geometry.json` 한 곳에서 관리합니다.

```tsx
<Logo variant="lockup" />
<Logo variant="symbol" />
<Logo variant="wordmark" tone="inverse" />
```

인접 텍스트가 이미 이름을 전달하는 경우 `decorative`를 지정하고, 단독 로고는 기본 접근성 이름 `teum`을 유지합니다. 도형 변경 후 프로젝트 루트에서 `node scripts/export-logo.mjs`를 실행하면 SVG·PNG·favicon을 다시 만듭니다.
