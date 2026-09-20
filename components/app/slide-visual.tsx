import { ArrowRight } from "lucide-react";
import { MathText } from "@/components/app/math-text";
import type { SlideVisual as Visual } from "@/lib/types";

/** 카드뉴스에 붙는 시각 자료. 모델이 고른 형태를 그린다. */
export function SlideVisual({ visual }: { visual: Visual }) {
  switch (visual.type) {
    case "formula":
      return (
        <div className="vis vis-formula">
          <MathText as="strong" text={visual.text.includes("$") ? visual.text : `$$${visual.text}$$`} />
          {visual.caption ? <MathText as="small" text={visual.caption} /> : null}
        </div>
      );
    case "steps":
      return (
        <ol className="vis vis-steps">
          {visual.items.map((item, index) => (
            <li key={index}>
              <span className="vis-step-num">{index + 1}</span>
              <MathText text={item} />
              {index < visual.items.length - 1 ? <ArrowRight size={14} className="vis-step-arrow" aria-hidden /> : null}
            </li>
          ))}
        </ol>
      );
    case "compare":
      return (
        <div className="vis vis-compare">
          <div>
            <strong>{visual.left.title}</strong>
            <ul>
              {visual.left.items.map((item, index) => (
                <li key={index}>
                  <MathText text={item} />
                </li>
              ))}
            </ul>
          </div>
          <div data-side="right">
            <strong>{visual.right.title}</strong>
            <ul>
              {visual.right.items.map((item, index) => (
                <li key={index}>
                  <MathText text={item} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    case "bars": {
      const max = Math.max(...visual.items.map((item) => Math.abs(item.value)), 1);
      return (
        <div className="vis vis-bars">
          {visual.items.map((item, index) => (
            <div key={index} className="vis-bar-row">
              <small>{item.label}</small>
              <div className="vis-bar-track">
                <span style={{ width: `${(Math.abs(item.value) / max) * 100}%` }} />
              </div>
              <strong className="tnum">
                {item.value}
                {visual.unit ?? ""}
              </strong>
            </div>
          ))}
        </div>
      );
    }
    case "table":
      return (
        <div className="vis vis-table">
          <table>
            <thead>
              <tr>
                {visual.headers.map((header, index) => (
                  <th key={index}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visual.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>
                      <MathText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "example":
      return (
        <div className="vis vis-example">
          <div>
            <small>예제</small>
            <MathText as="p" text={visual.problem} />
          </div>
          <div data-part="solution">
            <small>풀이</small>
            <MathText as="p" text={visual.solution} />
          </div>
        </div>
      );
    default:
      return null;
  }
}
