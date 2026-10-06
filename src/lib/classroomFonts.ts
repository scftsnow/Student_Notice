export interface ClassroomFont {
  id: string;
  name: string;
  family: string;
  category: "고딕" | "학교/손글씨" | "둥근고딕" | "명조" | "제목";
  desc: string;
}

export const CLASSROOM_FONTS: ClassroomFont[] = [
  // 0. 배달의민족 BM 시리즈 (로컬 내장) — 한나 3종 맨 앞 (목록 순서 유지)
  {
    id: "bm-hanna-pro",
    name: "배달의민족 한나 Pro",
    family: "'BMHANNAPro', sans-serif",
    category: "제목",
    desc: "교실 기본 추천 — 둥글고 또렷한 한나 대표체 (로컬 내장)",
  },
  {
    id: "bm-hanna-11yrs",
    name: "배달의민족 한나 11년",
    family: "'BMHANNA11yrs', sans-serif",
    category: "제목",
    desc: "한나 11주년 기념체 (로컬 내장)",
  },
  {
    id: "bm-hanna-air",
    name: "배달의민족 한나 Air",
    family: "'BMHANNAAir', sans-serif",
    category: "제목",
    desc: "가볍고 시원한 한나 라이트체 (로컬 내장)",
  },
  {
    id: "bm-dohyeon",
    name: "배달의민족 도현",
    family: "'BMDOHYEON', sans-serif",
    category: "제목",
    desc: "굵고 시원한 직선 제목체 (로컬 내장)",
  },
  {
    id: "bm-euljiro",
    name: "배달의민족 을지로",
    family: "'BMEULJIRO', sans-serif",
    category: "제목",
    desc: "을지로 간판 감성의 레트로 제목체 (로컬 내장)",
  },
  {
    id: "bm-euljiro-10yrs",
    name: "배달의민족 을지로 10년후",
    family: "'BMEuljiro10YearsLater', sans-serif",
    category: "제목",
    desc: "을지로 10년후 버전 제목체 (로컬 내장)",
  },
  {
    id: "bm-euljiro-oraeorae",
    name: "배달의민족 을지로 오래오래",
    family: "'BMEuljiroOraeOrae', sans-serif",
    category: "제목",
    desc: "을지로 오래오래 버전 제목체 (로컬 내장)",
  },
  {
    id: "bm-kiranghaerang",
    name: "배달의민족 기랑해랑",
    family: "'BMKIRANGHAERANG', sans-serif",
    category: "학교/손글씨",
    desc: "기랑해랑 손글씨 감성 교실체 (로컬 내장)",
  },
  {
    id: "bm-kkubulim",
    name: "배달의민족 꾸불림",
    family: "'BMKkubulim', sans-serif",
    category: "학교/손글씨",
    desc: "꾸불꾸불 귀여운 손글씨체 (로컬 내장)",
  },
  {
    id: "bm-yeonsung",
    name: "배달의민족 연성",
    family: "'BMYEONSUNG', sans-serif",
    category: "학교/손글씨",
    desc: "부드럽고 정겨운 손글씨체 (로컬 내장)",
  },

  // 1. 고딕 / 기본 본문 (최고 가독성)
  {
    id: "pretendard",
    name: "프리텐다드",
    family: "'Pretendard', sans-serif",
    category: "고딕",
    desc: "현대 웹 표준, 완벽한 자간과 자모 힌팅 (기본 추천)",
  },
  {
    id: "noto-sans-kr",
    name: "본고딕 (Noto Sans KR)",
    family: "'Noto Sans KR', sans-serif",
    category: "고딕",
    desc: "구글·어도비 글로벌 표준 가독성 고딕",
  },
  {
    id: "nanum-square",
    name: "나눔스퀘어",
    family: "'NanumSquare', sans-serif",
    category: "고딕",
    desc: "네이버 대표 직선형 현대 고딕",
  },
  {
    id: "line-seed",
    name: "LINE Seed",
    family: "'LINESeedKR', sans-serif",
    category: "고딕",
    desc: "라인 코퍼레이션 기하학적 본문 서체",
  },

  // 2. 학교 / 초등 판서 특화 (KERIS 학교안심 폰트 - 출처 표기 의무 없음 공식 명시)
  {
    id: "hakgyoansim-allimjang",
    name: "학교안심 알림장",
    family: "'HakgyoansimAllimjang', sans-serif",
    category: "학교/손글씨",
    desc: "초등 알림장과 판서에 최적화된 바른 교실 글씨",
  },
  {
    id: "hakgyoansim-badasseugi",
    name: "학교안심 받아쓰기",
    family: "'SchoolSafeDictation', sans-serif",
    category: "학교/손글씨",
    desc: "저학년 바른 글씨 교육용 또박또박 정자체",
  },
  {
    id: "hakgyoansim-manito",
    name: "학교안심 마니또",
    family: "'HakgyoansimManito', sans-serif",
    category: "학교/손글씨",
    desc: "친근하고 흐트러짐 없는 단정한 손글씨",
  },
  {
    id: "hakgyoansim-boardmarker",
    name: "학교안심 보드마커",
    family: "'HakgyoansimBoardmarker', sans-serif",
    category: "학교/손글씨",
    desc: "칠판 분필 및 화이트보드 마커 판서 감성",
  },
  {
    id: "goyang",
    name: "고양체",
    family: "'Goyang', sans-serif",
    category: "학교/손글씨",
    desc: "사랑스럽고 친근한 고양시 전용 서체 (공공누리 제1유형 무료)",
  },

  // 3. 둥근 고딕 / 부드러운 가독성
  {
    id: "nanum-square-round",
    name: "나눔스퀘어 라운드",
    family: "'NanumSquareRound', sans-serif",
    category: "둥근고딕",
    desc: "장시간 판서에도 눈이 편안한 둥근 서체",
  },
  {
    id: "cafe24-ssurround",
    name: "카페24 써라운드",
    family: "'Cafe24Ssurround', sans-serif",
    category: "둥근고딕",
    desc: "굵고 또렷하여 교실 뒤편에서도 높은 시인성",
  },

  // 4. 명조 / 온화한 정통체
  {
    id: "maru-buri",
    name: "마루 부리",
    family: "'MaruBuri', serif",
    category: "명조",
    desc: "디지털 화면에 최적화된 온화한 명조",
  },
  {
    id: "noto-serif-kr",
    name: "본명조 (Noto Serif KR)",
    family: "'Noto Serif KR', serif",
    category: "명조",
    desc: "격조 높고 차분한 정통 명조체",
  },

  // 5. 제목 / 디스플레이
  {
    id: "gmarket-sans",
    name: "Gmarket Sans",
    family: "'GmarketSansMedium', sans-serif",
    category: "제목",
    desc: "선명하고 시원시원한 직선 제목체",
  },
  {
    id: "bm-jua",
    name: "배달의민족 주아",
    family: "'BMJUA', sans-serif",
    category: "제목",
    desc: "둥글둥글 친근하여 초등 교실 인기 서체 (로컬 내장)",
  },
];

export const DEFAULT_CLASSROOM_FONT =
  CLASSROOM_FONTS.find((f) => f.id === "nanum-square-round") ?? CLASSROOM_FONTS[0]; // 나눔스퀘어 라운드 (기본값, 목록 순서는 한나 맨 앞 유지)

export function getFontFamilyById(id: string): string {
  const font = CLASSROOM_FONTS.find((f) => f.id === id || f.family === id || f.name === id);
  return font ? font.family : "'Pretendard', sans-serif";
}
