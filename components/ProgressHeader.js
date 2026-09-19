export default function ProgressHeader({ current, total, rightLabel }) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div style={{ marginBottom: 18 }}>
      <div className="meta-row">
        <span>
          {current} / {total}
        </span>
        {rightLabel ? <span>{rightLabel}</span> : null}
      </div>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div className="progress-bar" style={{ width: percent + '%' }} />
      </div>
    </div>
  );
}
