// 성현회계법인 입사 제출서류 안내 기준 (2026-09 정리)

export const CHECKLIST_TYPE_LABELS: Record<string, string> = {
  GENERAL: "준전문직",
  EXPERIENCED_CPA: "전문직",
  SIMPLIFIED: "계약직",
};

export type DocumentGroup = { category: string; items: string[] };

export const REQUIRED_DOCUMENTS: Record<string, DocumentGroup[]> = {
  GENERAL: [
    {
      category: "사진/인적사항",
      items: [
        "증명사진파일(jpg)",
        "인력프로파일(엑셀)",
        "인사카드(사진첨부, PPT)",
        "주민등록등본 1통(주민번호 전체공개)",
      ],
    },
    {
      category: "동의서·서약서",
      items: [
        "정보보호 및 제공 동의서",
        "서약서(주식)",
        "서약서(소프트웨어)",
        "개인정보이용동의서",
        "독립성 준수 및 감사정보보호 비밀유지 확인서",
      ],
    },
    {
      category: "예탁결제원",
      items: ["한국예탁결제원 실질주주정보 조회 화면 캡쳐"],
    },
    {
      category: "학력/자격/경력",
      items: ["졸업(예정)증명서", "기타 자격증 사본", "경력증명원 및 원천징수부(직전근무지)"],
    },
    {
      category: "건강/급여",
      items: ["건강진단서", "급여입금계좌 통장 사본"],
    },
    {
      category: "재정보증(택1)",
      items: ["재정보증(보증보험 3년 1천만원 이상)", "재정보증서 원본 + 보증인 서류(재산세과세증명서·인감증명서 각1통, 보증인 2인)"],
    },
    {
      category: "해당자만",
      items: ["보훈취업지원대상자/장애인 증명서", "경영성과급 불입 여부 확인서"],
    },
  ],
  EXPERIENCED_CPA: [
    {
      category: "공통",
      items: [
        "증명사진파일(jpg)",
        "인력프로파일(엑셀)",
        "인사카드(사진첨부, PPT)",
        "주민등록등본 1통(주민번호 전체공개)",
        "정보보호 및 제공 동의서",
        "서약서(주식)",
        "서약서(소프트웨어)",
        "개인정보이용동의서",
        "독립성 준수 및 감사정보보호 비밀유지 확인서",
        "한국예탁결제원 실질주주정보 조회 화면 캡쳐",
        "영상정보 수집 이용 동의서",
        "졸업(예정)증명서",
        "건강진단서",
        "급여입금계좌 통장 사본",
        "자격증 사본(합격증, 등록증)",
      ],
    },
    {
      category: "경력자 추가",
      items: [
        "경력증명원 및 원천징수부(직전근무지)",
        "공인회계사 징계사실확인원(한공회 공인인증서 조회)",
        "한공회가입의사확인서",
      ],
    },
    {
      category: "해당자만",
      items: ["보훈취업지원대상자/장애인 증명서", "경영성과급 불입 여부 확인서"],
    },
  ],
  SIMPLIFIED: [
    {
      category: "필수서류",
      items: [
        "정보보호 및 제공 동의서",
        "서약서(주식)",
        "서약서(소프트웨어)",
        "개인정보이용동의서",
        "독립성 준수 및 감사정보보호 비밀유지 확인서",
        "급여입금계좌 통장 사본",
        "주민등록증 또는 운전면허증(신분증) 사본",
        "영상정보촬영기기 영상정보수집 이용동의서",
      ],
    },
  ],
};

export const OFFBOARDING_DOCUMENT_TYPES = ["사직서", "퇴직확인서", "비밀유지서약서", "기타"];

export function getRequiredDocumentItems(checklistType: string | null): string[] {
  if (!checklistType || !(checklistType in REQUIRED_DOCUMENTS)) return [];
  return REQUIRED_DOCUMENTS[checklistType].flatMap((g) => g.items);
}
