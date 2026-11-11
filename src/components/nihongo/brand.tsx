import Image from 'next/image';
import Link from 'next/link';
import styles from './brand.module.css';

type BrandProps = {
  href?: string;
  tone?: 'light' | 'dark';
  className?: string;
};

type BrandMarkProps = {
  size?: number;
  className?: string;
};

/** The official Nihongo Labs emblem, sized as a square mark without distorting its artwork. */
export function BrandMark({ size = 38, className = '' }: BrandMarkProps) {
  return (
    <span aria-hidden="true" className={className} style={{ width: size, height: size }}>
      <Image
        src="/nihongo-labs-logo.png"
        alt=""
        width={128}
        height={128}
        className={styles.markImage}
      />
    </span>
  );
}

export default function Brand({ href = '/', tone = 'light', className = '' }: BrandProps) {
  const content = <>
    <BrandMark size={38} className={styles.mark} />
    <span className={styles.name}>Nihongo Labs</span>
  </>;

  const classNames = [styles.brand, tone === 'dark' ? styles.dark : '', className].filter(Boolean).join(' ');

  return <Link href={href} className={classNames} aria-label="Nihongo Labs home">{content}</Link>;
}
