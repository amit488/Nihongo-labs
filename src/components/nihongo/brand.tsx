import Link from 'next/link';
import styles from './brand.module.css';

type BrandProps = {
  href?: string;
  tone?: 'light' | 'dark';
  className?: string;
};

export default function Brand({ href = '/', tone = 'light', className = '' }: BrandProps) {
  const content = <>
    <span className={styles.mark} aria-hidden="true">日</span>
    <span className={styles.name}>Nihongo Labs</span>
  </>;

  const classNames = [styles.brand, tone === 'dark' ? styles.dark : '', className].filter(Boolean).join(' ');

  return <Link href={href} className={classNames} aria-label="Nihongo Labs home">{content}</Link>;
}
