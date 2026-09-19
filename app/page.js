import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { lessons, upcomingLessons } from '@/lib/content';

export default function HomePage() {
  return (
    <AppShell title="기본학습">
      <section className="home-hero">
        <h1>기본학습</h1>
        <p>학습 유형을 골라 시작하세요.</p>
      </section>

      <div className="lesson-list">
        {lessons.map((lesson) => (
          <Link key={lesson.id} href={lesson.href} className="lesson-item">
            <span className={'lesson-icon ' + lesson.tone} aria-hidden="true">
              {lesson.icon}
            </span>
            <span className="lesson-body">
              <strong>{lesson.title}</strong>
              <span>{lesson.desc}</span>
            </span>
            <span className="lesson-count">
              {lesson.count}
              {lesson.unit}
            </span>
          </Link>
        ))}
      </div>

      <h2 className="section-title">추후 기능</h2>
      <div className="upcoming-list">
        {upcomingLessons.map((item) => (
          <div key={item.id} className="upcoming-item">
            <span>
              <strong>{item.title}</strong>
              <span>{item.desc}</span>
            </span>
            <span className="badge-soon">준비 중</span>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
