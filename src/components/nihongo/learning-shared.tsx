import type { ReactNode } from 'react';
import styles from './learning-app.module.css';
export type Tone = 'green' | 'orange' | 'blue' | 'purple';
export function ProgressBar({ value, tone = 'green' }: { value: number; tone?: Tone }) {
  return <div className={\`${styles.progressTrack} ${tone === 'orange' ? styles.progressOrange : tone === 'blue' ? styles.progressBlue : tone === 'purple' ? styles.progressPurple : ''}\`}><span style={{ width: \`${Math.max(0, Math.min(100, value))}%\` }} /></div>;
}
export function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className={styles.sectionHeading}><div><div className={styles.eyebrow}>{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
export function EmptyState({title,description}:{title:string;description:string}) {
  return <div className={styles.emptyState}><div>日</div><h2>{title}</h2><p>{description}</p></div>;
}
