# AGENTS.md — Student_Notice 병렬 작업 규약

여러 세션/서브에이전트가 동시에 작업한다. 충돌이 나면 작업물이 날아간다.
아래를 지키지 않은 편집은 되돌려진다.

## 0. 프로젝트 고정값

- Stack: Next.js 14 App Router, React 18, TS, Tailwind. Dev 포트 **3001 고정**.
- 상태: `useClassroomState` + localStorage `classroom_os_state_v3` + BroadcastChannel.
- 작업 디렉토리: `C:\Users\ADMIN\Desktop\Student_Notice`
- 서버 시작: 바탕화면 `ClassroomOS` 바로가기 (백그라운드). 개발 중이면 `npm run dev`.

## 1. 담당 구역 (subagent 소유권 — 아키텍처 레이어 기준)

| 에이전트 | 레이어 | 구역 | 절대 침범 금지 |
|---|---|---|---|
| frontend | UI | `src/components/**/*`, `src/app/**` 페이지 렌더 | state 훅 내부, infra |
| state-data | 상태·데이터 | `src/hooks/*`, `src/types/*`, 상태계 `src/lib/*` | UI 컴포넌트, infra |
| app-infra | 앱·인프라 | layout/route/server actions, prisma, electron, scripts, css | UI 컴포넌트, state 훅 내부 |
| verify | 검증 | 읽기·실행만 (edit 금지) | 모든 수정 |

구역 밖 파일을 건드려야 하면 먼저 사용자에게 보고하고 승인받는다.

## 2. 충돌 방지 (병렬 서브에이전트용)

1. 구역 소유권(§1)이 1순위. 경계 넘는 수정은 오케스트레이터 승인 후.
2. 작업 시작 시 `STATUS.md`에 `진행중` + **편집 예정 파일**을 먼저 기록(선점).
   선점된 id·파일은 다른 실행이 건너뛴다.
3. 편집 전 `git status --short`, `git diff --stat` 확인. 남이 dirty로 만든
   파일은 절대 편집 금지.
4. 같은 파일을 두 실행이 동시에 편집 금지. 같은 파일이 필요하면 순차 큐로 변경.

## 3. Git 운용 (1인 + 병렬)

- 평소엔 `main` 직접 작업, 브랜치 생략. 날릴 위험 큰 실험만 `feat/<내용>`.
- **커밋은 오케스트레이터가 순차 수행** (작업자는 절대 커밋 금지).
  작업 완료 → verify 통과 → 오케스트레이터가 커밋 (`type: 한글 요약`).
- 푸시는 백업용으로 하루 마무리 또는 지시 시에만.
- 병렬 체크아웃(worktree)은 같은 파일 충돌이 불가피할 때만 예외 사용.
  worktree용 dev 포트는 3002번대.

## 4. 검증 (verify 에이전트에 위임 가능)

- `npx tsc --noEmit` — 신규 에러 0개.
- `http://localhost:3001`, `/picks`, `/picks/window`, `/economy/board` — 200.
- 프로덕션 빌드(`npm run build`)는 구조 변경 시에만.
- `npm`/`node` 실행은 프로젝트 루트에서만. `.opencode/` 내부에서 npm 실행 금지
  (플러그인 산출물이 `.opencode/node_modules`로 생기는 원인).

## 5. 보고 형식

- 변경 파일 `경로:줄번호`, 동작 확인법(브라우저 눈으로 볼 지점).
- 근거 없는 확신 금지. 파일 읽어서 확인한 사실만 보고.
- 이모지 코드/커밋 금지. 사용자와의 소통은 출력 텍스트로만 (bash·코드로 대화 금지).
