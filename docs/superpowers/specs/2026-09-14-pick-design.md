# 뽑기 메뉴 설계 스펙 (2026-09-14)

## 1. 개요

- 위치: 상단 내비(`Navbar`)에 `뽑기` 메뉴 추가 (`/picks`)
- 하위 4종: 학생 뽑기 / 순서 뽑기 / 모둠 뽑기 / 자리 뽑기
- 데이터 소스 (2026-09-14 실측 확정): `useClassroomState` 실명단 (localStorage `classroom_os_state_v3`)
  - prisma `Student` 테이블이 아님! 명단·업무 페이지는 전부 로컬 교실 상태를 사용.
  - 학생 식별 키는 이름 (명단에서 이름 중복 등록 불가). `toPickStudents`로 변환.
- 저장 정책 (2026-09-14 확정):
  - 저장함: 자리 틀(`SeatLayout`), 자리 배치 결과(`SeatAssignment`), 모둠 결과(`GroupSet`)
  - 저장 안 함: 학생 뽑기·순서 뽑기 결과 (세션 상태만)
  - 서버 반영: 순서 뽑기 → 로컬 학생 업무 순서 적용 (`updateRoutineOrder`, 이름 배열)
- 코딩 컨벤션 준수: `any` 금지, Server/Client 분리, `ActionResult` 패턴, `PascalCase` 컴포넌트

## 2. 공통 기반

### 2.1 대상 선택기 (`PickTargetSelector`)
- 전체 선택 / 해제, 개별 체크, 검색(이름/번호)
- 결석자 처리 (2026-09-14 실측): 명단에 결석 개념이 없어 전원 대상
  - 제외하고 싶은 학생은 직접 체크 해제 (결석은 당번 대타/건너뛰기로 일별 처리하는 기존 구조 유지)
  - 순서·모둠·자리 모두 동일 규칙, 예외 없음
- 성별 필터는 각 뽑기 설정에서 별도 처리
- 선택 인원 실시간 표시 (`선택 24/28명`)

### 2.2 뽑기 연출 창 (`DrawOverlay`)
- 모든 뽑기에 공통 사용, 전체화면 오버레이 모달
- 구성: 대상 카드 롤링 → 감속 → 확정 → 컨페티
- 소리: `src/lib/pickSound.ts` (아래 2.4 효과음 조사 결과 반영)
- 음소거 토글(기본 ON, 선택 localStorage 유지), 다시 뽑기, 닫기, 결과 복사 버튼
- 전자칠판 가독성: 결과 글자 42px 이상 스케일 대응
- 접근성: ESC 닫기, 스페이스 다시 뽑기
- 자동재생 정책 대응: `뽑기 시작` 버튼 클릭 시 `AudioContext.resume()` 호출 필수

### 2.4 효과음 조사 결과 (2026-09-14)

조사 대상: Web Audio 합성 / 외부 mp3 파일 / Howler.js 래퍼.

- 참고 사례
  - `classtools.net` random-name-picker: 슬롯머신 사운드 ON/OFF 토글 제공 (연출+소리 조합이 교실 표준 패턴)
  - `pinkylam.me` random-name-picker: 외부 파일 없이 `AudioContext` API로 직접 효과음 생성 (우리가 가려는 방식과 동일, 검증된 패턴)
  - `howler.js` (25k stars, MIT, gzip 7KB): Web Audio + HTML5 Audio 폴백 표준 래퍼
- 외부 mp3의 문제점
  - 무료 슬롯 효과음 대부분 CC BY-NC(비상업) 라이선스 → 교실 앱에 부적합
  - Mixkit 등 상업 허용 소스도 귀속·버전 관리 부담 + 오프라인/Electron portable에서 파일 누락 위험
  - 이 프로젝트는 Electron portable(`electron-builder.json`에서 `public/`을 standalone에 포함)로 오프라인 동작이 전제 → CDN 의존 불가
- 결론: Phase 1은 외부 파일·의존성 없이 네이티브 Web Audio 합성으로 구현
  - `OscillatorNode` + `GainNode` 엔벨로프만으로 6종 합성 (50~100줄 내외)
  - 롤링 틱(가속→감속 피치 상승), 단일 공개 팝, 최종 팡파레(아르페지오), 버튼 클릭, 에러 버즈, 음소거
  - 라이선스 리스크 0, 오프라인 보장, 빌드 크기 증가 0
- Phase 2(선택): `public/sounds/*.mp3` + Howler 도입, 파일 없으면 합성음으로 폴백하는 구조로 확장 가능
  - `public/`은 이미 standalone에 포함되므로 Electron에서도 동작
  - 필요 시점에 교사 업로드(커스텀 효과음) 기능으로 연결 가능

### 2.3 랜덤 유틸 (`src/lib/pickRandom.ts`)
- `shuffle<T>(arr, rng)`, `sampleWithoutReplacement`, `sampleWithReplacement`
- 시드 RNG는 선택 사항 (기본 `Math.random`, 교사 몰래 고정과 충돌 방지)

## 3. 학생 뽑기 (`StudentPick`)

목적: 발표자, 심부름 등 N명 추첨.

- 입력
  - 뽑는 명수 `count` (1 ~ 선택 인원)
  - 여러 회차 뽑기: 회차 수 `rounds` (기본 1)
  - 회차 간 중복 허용 여부 `allowDuplicateAcrossRounds` (기본 false)
  - 한 회차 내 중복은 항상 불가
- 동작
  - 중복 불가 + `count * rounds > 선택인원` 이면 실행 차단 + 에러 문구
  - 중복 허용이면 매 회차 독립 추첨
- 결과 뷰: 회차별 리스트 (회차1: 3번 김OO …), 전체화면 연출 후 확정
- 이력: 세션 내 회차 이력만 유지, DB 저장 없음

## 4. 순서 뽑기 (`OrderPick`) — 학생 업무 연동

목적: 청소 순서, 발표 순서 등 줄 세우기.

- 입력
  - 대상 업무 선택 (기존 `Routine` 목록 드롭다운, 선택 안 함도 가능)
  - 대상 학생 선택 (공통 선택기)
- 동작
  - 선택 학생 전체를 셔플해 1번~N번 순서 생성
  - 연출 창으로 한 명씩 공개 (순차 공개 모드)
- 업무 연동 (2026-09-14 실측: 로컬 업무 기준)
  - 업무를 선택한 경우에만 `적용` 버튼 노출
  - 적용 시 `useClassroomState.updateRoutineOrder(routineId, 이름배열)` 호출 (prisma 아님)
  - 선택 학생을 뽑힌 순서대로 + 선택 밖 학생은 기존 순서 그대로 뒤에 유지
  - 로컬 즉시 반영 + 토스트, revalidate 불필요
  - 덮어쓰기 전 확인 문구 노출

## 5. 모둠 뽑기 (`GroupPick`)

목적: 모둠 활동 조 편성.

- 입력
  - 방식 A: 전체 통일 — 모둠 수 또는 모둠당 인원 중 하나 지정
  - 방식 B: 각 모둠별 별도 — 예: `4,4,5,3` 직접 입력, 합계 = 선택 인원 검증
  - 성별 모드: 무관 / 분리(남녀 균등 분산)
  - 남녀 분리 시 남녀 인원 불균형이면 최대한 균등 + 잔여 랜덤 배정
- 동작
  - Fisher-Yates 셔플 후 스네이크 분배 (실력 편중 방지용 단순 순차 분배가 아닌 라운드로빈)
  - 성별 분리 모드: 남/여 그룹별 셔플 후 각 모둠에 비율대로 분배
- 결과 뷰: 모둠별 카드 그리드, 드래그로 학생 이동(수동 조정), 다시 섞기
- 저장 (2026-09-14 확정, 이름 기반): `GroupSet` 테이블에 저장
  - 저장 내용: 이름, 모드(통일/개별), 성별 모드, 모둠별 학생 이름 배열
  - 불러오기 시 명단에 없는 이름은 제외하고 안내 (전학/삭제 대응)
  - UI: 이름 입력 + `저장` 버튼, 저장 목록 드롭다운 (불러오기/삭제/덮어쓰기)

### 5.1 학생 명단 성별 설정 (2026-09-14 실측)
- 실명단(`ClassroomStudent`)에는 성별이 없었음 → `gender?: "남" | "여"` 필드 신규 추가
- `StudentTab` 학생 카드에 ♂/♀/· 순환 버튼 추가 (`updateStudentGender` 액션)
- localStorage + DB 스냅샷에 배열 통째로 저장되므로 자동 persist, 기존 데이터는 미지정 취급
- 목록 성별 필터는 추가하지 않음 (사망 코드인 prisma 기반 관리 화면과 무관)
- 값 정규화: `남`/`여` 외 값은 클라이언트에서 무관 취급

## 6. 자리 뽑기 (`SeatPick`) — 스펙 추천안

교사 실제 사용 흐름을 기준으로 추천.

### 6.1 기본 생성 흐름 (추천)
1. 분단 수 `divisions` (예: 3), 분단당 열수 `colsPerDivision` (예: 2) 지정
2. 뒷줄부터 채우기 vs 앞줄부터 채우기 선택 (기본: 뒷줄부터)
3. 선택 인원수에 맞춰 행수 자동 계산: `rows = ceil(인원 / (분단수*열수))`
4. 빈자리는 뒷문/앞문 쪽부터 빈자리로 남김
5. `자리 생성` 클릭 → 빈 자리 그리드 생성
6. `랜덤 배치` 클릭 → 연출 후 학생 배치

### 6.2 자리 셀 상호작용
- 좌클릭: 열고/닫기 토글 (닫힌 자리는 배치 제외, 회색 처리, 인원 계산에서 제외)
- 우클릭(또는 길게 누르기): 성별 지정 순환 (`지정없음 → 남 → 여`)
  - 성별 지정 자리는 해당 성별 학생만 배치
- 드래그: 자리 ↔ 자리 교환, 학생 카드 → 자리로 직접 배치
- 교탁, 칠판 방향 표시 고정 (앞/뒤 구분)

### 6.3 몰래 고정 배치 (랜덤인 척)
- 요구사항 핵심: 교사만 아는 고정 배치
- 방식
  - 좌측 미배치 학생 풀에서 학생 카드를 자리 셀로 드래그해 `고정` 상태로 지정
  - 일부 고정 또는 전체 고정 모두 가능
  - `랜덤 배치` 실행 시 고정 자리는 유지, 나머지 자리만 셔플
  - 연출 창에서는 고정 여부가 드러나지 않음 (전체 랜덤인 것처럼 연출)
  - 고정 해제 버튼 (개별 + 전체 해제)
- 고정 표시 정책 (2026-09-14 확정): 기본 숨김
  - `고정 표시` 교사 토글 기본 OFF → OFF면 자물쇠 배지·고정 목록 모두 렌더링하지 않음 (DOM에도 남기지 않음)
  - ON일 때만 호버 배지 + 고정 목록 패널 표시
  - 연출 오버레이에서는 토글 상태와 무관하게 항상 숨김

### 6.4 성별 고려 배치
- 모드: 무관 / 남녀 짝꿍 우선 / 남녀 분리(분단 분리 아님, 인접 최소화)
- 기본 추천: `남녀 짝꿍 우선`을 기본값으로 두지 않고 `무관`을 기본, 교사가 선택
- 성별 미지정 학생은 제약 없이 배치
- 자리 셀 성별 지정이 우선순위 1, 전역 성별 모드가 우선순위 2

### 6.5 상태 모델 (클라이언트)
```typescript
type SeatCell = {
  id: string;
  row: number;
  col: number;
  division: number;
  enabled: boolean;
  lockedGender: "남" | "여" | null;
  fixedStudentId: string | null;
  studentId: string | null;
};
type SeatConfig = {
  divisions: number;
  colsPerDivision: number;
  fillFrom: "front" | "back";
  genderMode: "ignore" | "pair" | "separate";
};
```

### 6.7 자리 저장 (틀 / 배치 결과 분리 저장, 2026-09-14 확정, 이름 기반)
- 학생 식별은 이름 (명단 이름 중복 불가). 셀의 `studentId`/`fixedStudentId` 자리에 이름 저장
- 틀 저장(`SeatLayout`): 이름, `SeatConfig`, 셀 틀 정보만 (`enabled`, `lockedGender`, 행/열/분단 구조)
  - 학생 배치(`studentId`, `fixedStudentId`)는 저장하지 않음 → 새 학기·새 반에 틀 재사용 가능
- 배치 결과 저장(`SeatAssignment`): 이름, 사용된 `SeatConfig` 스냅샷, 셀별 이름 배치 스냅샷
  - `namesJson` 컬럼은 미사용(`"{}"` 저장, 하위호환 유지)
  - 불러오기 시 명단에 없는 이름의 배치는 비우고 안내 (`loadCellsForRoster`)
  - `layoutId` nullable로 틀과 연결 유지 (틀이 삭제돼도 결과는 유지)
- UI
  - 틀 바: 틀 이름 입력 + `틀 저장`, 틀 목록 (불러오기/삭제)
  - 결과 바: 결과 이름 입력(기본 `M월 d일 자리`) + `배치 저장`, 결과 목록 (불러오기/삭제/덮어쓰기)
  - 불러온 틀에 현재 인원이 안 맞으면 경고 후 행수 자동 재계산 제안

### 6.6 배치 알고리즘
1. 고정 배치(`fixedStudentId`) 먼저 확정
2. 사용 가능 자리 = `enabled` 자리 − 고정 자리
3. 남은 학생 셔플
4. `lockedGender` 자리 우선 충족 (남자리→남학생, 여자리→여학생)
5. 나머지 자리에 `genderMode` 적용
   - `pair`: 남녀 교대 배치 시도
   - `separate`: 같은 성별 인접 최소화 (그리디)
   - `ignore`: 순수 셔플
6. 자리 수 > 학생 수면 빈자리 유지, 학생 수 > 자리 수면 경고 후 실행 차단

## 7. 라우팅 / 파일 구조 (추천)

- `src/app/picks/page.tsx` (Server: 저장된 틀/배치/모둠 목록만 조회. 학생·업무는 클라이언트가 실명단에서 직접 읽음)
- `src/components/picks/PicksPageClient.tsx` (탭 전환 + `useClassroomState` 연결)
- `src/components/picks/PickTargetSelector.tsx`
- `src/components/picks/DrawOverlay.tsx` (애니메이션 + `pickSound` 재생)
- `src/components/picks/SaveBar.tsx` (이름 입력 + 저장 + 목록 공용 바)
- `src/components/picks/StudentPickPanel.tsx`
- `src/components/picks/OrderPickPanel.tsx`
- `src/components/picks/GroupPickPanel.tsx`
- `src/components/picks/SeatPickPanel.tsx` (+ `SeatGrid.tsx`, `StudentPool.tsx`)
- `src/lib/pickRandom.ts`
- `src/lib/pickSound.ts` (Web Audio 합성 효과음, 의존성 없음)
- `prisma/schema.prisma`에 3개 모델 추가 (아래 7.1)
- `src/app/pickActions.ts`에 저장 액션만 (`save/delete × 3종`. 목록 조회·순서 적용은 불필요해 삭제)
  - 목록 조회: `/picks` Server Component 직접 조회 / 순서 적용: `updateRoutineOrder` 훅 호출
- `Navbar`에 `/picks` 링크 추가 (Sparkles 또는 Dices 아이콘)

### 7.1 Prisma 모델 (SQLite, 2026-09-14 확정)

```prisma
model SeatLayout {
  id              String   @id @default(cuid())
  name            String
  divisions       Int
  colsPerDivision Int
  fillFrom        String   @default("back")
  cellsJson       String   // 틀 셀 배열 (enabled, lockedGender, row/col/division)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model SeatAssignment {
  id          String   @id @default(cuid())
  name        String
  layoutId    String?
  configJson  String   // 사용된 SeatConfig 스냅샷
  cellsJson   String   // 셀별 studentId + fixedStudentId 스냅샷
  namesJson   String   // 학생 이름 스냅샷 (id → 이름)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model GroupSet {
  id         String   @id @default(cuid())
  name       String
  mode       String   // "uniform" | "custom"
  genderMode String   // "ignore" | "separate"
  groupsJson String   // 모둠별 학생 id 배열
  namesJson  String   // 학생 이름 스냅샷 (id → 이름)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

### 7.2 서버 액션 (컨벤션의 `ActionResult` 패턴 준수)
- `saveSeatLayout / deleteSeatLayout`
- `saveSeatAssignment / deleteSeatAssignment`
- `saveGroupSet / deleteGroupSet`
- 목록 조회는 `/picks` Server Component에서 직접 prisma 조회 (액션 불필요)
- 순서 적용은 로컬 훅 `updateRoutineOrder` 호출 (서버 액션 불필요)

## 8. 검증 계획

- `npm run check:conventions`, `npx tsc --noEmit`
- `npx prisma validate` (모델 추가 후), dev 서버에서 마이그레이션 확인 (`prisma db push`)
- 수동 검증: 각 뽑기 정상/경계 케이스
  - 0명 선택, 1명 선택, count 초과, 모둠 합계 불일치, 자리 부족
  - 자리 틀 저장→불러오기→배치→결과 저장→불러오기 왕복
  - 모둠 저장→삭제된 학생이 있을 때 이름 스냅샷으로 표시되는지
- 3001 포트 dev 서버에서 `/picks` 렌더 + 연출 + 소리 확인 (소리 ON/OFF, 자동재생 정책)
- 순서 뽑기 적용 후 `/routines` 순서 반영 확인

## 9. 미결정 / 확인 필요 (2026-09-14 업데이트)

1. ~~자리·모둠 결과를 DB에 저장할지~~ → 저장으로 확정 (`SeatLayout`/`SeatAssignment`/`GroupSet`)
2. ~~순서 뽑기 적용 시 결석자 처리~~ → 실측 결과 명단에 결석 개념이 없어 폐기. 전원 대상 + 직접 체크해제로 대체
3. ~~자리 고정 아이콘 노출~~ → 기본 숨김 + `고정 표시` 토글로 확정
4. ~~효과음~~ → Phase 1 Web Audio 합성으로 확정, Phase 2 mp3+Howler 확장 가능 구조
5. 저장 목록 상한 (예: 틀 20개, 결과 50개) 필요 여부 — 구현 시 기본 무제한 + 삭제 UI로 시작 제안
6. 학생 뽑기·순서 뽑기 결과도 나중에 저장 필요해지면 `PickHistory` 테이블 추가 검토
