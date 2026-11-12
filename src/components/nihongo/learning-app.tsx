'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './learning-app.module.css';
import Brand from './brand';
import LearningIntelligence from './learning-intelligence';
import LearningPlans from './learning-plans';
import { getSupabaseBrowserClient } from '@/lib/nihongo/supabase';
import { getDaysUntilJlpt } from '@/lib/nihongo/jlpt-countdown';
import { JlptLevelSwitch, ProgressBar, SectionHeading, type JlptLevel, type Tone } from './learning-shared';
import type { LearningFeatureProps } from './learning-features';
import { createPreviewSnapshot, getPublishedFlashcards, loadLearnerSnapshot, type LearnerFlashcard, type LearnerSnapshot } from '@/lib/nihongo/data';
import { vocabulary as demoVocabulary } from '@/lib/nihongo/demo-content';

type Props = { section?: string[] };
type GlobalSearchResult = { id: string; kind: string; level: string; title: string; detail: string; href: string };
const LazyLearningFeature = lazy(() => import('./learning-features').then((module) => ({ default: module.LearningFeature })));

const navGroups = [
  { label: 'LEARN', items: [
    { key: 'overview', title: 'Overview', href: '/learn', icon: '◫' },
    { key: 'grammar', title: 'Grammar', href: '/learn/grammar', icon: '文' },
    { key: 'vocabulary', title: 'Vocabulary', href: '/learn/vocabulary', icon: '語' },
    { key: 'kanji', title: 'Kanji', href: '/learn/kanji', icon: '字' },
    { key: 'kana', title: 'Hiragana & Katakana', href: '/learn/kana', icon: 'あ' },
  ] },
  { label: 'PRACTICE', items: [
    { key: 'practice', title: 'Daily practice', href: '/learn/practice', icon: '✳' },
    { key: 'sentences', title: 'Sentence construction', href: '/learn/sentences', icon: '文' },
    { key: 'flashcards', title: 'Flashcards', href: '/learn/flashcards', icon: '▤' },
    { key: 'reading', title: 'Reading', href: '/learn/reading', icon: '読' },
    { key: 'exams', title: 'Mock exams', href: '/learn/exams', icon: '◷' },
  ] },
  { label: 'YOUR SPACE', items: [
    { key: 'progress', title: 'My progress', href: '/learn/progress', icon: '↗' },
    { key: 'plans', title: 'Plans', href: '/learn/plans', icon: '₹' },
    { key: 'subscription', title: 'Membership', href: '/learn/subscription', icon: '◇' },
  ] },
];

function Icon({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span aria-hidden="true" className={styles.icon + ' ' + className}>{children}</span>;
}

export default function LearningApp({ section = [] }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = section[0] || 'overview';
  const focusedVocabularyId = active === 'vocabulary' ? searchParams.get('focus') || undefined : undefined;
  const focusedVocabularyLevel = focusedVocabularyId
    ? (searchParams.get('level') === 'N4' ? 'N4' : searchParams.get('level') === 'N5' ? 'N5' : undefined)
    : undefined;
  const [name, setName] = useState('Learner');
  const [signedIn, setSignedIn] = useState(false);
  const [connected, setConnected] = useState(false);
  const authGenerationRef = useRef(0);
  const [authViewKey, setAuthViewKey] = useState(0);
  const [snapshot, setSnapshot] = useState<LearnerSnapshot>({
    displayName: 'Learner', preferredJlptLevel: 'N5',
    grammarCount: 0, grammarUnderstood: 0,
    vocabularyCount: 0, vocabularyMastered: 0,
    kanjiCount: 0, kanjiMastered: 0,
    grammarAttempts: 0, kanaAttempts: 0, readingAttempts: 0,
    lessonsCompleted: 0, lessonsTotal: 0, recentScores: [], overallPercentage: 0,
    mastery: { grammar: 0, vocabulary: 0, kanji: 0, kana: 0, reading: 0, overallLessons: 0 },
    streak: 0, due: { vocabulary: 0, flashcards: 0, total: 0 },
    premiumActive: false, showRomaji: true, showFurigana: true, source: 'preview',
  });
  const [flashcardData, setFlashcardData] = useState<LearnerFlashcard[]>([]);
  const [romaji, setRomaji] = useState(true);
  const refreshLearnerSnapshot = useCallback(async () => {
    const generation = authGenerationRef.current;
    try {
      const nextSnapshot = await loadLearnerSnapshot();
      // Ignore a response that started before the latest sign-in/sign-out event.
      if (generation !== authGenerationRef.current) return;
      setSnapshot(nextSnapshot);
      if (nextSnapshot.source === 'database') setName(nextSnapshot.displayName || 'Learner');
    } catch (error) {
      // Keep the last known snapshot if the dashboard refresh is temporarily unavailable.
      console.error('[Nihongo Labs dashboard refresh]', error);
    }
  }, []);
  const romajiSaveGeneration = useRef(0);
  const setRomajiPreference = (value: boolean) => {
    const previousValue = romaji;
    const generation = ++romajiSaveGeneration.current;
    setRomaji(value);
    if (!signedIn) return;
    void fetch('/api/learning/settings', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showRomaji: value }),
      signal: AbortSignal.timeout(8_000),
    }).then(async (response) => {
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || 'Could not save the Romaji preference.');
      }
    }).catch((error) => {
      console.error('[Nihongo Labs Romaji preference]', error);
      if (generation === romajiSaveGeneration.current) setRomaji(previousValue);
    });
  };
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [kanaMode, setKanaMode] = useState<'hiragana' | 'katakana'>('hiragana');
  const [kanaQuiz, setKanaQuiz] = useState(false);

  useEffect(() => {
    const query = search.trim();
    if (!searchOpen || query.length < 2) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setSearchLoading(true);
      setSearchError('');
      fetch('/api/learning/search?q=' + encodeURIComponent(query), {
        credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      }).then(async (response) => {
        const body = await response.json() as { items?: GlobalSearchResult[]; error?: string };
        if (!response.ok) throw new Error(body.error || 'Search is unavailable right now.');
        return body.items ?? [];
      }).then(setSearchResults).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setSearchResults([]);
        setSearchError(error instanceof Error ? error.message : 'Search is unavailable right now.');
      }).finally(() => {
        if (!controller.signal.aborted) setSearchLoading(false);
      });
    }, 220);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [search, searchOpen]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
        searchInputRef.current?.focus();
      } else if (event.key === 'Escape') {
        setSearchOpen(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    let alive = true;
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const load = async () => {
      const generation = authGenerationRef.current;
      try {
        const authPromise = client.auth.getUser();
        const [authResult, dataSnapshot] = await Promise.all([
          authPromise,
          authPromise.then(({ data }) => loadLearnerSnapshot(data.user)),
        ]);
        const user = authResult.data.user;
        if (!alive || generation !== authGenerationRef.current) return;
        setConnected(true);
        setSignedIn(Boolean(user));
        if (user) {
          setName(dataSnapshot.displayName || user.email?.split('@')[0] || 'Learner');
        } else {
          setName('Learner');
            }
        setRomaji(dataSnapshot.showRomaji);
        setSnapshot(dataSnapshot);
      } catch {
        // Keep the public demo available if session lookup temporarily fails.
        if (!alive || generation !== authGenerationRef.current) return;
        setConnected(true);
        setSignedIn(false);
        setName('Learner');
        setRomaji(true);
        setSnapshot(createPreviewSnapshot());
      }
    };
    void load();
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      authGenerationRef.current += 1;
      setAuthViewKey((current) => current + 1);
      setConnected(true);
      setSignedIn(Boolean(session?.user));
      if (session?.user) {
        if (event === 'SIGNED_IN') {
          // Do not show a previous account's snapshot while the new profile loads.
          setSnapshot(createPreviewSnapshot());
          setName('Learner');
          setRomaji(true);
        }
        // Supabase may emit TOKEN_REFRESHED when a background tab becomes active.
        // Reload the profile rather than replacing the saved display name with email.
        window.setTimeout(() => {
          if (alive) void refreshLearnerSnapshot();
        }, 0);
      } else {
        // A signed-out workspace is demo mode, never the last account's dashboard.
        setSnapshot(createPreviewSnapshot());
        setRomaji(true);
        setName('Learner');
        }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [refreshLearnerSnapshot]);

  const flashcardContentLoaded = useRef(false);

  useEffect(() => {
    if (active === 'flashcards' && !flashcardContentLoaded.current) {
      flashcardContentLoaded.current = true;
      void getPublishedFlashcards().then((rows) => setFlashcardData(rows)).catch((error) => {
        console.error('[Nihongo Labs flashcard content bootstrap]', error);
      });
    }
  }, [active]);

  const titleMap: Record<string, string> = { overview: 'Overview', grammar: 'Grammar studio', vocabulary: 'Vocabulary', kanji: 'Kanji library', kana: 'Kana practice', practice: 'Daily practice', flashcards: 'Flashcard review', reading: 'Reading room', exams: 'Mock examinations', sentences: 'Sentence construction lab', progress: 'Your progress', plans: 'Learning plans', subscription: 'Membership' };
  const title = titleMap[active] || 'Overview';

  const changePreferredLevel = useCallback(async (level: JlptLevel) => {
    setSnapshot((current) => ({ ...current, preferredJlptLevel: level }));
    if (!signedIn) return;
    try {
      const response = await fetch('/api/learning/settings', {
        method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredJlptLevel: level }),
      });
      if (!response.ok) throw new Error('Could not save your selected JLPT level.');
    } catch {
      await refreshLearnerSnapshot();
    }
  }, [signedIn, refreshLearnerSnapshot]);

  function openSearchResult(result: GlobalSearchResult) {
    router.push(result.href);
    setSearchOpen(false);
    searchInputRef.current?.blur();
  }

  async function signOut() {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) return;
    authGenerationRef.current += 1;
    setAuthViewKey((current) => current + 1);
    setSignedIn(false);
    setSnapshot(createPreviewSnapshot());
    setRomaji(true);
    setName('Learner');
    router.push('/login');
  }



    const streak = signedIn ? snapshot.streak : 0;

  return (
    <div className={styles.appFrame}>
      <aside className={styles.sidebar}>
        <Brand href="/learn" tone="dark" className={styles.sidebarBrand} />
        <div className={styles.levelCard}><div className={styles.levelKicker}>YOUR CURRENT FOCUS</div><div className={styles.levelTitle}>JLPT {snapshot.preferredJlptLevel} <span>SELECTED</span></div><div className={styles.levelFoot}><span>Learn at your pace</span><span>✳</span></div></div>
        <nav className={styles.navigation} aria-label="Learning navigation">
          {navGroups.map((group) => <div className={styles.navGroup} key={group.label}><div className={styles.navLabel}>{group.label}</div>{group.items.map((item) => {
            const selected = item.key === 'overview' ? active === 'overview' : active === item.key;
            return <Link key={item.key} href={item.href} className={`${styles.navLink} ${selected ? styles.navActive : ''}`}><Icon>{item.icon}</Icon><span>{item.title}</span>{item.key === 'flashcards' && snapshot.due.flashcards > 0 && <em>{snapshot.due.flashcards}</em>}</Link>;
          })}</div>)}
        </nav>
        <div className={styles.sidebarBottom}><div className={styles.helpCard}><div className={styles.helpIcon}>?</div><strong>Ideas or issues?</strong><p>Share a suggestion, report a problem or tell us how we can improve.</p><Link href="/contact">Send feedback <span>↗</span></Link><Link href="/learn/reading">Open study guide <span>↗</span></Link></div><div className={styles.sidebarUser}><div className={styles.avatar}>{name.slice(0,1).toUpperCase()}</div><div className={styles.userMeta}><strong>{name}</strong><span>{signedIn ? (snapshot.premiumActive ? 'Premium member' : 'Free learner') : 'Preview learner'}</span></div><button type="button" aria-label="Account" onClick={() => router.push(signedIn ? '/learn/subscription' : '/login')}>···</button></div></div>
      </aside>

      <main className={styles.mainArea}>
        <header className={styles.topbar}><div className={styles.breadcrumb}>Workspace <span>/</span> <strong>{title}</strong></div><div className={styles.topActions}><div className={styles.searchWrap}><label className={styles.searchBox}><span>⌕</span><input ref={searchInputRef} value={search} onFocus={() => setSearchOpen(true)} onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") setSearchOpen(false); if (event.key === "Enter" && searchResults[0]) { event.preventDefault(); openSearchResult(searchResults[0]); } }} placeholder="Search lessons, words..."/><kbd>⌘ K</kbd></label>{searchOpen && search.trim().length >= 2 ? <div className={styles.searchResults} role="listbox" aria-label="Search results">{searchLoading ? <div className={styles.searchState}>Searching your learning library…</div> : searchError ? <div className={styles.searchState} role="status">{searchError}</div> : searchResults.length ? searchResults.map((result) => <button type="button" role="option" aria-selected="false" key={result.kind + "-" + result.id} className={styles.searchResult} onClick={() => openSearchResult(result)}><span className={styles.searchResultMeta}>{result.kind}{result.level ? " · " + result.level : ""}</span><strong>{result.title}</strong><small>{result.detail}</small></button>) : <div className={styles.searchState}>No matches found. Try a Japanese word, meaning or grammar pattern.</div>}</div> : null}</div>{signedIn ? <Link href="/contact" className={styles.feedbackLink}>Contact us</Link> : null}<button className={styles.iconButton} type="button" aria-label="Notifications">♧<i /></button><div className={styles.topAvatar}>{name.slice(0,1).toUpperCase()}</div>{signedIn ? <button className={styles.signOutButton} onClick={signOut}>Sign out</button> : <Link className={styles.signInButton} href="/login">Sign in</Link>}</div></header>
        <div className={styles.contentArea}>
          {!connected && <div className={styles.previewNotice}><span>●</span> Preview mode <span className={styles.noticeDivider}>·</span> Connect your local Supabase keys to load your saved learning data.</div>}
          {connected && !signedIn && <div className={styles.previewNotice}><span>●</span> Demo content <span className={styles.noticeDivider}>·</span> Sign in to load your personal progress.</div>}
          {active === 'overview' && <Dashboard key={`${signedIn ? 'signed-in' : 'demo'}-${authViewKey}-${snapshot.preferredJlptLevel}`} name={name} signedIn={signedIn} snapshot={snapshot} streak={streak} onLevelChange={changePreferredLevel} onContinue={() => router.push('/learn/grammar')} />}
          {active === 'plans' && <LearningPlans signedIn={signedIn} />}
          {active !== 'overview' && active !== 'progress' && active !== 'plans' && <Suspense fallback={<div className={styles.emptyState} role="status"><div>読</div><h2>Loading learning tools…</h2></div>}><LazyLearningFeature key={`${snapshot.preferredJlptLevel}-${focusedVocabularyId ?? ''}-${focusedVocabularyLevel ?? ''}`} active={active as LearningFeatureProps['active']} vocabularyItems={demoVocabulary} search={search} focusedVocabularyId={focusedVocabularyId} focusedVocabularyLevel={focusedVocabularyLevel} flashcardItems={flashcardData} signedIn={signedIn} romaji={romaji} setRomaji={setRomajiPreference} kanaMode={kanaMode} setKanaMode={setKanaMode} kanaQuiz={kanaQuiz} setKanaQuiz={setKanaQuiz} preferredLevel={snapshot.preferredJlptLevel === 'N4' ? 'N4' : 'N5'} onPreferredLevelChange={changePreferredLevel} onProgressSaved={refreshLearnerSnapshot} /></Suspense>}
          {active === 'progress' && <Progress key={`${signedIn ? 'signed-in' : 'demo'}-${authViewKey}`} snapshot={snapshot} streak={streak} signedIn={signedIn} />}
        </div>
        <footer className={styles.footer}><span>© 2026 Nihongo Labs</span><span>Made for curious minds <b>✳</b></span><span>Japanese learning, at your pace</span></footer>
      </main>
    </div>
  );
}

type DashboardLevelProgress = {
  level: JlptLevel;
  vocabulary: { completed: number; total: number };
  kanji: { completed: number; total: number };
  grammar: { completed: number; total: number };
  lessons: { completed: number; total: number };
  readiness: number;
};

function Dashboard({ name, signedIn, snapshot, streak, onLevelChange, onContinue }: {
  name: string;
  signedIn: boolean;
  snapshot: LearnerSnapshot;
  streak: number;
  onContinue: () => void;
  onLevelChange: (level: JlptLevel) => Promise<void>;
}) {
  const daysRemaining = getDaysUntilJlpt('2026-12-06', new Date(), 'Asia/Kolkata');
  const [level, setLevel] = useState<JlptLevel>(snapshot.preferredJlptLevel === 'N4' ? 'N4' : 'N5');
  const [levelProgress, setLevelProgress] = useState<DashboardLevelProgress | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    fetch(`/api/learning/level-progress?level=${level}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json() as DashboardLevelProgress & { error?: string };
        if (!response.ok) throw new Error(body.error || 'Could not load level progress.');
        return body;
      })
      .then((body) => { if (active) setLevelProgress(body); })
      .catch(() => { if (active) setLevelProgress(null); });
    return () => { active = false; };
  }, [level, signedIn]);

  const words = Number(snapshot.vocabularyCount ?? 0);
  const kanjiCount = Number(snapshot.kanjiCount ?? 0);
  const currentProgress = signedIn && levelProgress?.level === level ? levelProgress : null;
  const ready = currentProgress?.readiness ?? 0;
  const vocabularyCompleted = currentProgress?.vocabulary.completed ?? 0;
  const vocabularyTotal = currentProgress?.vocabulary.total ?? (level === 'N5' ? words : 0);
  const kanjiCompleted = currentProgress?.kanji.completed ?? 0;
  const kanjiTotal = currentProgress?.kanji.total ?? (level === 'N5' ? kanjiCount : 0);
  const vocabularyPercent = vocabularyTotal > 0 ? vocabularyCompleted / vocabularyTotal * 100 : 0;
  const kanjiPercent = kanjiTotal > 0 ? kanjiCompleted / kanjiTotal * 100 : 0;

  return <>
    <div className={styles.welcomeRow}>
      <div><div className={styles.eyebrow}>YOUR STUDY SPACE</div>
        <h1>こんにちは、{name}さん。 <span>ようこそ！</span></h1>
        <p>A little practice every day adds up. Ready to keep your momentum?</p>
      </div>
      <div className={styles.jlptCountdown} aria-label={`JLPT ${level} examination countdown`}>
        <span className={styles.jlptCountdownKicker}>NEXT JLPT · {level}</span>
        <strong>{daysRemaining === null ? '—' : daysRemaining === 0 ? 'Today' : daysRemaining > 0 ? daysRemaining : '—'}</strong>
        <span className={styles.jlptCountdownCopy}>{daysRemaining === 0 ? 'Exam day' : daysRemaining !== null && daysRemaining > 0 ? 'days remaining' : 'Date passed'}</span>
        <small className={styles.jlptCountdownDate}>6 December 2026</small>
      </div>
    </div>
    <section className={styles.heroCard}>
      <div className={styles.heroCopy}>
        <div className={styles.heroTag}><span /> YOUR NEXT STEP</div>
        <h2>Small steps.<br/><em>Fluent moments.</em></h2>
        <p>Pick up where you left off and make today count. Your next lesson is ready when you are.</p>
        <button type="button" className={styles.primaryButton} onClick={onContinue}>Continue learning <span>→</span></button>
        <div className={styles.heroMeta}><span>◷ Daily practice</span><span>•</span><span>JLPT {level} · Your pace</span></div>
      </div>
      <div className={styles.heroArt}><div className={styles.sunDisc} /><div className={styles.heroKanji}>学</div><div className={styles.heroArtNote}>MANABU <span>·</span> TO LEARN</div></div>
    </section>
    <div className={styles.sectionTop}>
      <div><div className={styles.eyebrow}>YOUR LEARNING PULSE</div><h2>Progress at a glance</h2></div>
      <div className={styles.dashboardLevelControl}>
        <JlptLevelSwitch value={level} onChange={(nextLevel) => { setLevel(nextLevel); void onLevelChange(nextLevel); }} label="Dashboard JLPT level" />
        <Link href="/learn/progress" className={styles.textLink}>View full report <span>→</span></Link>
      </div>
    </div>
    <section className={styles.statsGrid}>
      <StatCard icon="◉" label={`${level} learning progress`} value={`${ready}%`} note="Grammar, words, kanji and lessons" progress={ready} tone="green" />
      <StatCard icon="語" label={`${level} words learned`} value={`${vocabularyCompleted} / ${vocabularyTotal}`} note="Words marked as learned" progress={vocabularyPercent} tone="orange" />
      <StatCard icon="字" label={`${level} kanji known`} value={`${kanjiCompleted} / ${kanjiTotal}`} note="Characters marked as known" progress={kanjiPercent} tone="blue" />
      <StatCard icon="✳" label="Current streak" value={`${streak} days`} note="Days with learning activity" progress={Math.min(100, streak / 30 * 100)} tone="purple" />
    </section>
    <div className={styles.sectionTop}><div><div className={styles.eyebrow}>A GOOD PLACE TO START</div><h2>Today&apos;s focus</h2></div><span className={styles.mutedMeta}>Choose a short activity</span></div>
    <section className={styles.focusGrid}>
      <FocusCard number="01" title="Particles: は vs が" description="Understand the difference between topic and subject markers." meta="Grammar · 8 min" tag="CONTINUE" href="/learn/grammar" tone="green"/>
      <FocusCard number="02" title="Everyday essentials" description="Revise useful words about daily routines." meta="Vocabulary · 6 min" tag="REVIEW" href="/learn/vocabulary" tone="orange"/>
      <FocusCard number="03" title="A short Japanese story" description="Read a graded passage and check your understanding." meta="Reading · 6 min" tag="NEW" href="/learn/reading" tone="blue"/>
    </section>
  </>;
}
function StatCard({ icon, label, value, note, progress, tone }: { icon: string; label: string; value: string; note: string; progress: number; tone: Tone }) {
  return <div className={styles.statCard}><div className={styles.statTop}><span className={`${styles.statIcon} ${styles[`tone_${tone}`]}`}>{icon}</span><span className={styles.statMore}>···</span></div><div className={styles.statLabel}>{label}</div><div className={styles.statValue}>{value}</div><div className={styles.statNote}>{note}</div><ProgressBar value={progress} tone={tone === 'purple' ? 'blue' : tone}/></div>;
}
function FocusCard({ number, title, description, meta, tag, href, tone }: { number: string; title: string; description: string; meta: string; tag: string; href: string; tone: string }) {
  return <Link href={href} className={`${styles.focusCard} ${styles[`focus_${tone}`]}`}><div className={styles.focusTop}><span>{number}</span><small>{tag} ↗</small></div><h3>{title}</h3><p>{description}</p><div className={styles.focusMeta}><span>◷ {meta}</span><span>→</span></div></Link>;
}


type GrammarLevelProgress = { grammarIds: string[]; total: number; understood: number; attempts: number; correct: number; accuracy: number };
type SentenceProgressSummary = { totalSentences:number; totalAttempts:number; correctAttempts:number; accuracy:number; attemptedSentences:number; solvedSentences:number; migrationRequired?:boolean };

function Progress({snapshot,streak,signedIn}:{snapshot:LearnerSnapshot;streak:number;signedIn:boolean}) {
  const [sentenceProgress, setSentenceProgress] = useState<Record<'N5'|'N4', SentenceProgressSummary> | null>(null);
  const [grammarProgress, setGrammarProgress] = useState<Record<'N5'|'N4', GrammarLevelProgress> | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    void Promise.all((['N5', 'N4'] as const).map(async (level) => {
      const response = await fetch('/api/learning/sentence-construction?level=' + level, { credentials: 'same-origin', cache: 'no-store' });
      const body = await response.json() as SentenceProgressSummary & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Sentence progress is unavailable.');
      return [level, body] as const;
    })).then(([n5, n4]) => {
      if (active) setSentenceProgress({ N5: n5[1], N4: n4[1] });
    }).catch(() => { if (active) setSentenceProgress(null); });
    return () => { active = false; };
  }, [signedIn]);
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    void Promise.all((['N5', 'N4'] as const).map(async (level) => {
      const response = await fetch('/api/learning/grammar-progress?level=' + level, {
        credentials: 'same-origin', cache: 'no-store',
      });
      const body = await response.json() as GrammarLevelProgress & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Grammar progress is unavailable.');
      return [level, body] as const;
    })).then(([n5, n4]) => {
      if (active) setGrammarProgress({ N5: n5[1], N4: n4[1] });
    }).catch(() => { if (active) setGrammarProgress(null); });
    return () => { active = false; };
  }, [signedIn]);

  const mastery = snapshot.mastery || { grammar:0, vocabulary:0, kanji:0, reading:0, kana:0, overallLessons:0 };
  const scores = snapshot.recentScores || [];
  const overallPercentage = Math.max(0, Math.min(100, Number(snapshot.overallPercentage) || 0));

  return <><LearningIntelligence signedIn={signedIn}/><SectionHeading eyebrow="YOUR JOURNEY SO FAR" title="Look how far you’ve come." description="A clear view of your learning habits, topic mastery and exam readiness." action={<span className={styles.counterPill}>N5 learner</span>}/><div className={styles.progressHero}><div><div className={styles.eyebrow}>OVERALL N5 READINESS</div><div className={styles.bigPercent}>{overallPercentage}<span>%</span></div><p>Progress is calculated from assessed lessons, learned vocabulary, understood grammar, known kanji and graded reading/Kana practice.</p></div><div className={styles.progressBarWrap}><div className={styles.progressBarTrack} role="progressbar" aria-label="Overall N5 readiness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={overallPercentage}><span style={{width:`${overallPercentage}%`}} /></div><span className={styles.progressBarLabel}><strong>{overallPercentage}%</strong> complete</span></div></div><div className={styles.masteryGrid}><Mastery label="Grammar" value={mastery.grammar} tone="green" detail={`${snapshot.grammarUnderstood} of ${snapshot.grammarCount} N5 grammar points marked understood`}/><Mastery label="Vocabulary" value={mastery.vocabulary} tone="orange" detail={`${snapshot.vocabularyMastered} of ${snapshot.vocabularyCount} N5 words learned or mastered`}/><Mastery label="Kanji" value={mastery.kanji} tone="blue" detail={`${snapshot.kanjiMastered} of ${snapshot.kanjiCount} N5 characters marked known`}/><Mastery label="Reading" value={mastery.reading} tone="purple" detail={snapshot.readingAttempts ? `${snapshot.readingAttempts} graded reading attempts` : 'Complete a graded reading check to record progress'}/><Mastery label="Kana" value={mastery.kana} tone="green" detail={snapshot.kanaAttempts ? `${snapshot.kanaAttempts} graded Kana attempts` : 'Complete a Kana challenge to record progress'}/><Mastery label="Lessons" value={mastery.overallLessons} tone="orange" detail={`${snapshot.lessonsCompleted} of ${snapshot.lessonsTotal} assessed N5 lessons completed`}/></div><section className={styles.grammarProgressPanel}>
      <div className={styles.sentenceProgressHeading}>
        <div><div className={styles.eyebrow}>GRAMMAR MASTERY</div><h2>Grammar progress by JLPT level</h2><p>Lesson completion and practice performance are tracked separately.</p></div>
        <Link href="/learn/grammar" className={styles.textLink}>Study grammar <span>→</span></Link>
      </div>
      {!signedIn ? <p className={styles.sentenceProgressEmpty}>Sign in to track your grammar lessons and practice attempts.</p>
        : grammarProgress ? <div className={styles.grammarProgressLevels}>
          {(['N5', 'N4'] as const).map((level) => {
            const row = grammarProgress[level];
            const percent = row.total ? Math.min(100, (row.understood / row.total) * 100) : 0;
            return <article className={styles.grammarProgressLevel} key={level}>
              <div className={styles.grammarProgressTop}><strong>{level}</strong><span>{row.understood} / {row.total} understood</span></div>
              <div className={styles.sentenceProgressBar}><span style={{ width: percent + '%' }} /></div>
              <footer><span>{row.attempts} attempts</span><span>{row.accuracy}% accuracy</span></footer>
            </article>;
          })}
        </div> : <p className={styles.sentenceProgressEmpty}>Grammar progress is loading. Apply the grammar migrations locally to enable this report.</p>}
    </section><section className={styles.sentenceProgressPanel}>
    <div className={styles.sentenceProgressHeading}>
      <div><div className={styles.eyebrow}>SENTENCE CONSTRUCTION</div><h2>Build confidence, one sentence at a time.</h2><p>Your saved sentence attempts are included in your learning profile and grammar weakness analysis.</p></div>
      <Link href="/learn/sentences" className={styles.textLink}>Practise sentences <span>→</span></Link>
    </div>
    {!signedIn ? <p className={styles.sentenceProgressEmpty}>Sign in to track sentence construction across N5 and N4.</p>
      : sentenceProgress ? <div className={styles.sentenceProgressLevels}>{(['N5', 'N4'] as const).map((level) => {
        const row = sentenceProgress[level];
        const solvedPercent = row.totalSentences ? Math.min(100, row.solvedSentences / row.totalSentences * 100) : 0;
        return <article className={styles.sentenceProgressLevel} key={level}>
          <div><strong>{level}</strong><span>{row.solvedSentences} / {row.totalSentences} solved</span></div>
          <div className={styles.sentenceProgressBar}><span style={{width: solvedPercent + '%'}} /></div>
          <footer><span>{row.accuracy}% accuracy</span><span>{row.totalAttempts} attempts</span></footer>
        </article>;
      })}</div>
      : <p className={styles.sentenceProgressEmpty}>Sentence progress is loading.</p>}
    {signedIn && (sentenceProgress?.N5.migrationRequired || sentenceProgress?.N4.migrationRequired) ? <p className={styles.sentenceProgressEmpty}>Apply <code>20261110120000_sentence_construction_intelligence.sql</code> to enable saved attempts.</p> : null}
  </section><div className={styles.progressBottom}><div className={styles.panel}><div className={styles.eyebrow}>LEARNING CONSISTENCY</div><h3>{streak}-day learning streak</h3><p>Complete a lesson, quiz or review activity to add a learning day.</p></div><div className={styles.panel}><div className={styles.eyebrow}>RECENT TEST SCORES</div><h3>{scores.length ? 'Your latest results' : 'Your exam history will appear here.'}</h3><div className={styles.scoreBars}>{scores.slice(0,7).map((value:number,i:number)=><div key={i}><span style={{height:`${value}%`}}/><small>{i+1}</small></div>)}</div></div></div></>;
}
function Mastery({label,value,tone,detail}:{label:string;value:number;tone:Tone;detail?:string}){return <div className={styles.masteryCard}><div><strong>{label}</strong><b>{value}%</b></div><ProgressBar value={value} tone={tone}/><small>{detail ?? (value>=80?'Strong progress':value>=50?'Building confidence':'More practice recommended')}</small></div>}

