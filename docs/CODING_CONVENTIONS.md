# 학급 알림장 시스템 표준 코딩 컨벤션 규칙 사양서 (Coding Conventions)

본 문서는 프로젝트의 유지보수성, 타입 안전성, 런타임 안정성을 보장하기 위해 모든 코드베이스에 강제되는 공식 표준 코딩 컨벤션 규칙을 정의합니다. `npm run check:conventions` 검사기를 통해 자동으로 준수 여부가 검증됩니다.

---

## 1. TypeScript & 타입 안전성 규칙 (Strict Type Safety)

### 1.1 `any` 타입 사용 완전 금지 (Zero `any` Policy)
- **규칙**: 코드베이스 내 명시적 또는 암시적 `any` 키워드(`: any`, `<any>`, `as any`) 사용을 전면 금지합니다.
- **대체 방안**:
  - 타입을 미리 알 수 없는 동적 데이터는 `unknown`을 사용하고, 타입 좁히기(Type Narrowing, `typeof`, `instanceof`, 타입 가드 함수)를 거쳐 사용합니다.
  - 외부 API 및 사용자 입력 데이터는 `@/types/index.ts`에 선언된 정적 인터페이스 또는 Zod 스키마를 통해 검증 후 수신합니다.

### 1.2 명시적 인터페이스 선언 (Explicit Interfaces)
- 컴포넌트의 `Props`, 훅의 반환값, 공통 도메인 모델은 반드시 명시적인 `interface` 또는 `type`으로 정의합니다.
- 인터페이스 명명 시 C# 스타일의 접두사 `I` 사용을 금지합니다. (예: `IStudent` ❌ $\rightarrow$ `Student` ⭕)

### 1.3 불변성(Immutability) 유지
- 상태 변경 시 원본 객체나 배열을 직접 수정(`mutate`)하지 않고, 전개 연산자(`...`) 또는 불변 함수(`map`, `filter`)를 활용합니다.

---

## 2. 네이밍 규칙 (Naming Conventions)

| 대상 | 표기법 | 예시 |
| :--- | :--- | :--- |
| **React 컴포넌트 파일 & 함수** | `PascalCase` | `DashboardClient.tsx`, `DailyCheckInModal.tsx` |
| **타입 / 인터페이스 / Enum** | `PascalCase` | `Student`, `DailyRoutineAssignment`, `ClassSetting` |
| **일반 변수, 함수, 메서드, 파라미터** | `camelCase` | `studentNumber`, `handleBatchApprove`, `formatDate` |
| **전역 상수, 환경변수 키** | `UPPER_SNAKE_CASE` | `DEFAULT_TAX_RATE`, `MAX_TITLE_LENGTH` |
| **유틸리티 파일, 라이브러리 모듈** | `camelCase` 또는 `kebab-case` | `scheduler.ts`, `holidays.ts`, `prisma.ts` |
| **CSS 클래스명** | Tailwind 표준 또는 `kebab-case` | `text-slate-800`, `notice-img` |

---

## 3. Next.js 14 App Router & React 아키텍처 규칙

### 3.1 Server Component vs Client Component 분리
- **기본 원칙**: 모든 페이지(`page.tsx`)와 정적 컨테이너는 Server Component로 작성하여 데이터베이스(`prisma`)를 서버에서 직접 쿼리합니다.
- **클라이언트 지시문**: 상태(`useState`), 생명주기(`useEffect`), 브라우저 이벤트(`onClick`)가 필요한 대화형 UI에 한해서만 파일 최상단에 `"use client";`를 선언합니다.

### 3.2 React Hooks 의존성 무결성 (Hooks Integrity)
- `useEffect`, `useCallback`, `useMemo` 사용 시 참조하는 모든 외부 변수/함수를 의존성 배열에 충실히 등록하여 메모리 누수 및 클로저 참조 왜곡을 방지합니다.

---

## 4. 서버 액션(Server Actions) 및 에러 처리 규칙

### 4.1 에러 반환 패턴 (Error as Data)
- 사용자 대면 서버 액션(`src/app/actions.ts`) 내부에서 일반적인 비즈니스 예외 발생 시 치명적 크래시를 유발하는 `throw new Error()` 대신 구조화된 결과 객체를 반환합니다:
  ```typescript
  type ActionResult<T> = 
    | { success: true; data: T }
    | { success: false; error: string };
  ```
- 클라이언트 컴포넌트에서는 반환된 `success` 플래그를 점검하여 사용자 피드백(알림, 토스트)을 제공합니다.

---

## 5. UI/UX 및 디자인 시스템 규칙

### 5.1 시각적 군더더기 배제 (Zero Visual Clutter)
- 교사가 작동 원리를 이미 파악할 수 있는 불필요한 메타 설명 문구("구역 분할 뷰", "우측 실시간 송출 중", "직접 타자 수정" 등)를 UI 상단에 노출하지 않습니다.
- 컴포넌트 목적을 직관적으로 드러내는 명사형 헤더([알림장], [전달사항], [미리보기])만 간결하게 배치합니다.

### 5.2 반응형 및 전자칠판 최적화
- 기본 글자 크기는 교실 뒤편에서도 가독성을 확보할 수 있도록 학생 칠판 화면 기준 **42px** 스케일을 표준으로 준수합니다.

---

## 6. 자동 검증 시스템 실행 명령어

```bash
# 1. 코딩 컨벤션 및 정적 품질 종합 점검
npm run check:conventions

# 2. TypeScript 타입 체크 단독 실행
npm run check:types

# 3. Next.js Core Web Vitals 린트 단독 실행
npm run lint

# 4. 종합 점검 파이프라인
npm run check:all
```
