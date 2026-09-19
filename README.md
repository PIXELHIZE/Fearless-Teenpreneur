This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Google 캘린더 연동

이 앱에서 만든 일정을 Google 기본 캘린더로 자동으로 보냅니다. **단방향입니다** —
이 앱 → Google. Google 캘린더에서 직접 만들거나 고친 일정은 이 앱으로 내려오지 않습니다.

설정하지 않아도 캘린더는 그대로 동작합니다. 사이드바에 연결 버튼만 표시됩니다.

### 방식: Google 계정으로 스크립트를 한 번 배포합니다

Google Cloud Console 등록도, OAuth 클라이언트 ID도, API 키도 필요 없습니다.
본인 Google 계정으로 Apps Script를 배포하면 그 스크립트가 **본인 자격으로** 실행되고,
이 앱은 배포 주소로 요청만 보냅니다. 만료되는 토큰이 없어 한 번 설정하면 계속 동작합니다.

### 설정 절차 (5분, 1회)

1. <https://script.google.com> 에 **본인 Google 계정으로 로그인** → **새 프로젝트**
2. 이 저장소의 [`public/google-apps-script.gs`](public/google-apps-script.gs) 내용을
   전부 복사해, 편집기에 있던 기본 코드를 **지우고** 붙여넣습니다.
   (앱을 실행 중이라면 사이드바의 "스크립트 코드 받기" 링크로도 내려받을 수 있습니다.)
3. 저장(💾) → 오른쪽 위 **배포 → 새 배포**
4. 톱니바퀴(⚙️) → **웹 앱** 선택. 설정은 이렇게 합니다:
   - **다음 사용자로 실행**: `나`
   - **액세스 권한이 있는 사용자**: `모든 사용자`
     ← 이 값이어야 브라우저에서 요청을 보낼 수 있습니다
5. **배포** → 권한 승인 창이 뜨면 계정을 고르고 승인합니다.
   "이 앱은 확인되지 않았습니다" 경고가 나오면 **고급 → (프로젝트 이름)(으)로 이동**을
   누르세요. 본인이 방금 만든 스크립트이므로 문제없습니다.
6. 나온 **웹 앱 URL**(`https://script.google.com/macros/s/.../exec`)을 복사합니다.
7. 앱 사이드바 아래 **"📆 Google 캘린더 연결"** → URL을 붙여넣고 **연결**.
   연결에 성공하면 캘린더 이름이 표시됩니다.

> **이 URL은 비밀번호와 같습니다.** 아는 사람은 누구나 회원님 캘린더에 일정을 쓸 수
> 있으니 공유하지 마세요. 한 겹 더 두르고 싶다면 스크립트 맨 위의
> `const SECRET = '';` 에 아무 문자열이나 채우고, 앱의 "비밀 값" 칸에 똑같이 적으세요.

스크립트를 고친 뒤에는 **배포 → 배포 관리 → 편집(✏️) → 버전: 새 버전 → 배포**를 해야
반영됩니다. 이렇게 하면 URL은 그대로라 앱 설정을 다시 할 필요가 없습니다.

### 동작 방식과 한계

- 일정이 바뀌면 약 1.2초 뒤, 마지막으로 보낸 상태와 비교해 **달라진 것만** 보냅니다.
  타이핑 한 글자마다 요청이 나가지 않습니다. 여러 건은 한 요청에 묶어 보냅니다.
- 연결 **전에** 만들어 둔 일정도 연결 시점에 한꺼번에 올라갑니다.
- 모든 일정은 Google **기본 캘린더** 한 곳에 모입니다. 어느 캘린더 소속인지는 제목 앞의
  `[캘린더이름]`과 색으로 구분합니다. Google 이벤트 색은 11가지로 고정돼 있어, 이 앱의
  색과 가장 가까운 것으로 근사합니다.
- 시간은 브라우저 시간대로 해석해 절대 시각으로 보냅니다. `23:00–24:00`처럼 자정에
  닿는 일정도 다음 날 `00:00`으로 올바르게 올라갑니다.
- 오프라인이면 멈췄다가 온라인 복귀 시 자동으로 이어서 보냅니다. 실패한 작업은 다음
  비교에서 다시 잡히므로 유실되지 않습니다.
- Google 캘린더에서 일정을 직접 지워도, 이 앱에서 그 일정을 고치면 다시 만들어집니다.
  단방향 동기화의 당연한 결과입니다 — 기준은 언제나 이 앱입니다.
- **알려진 한계: 이 앱을 여러 탭에 동시에 열어 두면 같은 일정이 Google에 중복 생성될 수
  있습니다.** 탭 간 조정은 구현하지 않았습니다. 한 탭에서만 쓰는 것을 권합니다.
- "해제"를 눌러도 이미 Google에 올라간 일정은 지우지 않습니다. 로컬 일정과 Google 일정의
  대응 관계도 남겨 둡니다 — 지우면 다시 연결할 때 전부 중복으로 올라갑니다.
- Apps Script에는 하루 실행 횟수 등 무료 할당량이 있습니다. 개인용 일정 규모에서는
  닿을 일이 없지만, 대량 일괄 업로드가 막히면 잠시 후 자동으로 재시도합니다.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
