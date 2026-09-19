// 기본학습 콘텐츠 데이터 (OX 퀴즈 / 카드 뒤집기 / 따라쓰기 / 따라말하기)

export const oxQuestions = [
  {
    id: 'ox-1',
    question: '"안녕하세요"는 처음 만난 사람에게 쓰는 인사말이다.',
    answer: true,
    explain: '"안녕하세요"는 때와 상대를 가리지 않고 쓰는 기본 인사말입니다.',
  },
  {
    id: 'ox-2',
    question: '"됬어요"가 바른 표기이다.',
    answer: false,
    explain: '"되었어요"의 줄임말은 "됐어요"로 씁니다.',
  },
  {
    id: 'ox-3',
    question: '"많이"의 반대말은 "조금"이다.',
    answer: true,
    explain: '양이 적을 때는 "조금", 많을 때는 "많이"를 씁니다.',
  },
  {
    id: 'ox-4',
    question: '"감사합니다"는 사과할 때 쓰는 말이다.',
    answer: false,
    explain: '고마움을 표현할 때 씁니다. 사과할 때는 "죄송합니다"를 씁니다.',
  },
  {
    id: 'ox-5',
    question: '"학교에 갑니다"에서 "에"는 장소를 나타내는 조사이다.',
    answer: true,
    explain: '"에"는 목적지나 장소를 가리키는 조사입니다.',
  },
  {
    id: 'ox-6',
    question: '"어떻해"가 바른 표기이다.',
    answer: false,
    explain: '"어떻게 해"의 줄임말은 "어떡해"로 씁니다.',
  },
  {
    id: 'ox-7',
    question: '"내일"은 오늘보다 하루 뒤를 뜻한다.',
    answer: true,
    explain: '어제 - 오늘 - 내일 순서로 하루씩 지나갑니다.',
  },
  {
    id: 'ox-8',
    question: '"빨리"는 속도가 느린 모습을 나타내는 말이다.',
    answer: false,
    explain: '"빨리"는 속도가 빠른 모습을 나타냅니다. 느릴 때는 "천천히"입니다.',
  },
];

export const flipCards = [
  { id: 'fc-1', front: '사과', back: 'apple', hint: '빨갛고 둥근 과일' },
  { id: 'fc-2', front: '학교', back: 'school', hint: '공부하는 곳' },
  { id: 'fc-3', front: '친구', back: 'friend', hint: '가깝게 지내는 사람' },
  { id: 'fc-4', front: '가족', back: 'family', hint: '함께 사는 사람들' },
  { id: 'fc-5', front: '병원', back: 'hospital', hint: '아플 때 가는 곳' },
  { id: 'fc-6', front: '지하철', back: 'subway', hint: '땅속으로 다니는 기차' },
];

export const traceItems = [
  { id: 'tr-1', text: '가', guide: '가나다의 첫 글자' },
  { id: 'tr-2', text: '나', guide: '"나"는 자기를 가리키는 말' },
  { id: 'tr-3', text: '학', guide: '학교의 첫 글자' },
  { id: 'tr-4', text: '별', guide: '밤하늘에 반짝이는 것' },
  { id: 'tr-5', text: '4', guide: '숫자 사' },
];

export const speakItems = [
  { id: 'sp-1', text: '안녕하세요', meaning: '기본 인사말' },
  { id: 'sp-2', text: '감사합니다', meaning: '고마움을 표현하는 말' },
  { id: 'sp-3', text: '오늘 날씨가 좋아요', meaning: '날씨를 말하는 문장' },
  { id: 'sp-4', text: '저는 학생입니다', meaning: '자기소개 문장' },
  { id: 'sp-5', text: '다시 한 번 말해 주세요', meaning: '요청하는 문장' },
];

export const lessons = [
  {
    id: 'ox',
    href: '/ox',
    title: 'OX 퀴즈',
    desc: '맞으면 O, 틀리면 X',
    count: oxQuestions.length,
    unit: '문항',
    icon: 'OX',
    tone: 'tone-blue',
  },
  {
    id: 'flip',
    href: '/flip',
    title: '카드 뒤집기',
    desc: '카드를 뒤집어 뜻 확인',
    count: flipCards.length,
    unit: '카드',
    icon: '카',
    tone: 'tone-violet',
  },
  {
    id: 'trace',
    href: '/trace',
    title: '따라쓰기',
    desc: '점선을 따라 글씨 쓰기',
    count: traceItems.length,
    unit: '글자',
    icon: '쓰',
    tone: 'tone-amber',
  },
  {
    id: 'speak',
    href: '/speak',
    title: '따라말하기',
    desc: '듣고 따라 말하기',
    count: speakItems.length,
    unit: '문장',
    icon: '말',
    tone: 'tone-green',
  },
];

export const upcomingLessons = [
  { id: 'choice5', title: '5지선다', desc: '보기 5개 중 정답 고르기' },
  { id: 'essay', title: '서술형', desc: '문장으로 답 작성하기' },
];
