"use client";

import { useId, useState, type ReactNode } from "react";
import { ArrowRight, Bookmark, CheckCircle2, ChevronDown, Compass, Copy, Home, Inbox, Layers, MoreHorizontal, Search, Settings, SlidersHorizontal, User, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BottomNavigation } from "@/components/ui/bottom-navigation";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { List, ListItem } from "@/components/ui/list-item";
import { Pagination } from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SearchField } from "@/components/ui/search-field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Stepper } from "@/components/ui/stepper";
import { Switch } from "@/components/ui/switch";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MotionButton } from "@/components/system/motion-button";

function Demo({ title, meta, rule, children }: { title: string; meta: string; rule: string; children: ReactNode }) {
  return <div className="specimen library-card"><div className="specimen-head"><h4>{title}</h4><span>{meta}</span></div>{children}<p className="demo-rule">{rule}</p></div>;
}

const destinations = [
  { value: "home", label: "홈", icon: <Home /> },
  { value: "explore", label: "탐색", icon: <Compass /> },
  { value: "saved", label: "보관함", icon: <Bookmark /> },
  { value: "settings", label: "설정", icon: <Settings /> },
];
const steps = [{ id: "choose", label: "선택" }, { id: "review", label: "확인" }, { id: "finish", label: "완료" }];

export function ComponentLibrary() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(["단어"]);
  const [language, setLanguage] = useState("en");
  const [choice, setChoice] = useState("basic");
  const [amount, setAmount] = useState([60]);
  const [range, setRange] = useState([20, 80]);
  const [destination, setDestination] = useState("home");
  const [page, setPage] = useState(1);
  const [step, setStep] = useState(0);
  const [listMessage, setListMessage] = useState("아이콘·설명·보조 정보를 자유롭게 조합합니다.");
  const [menuMessage, setMenuMessage] = useState("항목을 선택해 상태를 확인해 보세요.");
  const [showDetails, setShowDetails] = useState(true);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [emptyMode, setEmptyMode] = useState(false);
  const popoverTitleId = useId();
  const popoverDescriptionId = useId();
  const languageId = useId();
  const disabledLanguageId = useId();
  const activeDestination = destinations.find(item => item.value === destination)!;

  return <ToastProvider>
    <div className="library-index"><a href="#library-controls"><span>01</span>선택·입력</a><a href="#library-navigation"><span>02</span>탐색·목록</a><a href="#library-feedback"><span>03</span>안내·레이어</a></div>
    <div id="library-controls" className="library-group">
      <div className="library-group-heading"><h3>선택과 입력을 더 세밀하게</h3><span>CONTROLS / 05</span></div>
      <div className="specimen-grid two">
        <Demo title="Search & filter chips" meta="CLEAR / MULTI SELECT" rule="검색어 지우기는 입력 포커스를 유지합니다. 필터 칩은 복수 선택이 가능하며 선택 상태를 눌러 해제합니다.">
          <div className="demo-stack"><SearchField label="컴포넌트 검색 예시" value={query} onValueChange={setQuery} placeholder="검색어를 입력해 보세요" /><ToggleGroup type="multiple" value={filters} onValueChange={setFilters} aria-label="검색 필터 예시">{["단어", "문장", "회화"].map(item => <ToggleGroupItem value={item} key={item}>{item}</ToggleGroupItem>)}</ToggleGroup><p className="demo-caption" role="status">{query ? `입력: ${query}` : "검색어 없음"} · {filters.length ? filters.join(" · ") : "선택한 필터 없음"}</p></div>
        </Demo>
        <Demo title="Select" meta="SELECTED / DISABLED" rule="열린 목록은 트리거 아래에 정렬합니다. 방향키·문자 입력·Enter로 항목을 선택할 수 있어요.">
          <div className="demo-stack"><div className="demo-field"><label htmlFor={languageId}>선택 항목</label><Select value={language} onValueChange={setLanguage}><SelectTrigger id={languageId}><SelectValue placeholder="항목을 선택하세요" /></SelectTrigger><SelectContent><SelectGroup><SelectLabel>언어 예시</SelectLabel><SelectItem value="en">English</SelectItem><SelectItem value="ko">한국어</SelectItem><SelectItem value="ja">日本語</SelectItem><SelectItem value="es" disabled>Español · 준비 중</SelectItem></SelectGroup></SelectContent></Select></div><div className="demo-field"><label htmlFor={disabledLanguageId}>비활성 상태</label><Select disabled><SelectTrigger id={disabledLanguageId}><SelectValue placeholder="선택할 수 없는 항목" /></SelectTrigger><SelectContent><SelectItem value="disabled">비활성</SelectItem></SelectContent></Select></div></div>
        </Demo>
        <Demo title="Radio group" meta="SINGLE SELECT" rule="한 가지 값만 선택할 때 사용합니다. 라벨을 포함한 전체 행이 터치 영역이 됩니다.">
          <RadioGroup value={choice} onValueChange={setChoice} aria-label="표현 방식 예시">
            <label className="choice-card"><RadioGroupItem value="basic" /><span><strong>간결하게</strong><small>핵심 정보만 보여주는 기본형</small></span></label>
            <label className="choice-card"><RadioGroupItem value="detail" /><span><strong>자세하게</strong><small>설명과 보조 정보를 함께 표시</small></span></label>
            <label className="choice-card"><RadioGroupItem value="disabled" disabled /><span><strong>사용할 수 없음</strong><small>비활성 선택지의 표현</small></span></label>
          </RadioGroup>
        </Demo>
        <Demo title="Slider" meta="VALUE / RANGE" rule="숫자와 위치를 함께 보여줍니다. 손잡이는 24px, 조작 영역은 48px이며 방향키로 값을 조절합니다.">
          <div><div className="slider-label"><span>단일 값</span><output>{amount[0]}<small>%</small></output></div><Slider value={amount} onValueChange={setAmount} aria-label="단일 값" step={5} /><div className="slider-ends"><span>0</span><span>100</span></div><div className="slider-divider" /><div className="slider-label"><span>범위 선택</span><output>{range[0]}–{range[1]}</output></div><Slider value={range} onValueChange={setRange} thumbLabels={["범위 시작", "범위 끝"]} minStepsBetweenThumbs={1} step={5} /><div className="slider-ends"><span>0</span><span>100</span></div></div>
        </Demo>
      </div>
    </div>

    <div id="library-navigation" className="library-group">
      <div className="library-group-heading"><h3>현재 위치가 분명한 탐색</h3><span>NAVIGATION / 05</span></div>
      <div className="specimen-grid two">
        <Demo title="Bottom navigation" meta="4 ITEMS / SAFE AREA" rule="아이콘과 이름을 함께 표시합니다. 현재 위치만 블루로 강조하며 실제 화면의 고정 위치는 앱 셸에서 정합니다.">
          <div className="navigation-stage" role="status">{activeDestination.icon}<span>{activeDestination.label} 선택됨</span></div><BottomNavigation items={destinations} value={destination} onValueChange={setDestination} />
        </Demo>
        <Demo title="Pagination" meta="CURRENT / BOUNDARY" rule="현재 페이지와 인접 페이지를 보여줍니다. 첫·마지막 페이지에서 이동 버튼은 비활성화됩니다.">
          <div className="page-preview" aria-hidden="true">{[1,2,3].map(n => <span key={n}>{String((page-1)*3+n).padStart(2,"0")}</span>)}</div><Pagination page={page} pageCount={6} onPageChange={setPage} /><p className="specimen-note" role="status">{page} / 6 페이지</p>
        </Demo>
        <Demo title="Stepper" meta="COMPLETE / CURRENT / NEXT" rule="완료는 체크, 현재는 블루 경계, 다음은 중립으로 구분합니다. 단계 표시는 정보이며 이동은 별도 버튼으로 제공합니다.">
          <Stepper steps={steps} currentStep={step} /><div className="stepper-actions"><Button variant="outline" shape="pill" disabled={step===0} onClick={()=>setStep(s=>s-1)}>이전</Button><MotionButton shape="pill" disabled={step===steps.length} onClick={()=>setStep(s=>s+1)}>{step===steps.length ? "완료" : "다음 단계"}<ArrowRight /></MotionButton></div><p className="specimen-note" role="status">{step===steps.length ? "모든 단계 완료" : `${step+1}단계 · ${steps[step].label}`}</p>
        </Demo>
        <Demo title="Avatar & list item" meta="32 / 40 / 56 · LEADING / TRAILING" rule="목록의 앞·뒤 슬롯에 아바타, 아이콘, 배지를 조합합니다. 한 행에는 하나의 행동만 배치합니다.">
          <div className="avatar-row"><Avatar size="sm"><AvatarFallback><User size={16} /></AvatarFallback></Avatar><Avatar><AvatarFallback>T</AvatarFallback></Avatar><Avatar size="lg"><AvatarFallback>te</AvatarFallback></Avatar><AvatarGroup><Avatar><AvatarFallback>A</AvatarFallback></Avatar><Avatar><AvatarFallback>B</AvatarFallback></Avatar><AvatarGroupCount>+2</AvatarGroupCount></AvatarGroup></div>
          <List><ListItem title="프로필 항목" description="이름과 한 줄의 설명" leading={<Avatar><AvatarFallback>T</AvatarFallback></Avatar>} onClick={()=>setListMessage("프로필 항목을 선택했어요.")} /><ListItem title="보조 정보가 있는 항목" leading={<Layers />} trailing={<Badge shape="pill" variant="secondary">12</Badge>} onClick={()=>setListMessage("보조 정보가 있는 항목을 선택했어요.")} /></List><p className="specimen-note" role="status">{listMessage}</p>
        </Demo>
      </div>
    </div>

    <div id="library-feedback" className="library-group">
      <div className="library-group-heading"><h3>필요한 순간에, 필요한 안내</h3><span>FEEDBACK / 04</span></div>
      <div className="specimen-grid two">
        <Demo title="Dropdown menu" meta="ACTION / CHECKED / DISABLED" rule="관련된 보조 행동을 한곳에 모읍니다. 메뉴 항목은 48px 이상이며 Escape로 닫으면 원래 버튼으로 돌아갑니다.">
          <div className="overlay-demo-stage"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" shape="pill">메뉴 열기 <MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuLabel>항목 메뉴</DropdownMenuLabel><DropdownMenuItem onSelect={()=>setMenuMessage("복제 메뉴를 선택했어요.")}><Copy />복제 예시</DropdownMenuItem><DropdownMenuItem onSelect={()=>setMenuMessage("보관 메뉴를 선택했어요.")}><Bookmark />보관 예시</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuCheckboxItem checked={showDetails} onCheckedChange={setShowDetails}>보조 설명 표시</DropdownMenuCheckboxItem><DropdownMenuSeparator /><DropdownMenuItem disabled>비활성 메뉴</DropdownMenuItem></DropdownMenuContent></DropdownMenu><p role="status">{menuMessage}{!showDetails && " · 설명 숨김 선택됨"}</p></div>
        </Demo>
        <Demo title="Popover" meta="ANCHORED / NON MODAL" rule="버튼 가까이에 짧은 설명이나 설정을 표시합니다. 화면 가장자리를 피하고 바깥 클릭·Escape로 닫힙니다.">
          <div className="overlay-demo-stage"><Popover open={popoverOpen} onOpenChange={setPopoverOpen}><PopoverTrigger asChild><Button variant="outline" shape="pill"><SlidersHorizontal />보기 옵션 <ChevronDown /></Button></PopoverTrigger><PopoverContent aria-labelledby={popoverTitleId} aria-describedby={popoverDescriptionId}><PopoverHeader><PopoverTitle id={popoverTitleId}>보기 옵션</PopoverTitle><PopoverDescription id={popoverDescriptionId}>현재 화면을 유지하며 가볍게 조정할 수 있어요.</PopoverDescription></PopoverHeader><label className="control-row"><span><b>보조 설명</b><small>짧은 도움말 함께 보기</small></span><Switch checked={showDetails} onCheckedChange={setShowDetails} aria-label="팝오버 보조 설명" /></label><Button variant="outline" shape="pill" onClick={()=>setPopoverOpen(false)}>확인했어요</Button></PopoverContent></Popover><p>맥락 안에서 열리는 작은 레이어</p></div>
        </Demo>
        <Demo title="Toast" meta="POLITE / DISMISS / SWIPE" rule="흐름을 막지 않는 상태 안내입니다. 기본은 직접 닫기이며 포커스를 빼앗지 않습니다. 중요 오류는 본문에도 표시하세요.">
          <div className="toast-preview"><CheckCircle2 aria-hidden="true" /><div className="toast-copy"><p className="toast-title">상태를 알려주는 짧은 안내</p><p className="toast-description">아이콘과 한 줄의 설명을 함께 사용해요.</p></div></div><div><MotionButton variant="outline" shape="pill" disabled={toastOpen} onClick={()=>setToastOpen(true)}>토스트 열기 <ArrowRight /></MotionButton></div>
          <Toast open={toastOpen} onOpenChange={setToastOpen}><CheckCircle2 aria-hidden="true" /><div className="toast-copy"><ToastTitle>토스트가 열렸어요</ToastTitle><ToastDescription>닫기 또는 Escape로 닫을 수 있어요.</ToastDescription></div><ToastClose asChild><Button variant="ghost" shape="pill" size="icon" className="toast-dismiss" aria-label="알림 닫기"><X /></Button></ToastClose></Toast>
        </Demo>
        <Demo title="Empty state" meta="NO DATA / NO RESULTS" rule="비어 있는 이유와 다음 행동 하나를 안내합니다. 로딩이나 오류 상태와 구분하고 과한 장식은 줄입니다.">
          <EmptyState icon={emptyMode ? <Search /> : <Inbox />} title={emptyMode ? "검색 결과가 없어요" : "아직 항목이 없어요"} description={emptyMode ? "다른 검색어를 입력하거나 선택한 필터를 확인해 주세요." : "첫 항목을 위한 공간이에요. 다음 행동을 짧고 분명하게 안내합니다."} action={<Button variant="outline" shape="pill" onClick={()=>setEmptyMode(v=>!v)}>다른 상태 보기 <ArrowRight /></Button>} />
        </Demo>
      </div>
    </div>
    <ToastViewport />
  </ToastProvider>;
}
