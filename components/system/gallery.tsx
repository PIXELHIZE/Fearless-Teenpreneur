"use client";

import { useState } from "react";
import { ArrowUpRight, ArrowRight, Check, ChevronRight, Moon, Sun, Plus, RotateCcw, Layers, X, Copy, SlidersHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MotionButton } from "@/components/system/motion-button";
import { AnimatedProgress, FlipSurface, MotionReveal } from "@/components/system/motion-surfaces";
import { StatusNotice } from "@/components/system/status-notice";
import { ComponentLibrary } from "@/components/system/component-library";
import { Logo } from "@/components/system/logo";

const navigation = [ ["identity", "Identity", "로고"], ["foundation", "Foundations", "기초 규칙"], ["actions", "Actions", "버튼·액션"], ["library", "Library", "확장 컴포넌트"], ["inputs", "Inputs", "입력·선택"], ["surfaces", "Surfaces", "카드·오버레이"], ["feedback", "Feedback", "상태·피드백"], ["motion", "Motion", "움직임"] ];

function SectionHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return <div className="section-heading"><div><span className="eyebrow">{number}</span><h2>{title}</h2></div><p>{description}</p></div>;
}

function Specimen({ title, meta, children, className = "" }: { title: string; meta: string; children: React.ReactNode; className?: string }) {
  return <div className={`specimen ${className}`}><div className="specimen-head"><h3>{title}</h3><span>{meta}</span></div>{children}</div>;
}

export function Gallery() {
  const [dark, setDark] = useState(false);
  const [replay, setReplay] = useState(0);
  const [progress, setProgress] = useState(64);
  const [tab, setTab] = useState("default");
  const [switchOn, setSwitchOn] = useState(true);
  const [compactOn, setCompactOn] = useState(false);
  const [action, setAction] = useState("상태별 버튼을 눌러 확인할 수 있어요.");
  const toggleTheme = () => { const next = !dark; setDark(next); document.documentElement.classList.toggle("dark", next); };

  return <div className="system-shell">
    <a href="#main" className="skip-link">본문으로 건너뛰기</a>
    <header className="system-header"><a className="wordmark" href="#" aria-label="teum 디자인 시스템 처음"><Logo className="header-logo" decorative /><span className="wordmark-light">/ system</span></a><div className="header-right"><span className="version-label">INTERFACE SYSTEM · 0.4</span><Button variant="outline" size="icon" onClick={toggleTheme} aria-label={dark ? "라이트 테마 보기" : "다크 테마 보기"}>{dark ? <Sun /> : <Moon />}</Button></div></header>
    <aside className="system-sidebar"><div className="sidebar-intro"><span className="eyebrow">DESIGN RESOURCES</span><p>하나의 언어로<br />만드는 모든 화면.</p></div><nav aria-label="디자인 시스템 목차">{navigation.map(([id,en,ko],i)=><a key={id} href={`#${id}`}><span className="mono">0{i}</span><span>{en}<small>{ko}</small></span><ChevronRight size={14} /></a>)}</nav><div className="sidebar-foot"><span className="tiny-dot" /> COMPONENTS, NOT FEATURES<br /><span>Next.js · shadcn/ui · GSAP</span></div></aside>
    <main id="main" className="system-main">
      <section className="system-intro"><div><span className="eyebrow">THE FOUNDATION OF EVERY SCREEN</span><h1>일관된 화면.<br /><span>자연스러운 움직임.</span></h1><p>화이트와 블랙, 그리고 하나의 블루.<br />공용 컴포넌트와 움직임의 기준을 정의합니다.</p><a href="#actions" className="text-link">컴포넌트 살펴보기 <ArrowUpRight size={17} /></a></div><div className="intro-art" aria-label="teum 워드마크"><div className="intro-art-top"><span>teum<br />INTERFACE<br />SYSTEM</span><span>04</span></div><Logo variant="wordmark" tone="inverse" className="intro-logo" /><div className="intro-art-bottom"><span>Clarity in every detail.</span><span className="blue-square" /></div></div></section>

      <section id="identity"><SectionHeading number="00 / BRAND IDENTITY" title="작은 점에서 시작하는 teum" description="t. 심볼과 소문자 워드마크의 조합." />
        <div className="logo-primary-preview"><Logo className="identity-lockup" /><span className="logo-preview-label">PRIMARY / COBALT + BLACK</span></div>
        <div className="logo-variant-grid"><div className="logo-variant logo-on-blue"><Logo variant="symbol" tone="inverse" tile={false} className="identity-symbol" /><span>SYMBOL / t.</span></div><div className="logo-variant logo-on-black"><Logo variant="wordmark" tone="inverse" className="identity-wordmark" /><span>WORDMARK / teum</span></div><div className="logo-variant"><div className="logo-scale-row"><Logo variant="symbol" className="logo-size-64" /><Logo variant="symbol" tone="mono" className="logo-size-40" /><Logo variant="symbol" className="logo-size-24" /></div><span>APP ICON / 64 · 40 · 24</span></div></div>
        <div className="logo-guidelines"><span>기본 표기 <strong>teum</strong></span><span>보호 여백 <strong>H / 4</strong></span><span>최소 심볼 <strong>24px</strong></span><span>아웃라인 SVG · 폰트 불필요</span></div>
        <div className="logo-downloads"><a href="/brand/teum-logo-primary.svg" download>기본 로고 SVG <ArrowUpRight size={16} /></a><a href="/brand/teum-symbol-blue.svg" download>심볼 SVG <ArrowUpRight size={16} /></a><a href="/brand/teum-wordmark-black.svg" download>워드마크 SVG <ArrowUpRight size={16} /></a></div>
      </section>

      <section id="foundation"><SectionHeading number="01 / FOUNDATION" title="기본이 되는 것들" description="색상, 글자, 간격을 하나의 기준으로." />
        <div className="palette-grid">{[{name:"White",hex:"#FFFFFF",token:"background",style:"white"},{name:"Black",hex:"#111113",token:"foreground / primary",style:"black"},{name:"Cobalt",hex:"#315EFF",token:"brand / ring",style:"blue"}].map(c=><div className={`palette-tile palette-${c.style}`} key={c.name}><div><span>{c.name}</span><ArrowUpRight size={18} /></div><div><strong>{c.hex}</strong><small>{c.token}</small></div></div>)}</div>
        <div className="rules-line"><span><b>80%</b> White & neutral</span><span><b>15%</b> Black & type</span><span><b>5%</b> One accent</span><span>화면 구성의 권장 출발점</span></div>
        <div className="specimen-grid two"><Specimen title="Typography" meta="PRETENDARD VARIABLE"><div className="type-spec"><p className="type-title">읽기 쉬운 리듬.</p><p className="type-body">명확한 정보와 편안한 여백.<br />모든 화면은 같은 언어를 사용합니다.</p><div className="type-footer"><span>Title 28 / 38</span><span>Body 16 / 26</span><span>Label 14 / 20</span></div></div></Specimen><Specimen title="Space & shape" meta="4PX BASE"><div className="spacing-spec">{[4,8,12,16,24,32].map(n=><div key={n}><span style={{height:n+8,width:Math.max(n,4)}} /><small>{n}</small></div>)}</div><div className="radius-spec"><span style={{borderRadius:8}}>8</span><span style={{borderRadius:12}}>12</span><span style={{borderRadius:16}}>16</span><span style={{borderRadius:24}}>24</span><p>Control 12<br />Surface 16<br />Overlay 24</p></div><div className="shape-rule"><span>Pill</span><p>Radius full · 짧은 행동과 선택</p></div></Specimen></div>
      </section>

      <section id="actions"><SectionHeading number="02 / ACTIONS" title="분명한 행동의 위계" description="기본은 블랙. 가장 중요한 순간에는 블루." />
        <Specimen title="Button" meta="SHADCN + GSAP · 48PX"><div className="button-spec-row"><div><MotionButton onClick={()=>setAction('Default · 블랙 기본 버튼')}>기본 버튼 <ArrowRight /></MotionButton><small>Default</small></div><div><MotionButton variant="brand" onClick={()=>setAction('Brand · 그룹당 하나의 강조 행동')}>강조 버튼 <ArrowUpRight /></MotionButton><small>Brand</small></div><div><MotionButton variant="outline" onClick={()=>setAction('Outline · 보조 행동')}>보조 버튼</MotionButton><small>Outline</small></div><div><MotionButton variant="ghost" onClick={()=>setAction('Ghost · 낮은 강조 행동')}>텍스트 버튼 <ChevronRight /></MotionButton><small>Ghost</small></div><div><Button disabled>비활성</Button><small>Disabled</small></div><div><MotionButton loading>처리 중</MotionButton><small>Loading</small></div><div><Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" aria-label="추가 버튼 예시" onClick={()=>setAction('Icon · 48px 영역과 접근성 이름')}><Plus /></Button></TooltipTrigger><TooltipContent>추가 버튼 예시</TooltipContent></Tooltip><small>Icon</small></div></div><div className="specimen-note" role="status">{action}</div></Specimen>
        <Specimen title="Capsule" meta="RADIUS FULL · 48PX" className="capsule-specimen">
          <div className="capsule-layout">
            <div>
              <div className="capsule-buttons">
                <MotionButton shape="pill" onClick={()=>setAction('Pill · 둥근 양 끝과 48px 터치 영역')}>시작하기 <ArrowRight /></MotionButton>
                <MotionButton shape="pill" variant="outline" onClick={()=>setAction('Pill outline · 같은 형태, 낮은 강조')}>더 알아보기</MotionButton>
                <MotionButton shape="pill" variant="outline" size="icon" aria-label="원형 추가 버튼 예시" onClick={()=>setAction('Circle · 아이콘 버튼의 캡슐형 변형')}><Plus /></MotionButton>
              </div>
              <div className="badge-row"><Badge shape="pill" className="brand-badge">새로운 항목</Badge><Badge shape="pill" variant="outline"><Check />완료</Badge><Badge shape="pill" variant="secondary">선택 가능</Badge></div>
            </div>
            <Tabs defaultValue="all">
              <TabsList shape="pill" aria-label="캡슐형 탭 예시"><TabsTrigger value="all">전체</TabsTrigger><TabsTrigger value="active">진행 중</TabsTrigger><TabsTrigger value="done">완료</TabsTrigger></TabsList>
              <TabsContent value="all"><p className="capsule-caption">버튼, 배지, 탭에 같은 곡선을 적용합니다. 짧은 라벨과 여유 있는 좌우 여백을 함께 사용해요.</p></TabsContent>
              <TabsContent value="active"><p className="capsule-caption">선택된 탭은 블랙으로 채웁니다. 방향키로 이동해 키보드 포커스도 확인할 수 있어요.</p></TabsContent>
              <TabsContent value="done"><p className="capsule-caption">캡슐은 행동과 선택에, 12·16·24px 모서리는 입력과 콘텐츠 표면에 사용합니다.</p></TabsContent>
            </Tabs>
          </div>
        </Specimen>
        <div className="rule-chips"><span>Touch target ≥ 48px</span><span>Radius 12px / Pill</span><span>Press 120ms / scale .97</span><span>Focus ring 3px</span></div>
      </section>

      <section id="library"><SectionHeading number="03 / COMPONENT LIBRARY" title="더 넓어진 공용 컴포넌트" description="선택부터 안내까지, 14가지 공용 요소를 조합합니다." /><ComponentLibrary /></section>

      <section id="inputs"><SectionHeading number="04 / INPUTS" title="상태가 읽히는 입력" description="라벨, 도움말, 선택 상태를 명확하게." />
        <div className="specimen-grid two"><Specimen title="Text field" meta="DEFAULT / INVALID / DISABLED"><div className="field-stack"><div className="field-example"><Label htmlFor="field-default">라벨</Label><Input id="field-default" placeholder="내용을 입력하세요" aria-describedby="field-help" /><p id="field-help">입력을 돕는 짧고 구체적인 설명.</p></div><div className="field-example"><Label htmlFor="field-invalid">오류 상태</Label><Input id="field-invalid" defaultValue="입력 예시" aria-invalid="true" aria-describedby="field-error" /><p id="field-error" className="field-error"><X size={15} /> 입력 내용을 다시 확인해 주세요.</p></div><div className="field-example"><Label htmlFor="field-disabled">비활성 상태</Label><Input id="field-disabled" placeholder="수정할 수 없는 입력" disabled /></div></div></Specimen><Specimen title="Selection & multiline" meta="RADIX PRIMITIVES"><div className="field-stack"><div className="switch-examples">
          <label className="control-row"><span><b>기본 스위치</b><small>{switchOn ? "켜짐" : "꺼짐"} · 52 × 32</small></span><Switch checked={switchOn} onCheckedChange={setSwitchOn} aria-label="기본 스위치" /></label>
          <label className="control-row"><span><b>작은 스위치</b><small>{compactOn ? "켜짐" : "꺼짐"} · 44 × 26</small></span><Switch size="sm" checked={compactOn} onCheckedChange={setCompactOn} aria-label="작은 스위치" /></label>
          <label className="control-row"><span><b>비활성 스위치</b><small>터치 영역은 항상 48px 이상</small></span><Switch disabled aria-label="비활성 스위치" /></label>
        </div><label className="check-row"><Checkbox defaultChecked /><span>선택한 항목</span></label><label className="check-row"><Checkbox /><span>선택하지 않은 항목</span></label><div className="field-example"><Label htmlFor="field-area">여러 줄 입력</Label><Textarea id="field-area" placeholder="긴 문장도 여유롭게 입력해요." /></div></div></Specimen></div>
      </section>

      <section id="surfaces"><SectionHeading number="05 / SURFACES" title="내용을 담는 공용 구조" description="카드, 탭, 펼침, 대화상자까지 같은 규칙으로." />
        <div className="specimen-grid two"><Specimen title="Card & tabs" meta="RADIUS 16 / PADDING 24"><Tabs value={tab} onValueChange={setTab}><TabsList aria-label="카드 스타일"><TabsTrigger value="default">기본</TabsTrigger><TabsTrigger value="outlined">아웃라인</TabsTrigger><TabsTrigger value="compact">컴팩트</TabsTrigger></TabsList>{["default","outlined","compact"].map(value=><TabsContent key={value} value={value}><Card className={`demo-card demo-card-${value}`}><CardHeader><div className="card-symbol"><Layers /></div><CardTitle>내용을 위한 여백</CardTitle><CardDescription>간결한 제목과 필요한 설명.<br />표면은 정보의 위계를 만듭니다.</CardDescription></CardHeader><CardContent><Badge variant="secondary">Component</Badge></CardContent></Card></TabsContent>)}</Tabs></Specimen><Specimen title="Accordion & overlay" meta="FOCUS / ESCAPE / RETURN"><Accordion type="single" collapsible defaultValue="rules"><AccordionItem value="rules"><AccordionTrigger>컴포넌트 조합 규칙</AccordionTrigger><AccordionContent><MotionReveal>같은 목적의 행동을 묶고, 그룹 사이에 24px 이상의 여백을 둡니다.</MotionReveal></AccordionContent></AccordionItem><AccordionItem value="motion"><AccordionTrigger>움직임의 기준</AccordionTrigger><AccordionContent><MotionReveal>상태 변화는 짧고 명확하게. 모션을 줄여도 정보는 동일하게 유지합니다.</MotionReveal></AccordionContent></AccordionItem></Accordion><div className="overlay-triggers"><Dialog><DialogTrigger asChild><Button variant="outline">Dialog 열기 <Copy /></Button></DialogTrigger><DialogContent>
              <div className="overlay-symbol" aria-hidden="true"><Layers /></div>
              <DialogHeader><DialogTitle>선택을 확인해 주세요</DialogTitle><DialogDescription>짧은 설명과 분명한 행동으로 안내합니다.<br />편안한 여백 안에서 다음 단계를 선택하세요.</DialogDescription></DialogHeader>
              <DialogFooter><DialogClose asChild><Button variant="outline" shape="pill">취소</Button></DialogClose><DialogClose asChild><Button variant="brand" shape="pill">확인</Button></DialogClose></DialogFooter>
            </DialogContent></Dialog><Sheet><SheetTrigger asChild><Button variant="outline">Sheet 열기 <SlidersHorizontal /></Button></SheetTrigger><SheetContent side="bottom">
              <SheetHeader><SheetTitle>나에게 맞는 선택</SheetTitle><SheetDescription>화면의 맥락을 유지하며 간단한 옵션을 조정해요.</SheetDescription></SheetHeader>
              <div className="sheet-options"><label className="control-row"><span><b>기본 옵션</b><small>켜짐과 꺼짐이 명확한 선택</small></span><Switch defaultChecked aria-label="시트 기본 옵션" /></label><label className="control-row"><span><b>추가 옵션</b><small>필요할 때 가볍게 켜 보세요</small></span><Switch aria-label="시트 추가 옵션" /></label></div>
              <SheetFooter><SheetClose asChild><Button variant="brand" shape="pill">선택 완료</Button></SheetClose></SheetFooter>
            </SheetContent></Sheet></div><p className="specimen-note">Sheet · 화면 아래에서 420ms로 올라오고, 300ms로 내려갑니다.</p></Specimen></div>
      </section>

      <section id="feedback"><SectionHeading number="06 / FEEDBACK" title="색을 늘리지 않는 상태 표현" description="아이콘과 문구로 의미를 전달합니다." />
        <div className="specimen-grid two"><Specimen title="Status notice" meta="ICON + COPY"><div className="notice-stack"><StatusNotice tone="info" title="정보 안내">블루는 정보와 현재 선택에만 사용합니다.</StatusNotice><StatusNotice tone="success" title="완료된 상태">체크 아이콘과 명확한 문구.</StatusNotice><StatusNotice tone="error" title="확인이 필요한 상태">X 아이콘과 수정할 내용을 함께 표시합니다.</StatusNotice></div></Specimen><Specimen title="Badge & loading" meta="NEUTRAL FIRST"><div className="badge-row"><Badge>기본</Badge><Badge className="brand-badge">선택됨</Badge><Badge variant="outline"><Check size={12} />완료</Badge><Badge variant="outline"><X size={12} />확인 필요</Badge></div><div className="skeleton-spec"><Skeleton className="size-12 rounded-xl" /><div><Skeleton className="h-4 w-3/4" /><Skeleton className="mt-3 h-3 w-full" /></div></div><p className="specimen-note">로딩은 콘텐츠의 자리를 유지합니다.<br />정보를 전달하는 상태는 자동으로 사라지지 않습니다.</p></Specimen></div>
      </section>

      <section id="motion"><SectionHeading number="07 / MOTION" title="움직임도 시스템의 일부" description="GSAP으로 제어하는 짧고 일관된 피드백." />
        <div className="specimen-grid two"><Specimen title="Flip surface" meta="360MS / POWER2.INOUT"><FlipSurface /><p className="specimen-note">포인터와 키보드로 앞뒤 면 전환.</p></Specimen><Specimen title="Reveal & progress" meta="240MS / 180MS"><div className="motion-demo-header"><span>Stagger · 40ms</span><Button variant="ghost" size="icon" aria-label="등장 모션 다시 재생" onClick={()=>setReplay(v=>v+1)}><RotateCcw /></Button></div><MotionReveal replay={replay} className="reveal-items">{["기본 구조", "일관된 상태", "자연스러운 피드백"].map((text,i)=><div data-reveal key={text}><span className="mono">0{i+1}</span><span>{text}</span><ArrowUpRight size={16} /></div>)}</MotionReveal><div className="progress-demo"><div><Label htmlFor="motion-progress">프로그레스</Label><span aria-live="polite">{progress}%</span></div><AnimatedProgress value={progress} /><input id="motion-progress" type="range" min="0" max="100" value={progress} onChange={e=>setProgress(Number(e.target.value))} /></div></Specimen></div>
        <div className="motion-rules"><div><span className="mono">420</span><span>ms · Sheet in</span></div><div><span className="mono">300</span><span>ms · Sheet out</span></div><div><span className="mono">120</span><span>ms · Press</span></div><div><span className="mono">180</span><span>ms · State</span></div><div><span className="mono">240</span><span>ms · Reveal</span></div><div><span className="mono">360</span><span>ms · Flip</span></div><p><Sparkles size={16} />OS의 모션 감소 설정을 따릅니다.</p></div>
      </section>
      <footer className="system-footer"><span className="wordmark"><Logo variant="wordmark" className="footer-logo" decorative /> / system</span><span>공용 컴포넌트 · 디자인 규칙 · 모션 토큰</span><span>v0.4</span></footer>
    </main>
  </div>;
}
