'use client';

import { useEffect, useMemo, useState } from 'react';
import type { KanjiItem } from '@/lib/nihongo/demo-content';
import { SectionHeading, type JlptLevel } from './learning-shared';
import styles from './learning-app.module.css';

const KANJI_THEME_GROUPS: Array<{ title: string; description: string; characters: string }> = [
  { title: 'Numbers, quantities & money', description: 'Count, compare amounts and recognise everyday money-related characters.', characters: '一二三四五六七八九十百千万円金銀号級第丁倍両列等' },
  { title: 'Time, dates & sequence', description: 'Build a vocabulary for days, dates, clocks and the order of events.', characters: '日月年時分半今毎週間前後午先曜期次秒度昔予代' },
  { title: 'People, family & relationships', description: 'Characters for people, family connections, roles and social relationships.', characters: '人男女子父母友名客君者主族童他相世様礼育' },
  { title: 'Body, health & senses', description: 'Learn the body, the senses and common health-related terms.', characters: '目耳口手足血指歯身鼻皮面息病医薬死命生' },
  { title: 'Learning, language & communication', description: 'Study characters used in school, reading, writing, speaking and asking questions.', characters: '学校語本文書読聞言話何漢究研詩問題章帳調申習勉練談写' },
  { title: 'Daily actions & responsibilities', description: 'Everyday tasks, interactions, decisions and things we do.', characters: '休見仕使取受持拾始終住待助守消決整打返放注定開集勝負会配' },
  { title: 'Movement, travel & transport', description: 'Movement from place to place and actions involved in travelling.', characters: '行来出入運泳起去進追乗発着転登動投遊落送車' },
  { title: 'Food, drink & shopping', description: 'Common meals, ingredients, beverages and buying things.', characters: '食飲買皿酒豆茶湯味油品肉' },
  { title: 'Nature, weather & landscape', description: 'Elements, weather, terrain, water and the natural world.', characters: '火水木土山川天雨温寒暑陽波氷湖岸島洋深炭鉄流' },
  { title: 'Animals, plants & farming', description: 'Living things, plant growth and agricultural life.', characters: '羊犬猫魚根葉植畑農' },
  { title: 'Places, buildings & travel destinations', description: 'Countries, neighbourhoods, buildings and destinations.', characters: '国外駅院界館宮橋区県庫港州室宿所庭屋都坂旅路柱階' },
  { title: 'Directions, position & space', description: 'Position, orientation, sides and spatial relationships.', characters: '上下左右北南東西中央横向' },
  { title: 'Qualities, colours & comparisons', description: 'Describe size, condition, speed, colours and contrasts.', characters: '大小高安新古長多少白悪暗苦急軽重短速全美赤青黒色緑平真質' },
  { title: 'Thoughts, feelings & abstract ideas', description: 'Mental states, emotions and concepts that are harder to picture.', characters: '気意感想幸悲福神由有反対化事' },
  { title: 'Objects, tools & materials', description: 'Everyday objects, instruments, luggage and materials.', characters: '電具荷球笛筆箱板物服表' },
  { title: 'Work, roles & culture', description: 'Jobs, organisations, public roles and cultural activities.', characters: '社員係業商局部役曲祭和' },
];

export default function KanjiStudio({ search, preferredLevel, onPreferredLevelChange, onProgressSaved }: { search: string; preferredLevel: JlptLevel; onPreferredLevelChange: (level: JlptLevel) => Promise<void>; onProgressSaved: () => Promise<void> }) {
  const [level, setLevel] = useState<JlptLevel>(preferredLevel);
  const [deckItems, setDeckItems] = useState<KanjiItem[]>([]);
  const [selected, setSelected] = useState('');
  const [flipped, setFlipped] = useState(false);
  const [query, setQuery] = useState(search);
  const [status, setStatus] = useState<Record<string, 'known' | 'learning'>>({});
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const filtered = useMemo(() => deckItems.filter((row) => `${row.character} ${row.meaning} ${row.radical}`.toLowerCase().includes(query.toLowerCase())), [deckItems, query]);
  const selectedItem = filtered.find((row) => row.id === selected) || filtered[0] || deckItems[0];
  const groupedKanji = useMemo(() => {
    const groups = KANJI_THEME_GROUPS.map((group) => ({
      title: group.title,
      description: group.description,
      items: filtered.filter((row) => group.characters.includes(row.character)),
    })).filter((group) => group.items.length > 0);
    const assignedCharacters = new Set(groups.flatMap((group) => group.items.map((row) => row.character)));
    const ungrouped = filtered.filter((row) => !assignedCharacters.has(row.character));
    if (ungrouped.length) groups.push({
      title: 'Additional kanji',
      description: 'Newly added characters awaiting a curriculum theme.',
      items: ungrouped,
    });
    return groups;
  }, [filtered]);
  const knownCount = Object.values(status).filter((value) => value === 'known').length;
  const learningCount = Object.values(status).filter((value) => value === 'learning').length;

  useEffect(() => {
    const handleSignedOut = () => {
      setSignedIn(false);
      setStatus({});
    };
    window.addEventListener('nihongo:auth-signed-out', handleSignedOut);
    return () => window.removeEventListener('nihongo:auth-signed-out', handleSignedOut);
  }, []);

  useEffect(() => {
    let alive = true;
    void fetch('/api/kanji/session', { credentials: 'same-origin', cache: 'no-store' }).then((response) => response.ok ? response.json() as Promise<{ signedIn?: boolean }> : null).then((body) => { if (alive) setSignedIn(Boolean(body?.signedIn)); }).catch((error) => {
      console.error('[Nihongo Labs kanji auth status]', error);
    });

    void fetch(`/api/learning/content?kind=kanji&level=${level}&limit=250`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load this kanji deck.');
        const body = await response.json() as { items?: Array<{ id:string; character:string; meaning:string; on_yomi:string[]|null; kun_yomi:string[]|null; stroke_count:number|null; radical:string|null; example_words:Array<{word?:string;reading?:string;meaning?:string}>|null }> };
        const mapped = (body.items || []).map((row) => {
          const example = row.example_words?.[0];
          return { id:row.id, character:row.character, meaning:row.meaning, onYomi:row.on_yomi||[], kunYomi:row.kun_yomi||[], strokes:row.stroke_count||0, radical:row.radical||'', example: example ? `${example.word||''}${example.reading ? `（${example.reading}）` : ''}` : '', exampleMeaning:example?.meaning||'' };
        });
        if (alive) { setDeckItems(mapped); setSelected(mapped[0]?.id || ''); setFlipped(false); }
      })
      .catch((error) => {
        console.error('[Nihongo Labs kanji content]', error);
        if (alive) {
          setDeckItems([]);
          setSelected('');
          setNotice(error instanceof Error ? error.message : 'Could not load kanji.');
        }
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [level]);

  useEffect(() => {
    let alive = true;
    if (!signedIn) return () => { alive = false; };
    void fetch(`/api/kanji/progress?level=${level}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load kanji progress.');
        return response.json() as Promise<{ progress?: Array<{kanji_id:string;status:'known'|'learning'}> }>;
      })
      .then((body) => { if (alive && body?.progress) setStatus(Object.fromEntries(body.progress.map((row) => [row.kanji_id,row.status]))); })
      .catch((error) => {
        console.error('[Nihongo Labs kanji progress]', error);
        if (alive) setNotice('Could not load kanji progress. Please refresh this section.');
      });
    return () => { alive = false; };
  }, [level, signedIn]);

  function changeLevel(nextLevel: JlptLevel) {
    if (nextLevel === level) return;
    setLoading(true);
    setNotice('');
    setLevel(nextLevel);
    void onPreferredLevelChange(nextLevel);
    setQuery('');
    setFlipped(false);
  }

  async function markFamiliarity(value: 'known' | 'learning') {
    if (!selectedItem || !signedIn || reviewLoading) return;
    setReviewLoading(true);
    setNotice(value === 'known' ? 'Saving known status…' : 'Saving learning status…');
    try {
      const response = await fetch('/api/kanji/review', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ kanjiId:selectedItem.id, status:value }) });
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || (response.status === 401 ? 'Sign in to save your kanji progress.' : 'Progress could not be saved.')); }
      setStatus((current) => ({ ...current, [selectedItem.id]: value }));
      setNotice(value === 'known' ? 'Your progress has been saved.' : 'Added to your review list.');
      await onProgressSaved();
    } catch (error) {
      console.error('[Nihongo Labs kanji review]', error);
      setNotice(error instanceof Error ? error.message : 'Your selection could not be saved.');
    }
    finally { setReviewLoading(false); }
  }

  return <>
    <SectionHeading eyebrow="THE BUILDING BLOCKS" title="Meet your kanji." description="Explore characters in related themes, flip for meanings and readings, and build your own familiarity over time." action={<span className={styles.counterPill}>{deckItems.length} characters</span>}/>
    <div className={styles.kanjiLevelTabs} aria-label="Kanji deck level">
      <button type="button" aria-pressed={level==='N5'} onClick={()=>changeLevel('N5')}>N5 kanji</button>
      <button type="button" aria-pressed={level==='N4'} onClick={()=>changeLevel('N4')}>N4 kanji</button>
    </div>
    <div className={styles.kanjiControls}>
      <input aria-label="Search kanji" placeholder="Search kanji or meaning…" value={query} onChange={(event)=>setQuery(event.target.value)}/>
      <span className={styles.kanjiCount}>{filtered.length} of {deckItems.length} characters · {knownCount} known · {learningCount} learning</span>
    </div>
    {notice ? <div className={styles.billingNote}>{notice}</div> : null}
    {loading ? <div className={styles.kanjiDeckEmpty}>Loading {level} kanji…</div> : !filtered.length ? <div className={styles.kanjiDeckEmpty}>No kanji found in this deck.</div> :
      <div className={styles.kanjiLayout}>
        <div className={styles.kanjiGroups}>
          {groupedKanji.map((group) => (
            <section className={styles.kanjiGroup} key={group.title} aria-label={group.title}>
              <div className={styles.kanjiGroupHeading}>
                <div>
                  <h3>{group.title}</h3>
                  <p>{group.description}</p>
                </div>
                <span>{group.items.length} characters</span>
              </div>
              <div className={styles.kanjiGrid}>
                {group.items.map((row) => (
                  <button type="button" key={row.id} onClick={()=>{setSelected(row.id);setFlipped(false);}} className={`${styles.kanjiTile} ${row.id===selected?styles.kanjiSelected:''}`}>
                    <strong>{row.character}</strong>
                    <span>{row.meaning}</span>
                    <small>{row.strokes} strokes</small>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        {selectedItem&&<div className={styles.kanjiDetail}>
          <button type="button" aria-label={flipped?'Show kanji front':'Flip kanji card'} onClick={()=>setFlipped((value)=>!value)} style={{width:'100%',border:0,background:'transparent',padding:0,cursor:'pointer'}} aria-pressed={flipped}>
            <div className={styles.kanjiBig}>{selectedItem.character}</div>
            {flipped ? <div className={styles.kanjiMeaning}>{selectedItem.meaning}</div> : <div className={styles.kanjiMeaning} aria-hidden="true" style={{opacity:0}}>Tap to reveal</div>}
            <div className={styles.kanjiMeta}><span>{selectedItem.strokes} strokes</span><span>Radical · {selectedItem.radical || '—'}</span><span>{level}</span></div>
            <div className={styles.kanjiCardHint}>{flipped?'TAP TO HIDE DETAILS':'TAP CARD TO REVEAL READINGS ↻'}</div>
          </button>
          {flipped ? <div className={styles.readingBlock}>
            <div><small>ONYOMI · 音読み</small><strong>{selectedItem.onYomi.join(' · ')||'—'}</strong><p>Chinese-origin readings, commonly used in compound words.</p></div>
            <div><small>KUNYOMI · 訓読み</small><strong>{selectedItem.kunYomi.join(' · ')||'—'}</strong><p>Native Japanese readings, often used with okurigana.</p></div>
            <div className={styles.kanjiExample}><small>EXAMPLE WORD</small><strong>{selectedItem.example||'Examples being prepared'}</strong><span>{selectedItem.exampleMeaning||'See the readings above for common usage.'}</span></div>
            <div className={styles.kanjiFamiliarity}>
              <span>How familiar are you with this kanji?</span>
              <div><button type="button" title={signedIn?'Save learning status':'Sign in to save progress'} disabled={!signedIn || reviewLoading} onClick={()=>void markFamiliarity('learning')}>{reviewLoading?'Saving…':'Still learning'}</button><button type="button" title={signedIn?'Save learning status':'Sign in to save progress'} disabled={!signedIn || reviewLoading} onClick={()=>void markFamiliarity('known')}>Know it ✓</button></div>
              <small>{status[selectedItem.id]==='known'?'Marked as known':status[selectedItem.id]==='learning'?'In your learning review':'Not reviewed yet'}</small>
            </div>
          </div> : null}
        </div>}
      </div>}
  </>;
}
