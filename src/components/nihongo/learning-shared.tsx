import type { ReactNode } from 'react';
import styles from './learning-app.module.css';

export type Tone = 'green' | 'orange' | 'blue' | 'purple';
export type JlptLevel = 'N5' | 'N4';

export function JlptLevelSwitch({ value, onChange, label = 'JLPT level' }: {
  value: JlptLevel;
  onChange: (level: JlptLevel) => void;
  label?: string;
}) {
  return <div className={styles.jlptLevelSwitch} role="group" aria-label={label}>
    {(['N5', 'N4'] as const).map((level) => (
      <button key={level} type="button" aria-pressed={value === level}
        className={value === level ? styles.jlptLevelSwitchActive : ''}
        onClick={() => onChange(level)}>{level}</button>
    ))}
  </div>;
}

export function ProgressBar({ value, tone = 'green' }: { value: number; tone?: Tone }) {
  const toneClass = tone === 'orange' ? styles.progressOrange
    : tone === 'blue' ? styles.progressBlue
    : tone === 'purple' ? styles.progressPurple
    : '';
  return <div className={styles.progressTrack + ' ' + toneClass}>
    <span style={{ width: (Math.max(0, Math.min(100, value)) + '%') }} />
  </div>;
}

export function SectionHeading({ eyebrow, title, description, action }: {
  eyebrow: string; title: string; description: string; action?: ReactNode;
}) {
  return <div className={styles.sectionHeading}>
    <div><div className={styles.eyebrow}>{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>
    {action}
  </div>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className={styles.emptyState}><div>日</div><h2>{title}</h2><p>{description}</p></div>;
}
