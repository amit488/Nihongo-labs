import Link from 'next/link';
import Brand from '@/components/nihongo/brand';

const features = [
  ['01', 'Grammar that makes sense', 'Learn particles and sentence patterns with guided explanations and targeted practice.'],
  ['02', 'Words and kanji that stick', 'Review vocabulary, readings and characters with a spaced-repetition routine.'],
  ['03', 'Practice with purpose', 'Use short daily exercises, reading passages and timed JLPT-style mock exams.'],
];

export default function HomePage() {
  return (
    <main className="landing">
      <header className="landingNav">
        <Brand href="/" />
        <nav><Link href="#method">How it works</Link><Link href="/pricing">Plans</Link><Link href="/contact">Contact us</Link><Link href="/login">Sign in</Link><Link href="/signup" className="navCta">Start learning <span>↗</span></Link></nav>
      </header>
      <section className="hero">
        <div className="heroCopy">
          <div className="eyebrow"><span /> A BETTER WAY TO STUDY JAPANESE</div>
          <h1>Make Japanese<br/><em>make sense.</em></h1>
          <p className="heroLead">A thoughtful learning space for the words, grammar and kanji that take you from your first kana to confident Japanese.</p>
          <div className="heroActions"><Link href="/learn" className="secondaryCta">Explore the workspace <span>→</span></Link></div>
          <div className="heroFootnote"><span>●</span> Build a steady daily habit, one lesson at a time.</div>
        </div>
        <div className="heroVisual" aria-label="Japanese study card preview">
          <div className="paperCard paperCardBack"><span className="tinyLabel">TODAY&apos;S PRACTICE</span><span className="backGlyph">学</span><span className="backCaption">Learn · Repeat · Remember</span></div>
          <div className="paperCard mainCard"><div className="cardTop"><span>GRAMMAR NOTE <b>01 / 26</b></span><span className="cardDot">●</span></div><div className="cardPattern">は <small>wa</small></div><h2>Marking the topic</h2><p>わたしは がくせいです。</p><div className="cardTranslation">I am a student.</div><div className="cardRule"><span>KEY IDEA</span><p>は introduces what the sentence is about. It is pronounced <b>wa</b> when used as a particle.</p></div><div className="cardBottom"><span>FOUNDATION GRAMMAR</span><span>↗</span></div></div>
          <div className="floatingChip streakChip"><b>7</b><span>DAY STREAK<br/>KEEP IT GOING</span></div>
          <div className="floatingChip progressChip"><div className="miniRing">68%</div><span>YOUR<br/>FOUNDATIONS</span></div>
          <span className="heroSeal">日本語<br/>を学ぼう</span>
        </div>
      </section>
      <section id="method" className="featureSection"><div className="sectionIntro"><span className="eyebrow">THE LEARNING SYSTEM</span><h2>Small steps.<br/><em>Real progress.</em></h2><p>Everything you need to build a reliable Japanese study habit, arranged in one clear path.</p></div><div className="featureList">{features.map(([number,title,copy])=><article key={number}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div><b>↗</b></article>)}</div></section>
      <footer className="landingFooter"><Brand href="/" /><span>Learn with intention. Grow every day.</span><Link href="/contact">Contact us</Link><Link href="/signup">Create your account ↗</Link></footer>
      <style>{`
        .landing{overflow:hidden}.landingNav{height:82px;max-width:1240px;margin:auto;padding:0 36px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line)}.wordmark{display:inline-flex;align-items:center;gap:10px;text-decoration:none;font-size:17px;letter-spacing:-.5px}.wordmark b{font-weight:750}.wordmarkIcon{width:31px;height:31px;display:grid;place-items:center;border-radius:9px;background:var(--brand);color:#fff;font-size:17px}.landingNav nav{display:flex;align-items:center;gap:28px}.landingNav nav a,.landingFooter>a:last-child{font-size:16px;text-decoration:none;color:#4f5b64}.landingNav nav .navCta{background:var(--brand);color:#fff;border-radius:7px;padding:13px 17px;box-shadow:0 8px 20px rgba(181,76,67,.14)}.navCta span{margin-left:12px}.hero{max-width:1240px;margin:auto;padding:82px 36px 96px;display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:50px;min-height:620px}.heroCopy{max-width:540px}.eyebrow{font-size:15px;letter-spacing:1.5px;font-weight:750;color:#8a969f;display:flex;align-items:center;gap:10px}.eyebrow>span{width:7px;height:7px;background:var(--brand);border-radius:50%}.eyebrow i{font-style:normal;color:var(--brand);background:#f5e8e5;padding:5px 8px;border-radius:4px;letter-spacing:.8px}.hero h1{font-size:clamp(56px,7vw,88px);line-height:.98;letter-spacing:-5px;font-weight:650;margin:29px 0 22px}.hero h1 em,.sectionIntro h2 em{font-family:Georgia,serif;font-weight:400;color:var(--brand)}.heroLead{max-width:470px;color:var(--muted);font-size:15px;line-height:1.8}.heroActions{display:flex;gap:22px;align-items:center;margin-top:34px}.heroActions a{text-decoration:none;font-size:16px;font-weight:650}.secondaryCta{color:#53616b}.secondaryCta span{font-size:18px;margin-left:6px}.heroFootnote{margin-top:42px;font-size:15px;color:#77858a}.heroFootnote span{color:#2e9178;margin-right:8px}.heroVisual{height:430px;position:relative;display:grid;place-items:center;background:radial-gradient(ellipse at 56% 46%,#e9e1d6 0%,#f2eee6 42%,rgba(247,241,237,0) 73%)}.paperCard{position:absolute;border:1px solid #ece8e3;border-radius:10px;background:#fff;box-shadow:0 25px 65px rgba(54,45,37,.12)}.paperCardBack{width:300px;height:350px;transform:rotate(8deg) translate(36px,5px);background:#f4eee8;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#b7a69b}.tinyLabel{position:absolute;top:24px;font-size:15px;letter-spacing:1.5px}.backGlyph{font-size:100px;color:#b9a99f;font-family:serif}.backCaption{font-size:15px;letter-spacing:1px}.mainCard{width:310px;min-height:365px;padding:22px 24px;transform:rotate(-3deg);z-index:1}.cardTop,.cardBottom{display:flex;justify-content:space-between;color:#9aa2a7;font-size:15px;letter-spacing:1.15px;font-weight:700}.cardTop b{color:var(--brand);margin-left:10px}.cardDot{color:var(--brand)}.cardPattern{font-size:57px;text-align:center;margin:24px auto 7px;font-family:serif}.cardPattern small{font:italic 16px Georgia;color:var(--brand)}.mainCard h2{text-align:center;font-size:17px;margin:0 0 19px;letter-spacing:-.3px}.mainCard>p{text-align:center;font-family:serif;font-size:20px;margin:0 0 5px}.cardTranslation{text-align:center;font-size:15px;color:#929ca3}.cardRule{margin-top:24px;padding:14px;background:#f2ece3;border-radius:6px}.cardRule>span{font-size:15px;letter-spacing:1px;color:var(--brand);font-weight:800}.cardRule p{font-size:15px;line-height:1.65;color:#64717b;margin:7px 0 0}.cardBottom{margin-top:20px}.floatingChip{position:absolute;z-index:2;display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #eceff1;border-radius:9px;padding:10px 13px;box-shadow:0 12px 35px rgba(30,45,56,.09)}.floatingChip span{font-size:15px;line-height:1.6;letter-spacing:.9px;color:#89949b;font-weight:750}.streakChip{top:60px;left:3%}.streakChip b{font:26px Georgia;color:var(--brand)}.progressChip{right:1%;bottom:38px}.miniRing{border:3px solid #e4eee9;border-top-color:#2e9178;border-radius:50%;height:41px;width:41px;display:grid;place-items:center;font-size:15px;color:#287a65;font-weight:800}.heroSeal{position:absolute;top:38px;right:6%;font-family:serif;font-size:15px;line-height:1.35;color:#c7a79a;writing-mode:vertical-rl;letter-spacing:3px}.featureSection{background:#fff;border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:100px max(36px,calc((100vw - 1168px)/2));display:grid;grid-template-columns:.85fr 1.15fr;gap:90px}.sectionIntro h2{font-size:46px;line-height:1.05;letter-spacing:-2px;margin:22px 0 15px}.sectionIntro p{font-size:17px;line-height:1.8;color:#73808a;max-width:330px}.featureList article{display:grid;grid-template-columns:40px 1fr 20px;gap:18px;padding:24px 0;border-bottom:1px solid var(--line);align-items:start}.featureList article>span{font:17px Georgia;color:var(--brand)}.featureList h3{font-size:16px;margin:0 0 8px;letter-spacing:-.3px}.featureList p{max-width:460px;color:#79858e;font-size:16px;line-height:1.7;margin:0}.featureList article>b{color:var(--brand);font-size:15px}.landingFooter{max-width:1240px;margin:auto;padding:27px 36px;display:flex;justify-content:space-between;align-items:center}.landingFooter>span{font-size:15px;color:#8c979e}.landingFooter>a:last-child{color:var(--brand);font-weight:700}.landingFooter>a[href='/contact']{color:#65727b;text-decoration:none;font-weight:650}@media(max-width:800px){.landingNav{padding:0 20px}.landingNav nav{gap:14px}.landingNav nav a:not(.navCta){display:none}.hero{padding:54px 22px 64px;grid-template-columns:1fr;gap:12px}.hero h1{font-size:64px}.heroVisual{height:400px}.featureSection{padding:66px 22px;grid-template-columns:1fr;gap:26px}.landingFooter{padding:23px 20px;gap:10px;flex-wrap:wrap}.landingFooter>span{display:none}}@media(max-width:430px){.hero h1{font-size:56px;letter-spacing:-3px}.heroActions{gap:14px;flex-wrap:wrap}.mainCard{width:280px}.paperCardBack{width:270px}.streakChip{left:0}.progressChip{right:0}}
      
        .landing{background:var(--paper);color:var(--ink)}
        .landingNav{border-color:var(--line)}
        .landingNav nav a{transition:color .2s ease,transform .2s ease}
        .landingNav nav a:hover{color:var(--brand);transform:translateY(-1px)}
        .landingNav nav .navCta{border-radius:999px;background:var(--brand);box-shadow:0 12px 28px rgba(168,79,67,.2)}
        .heroVisual{background:radial-gradient(ellipse at 56% 46%,#e8dfd2 0%,#f0e9df 42%,rgba(240,233,223,0) 73%)}
        .paperCard{border-color:#e7dfd4;border-radius:17px;box-shadow:0 28px 70px rgba(29,41,51,.13)}
        .mainCard{border-radius:18px;box-shadow:0 30px 75px rgba(29,41,51,.16)}
        .cardRule{background:#f4eee5;border:1px solid #eee5d9}
        .floatingChip{border-color:#e8dfd4;border-radius:13px;box-shadow:0 16px 38px rgba(29,41,51,.12)}
        .featureSection{background:var(--surface);border-color:var(--line)}
        .featureList article{border-color:var(--line);transition:padding .2s ease}
        .featureList article:hover{padding-left:8px}
        .featureList article>span,.featureList article>b{color:var(--brand)}
        .landingFooter{border-color:var(--line)}
        @media(max-width:800px){.landingNav nav .navCta{padding:11px 14px}.heroVisual{border-radius:22px}}

        /* Interactive visual refresh v2 — polished editorial learning product. */
        .landing{background:#f3f6fb;color:#17243a}
        .landingNav{border-color:#e4eaf3}
        .wordmarkIcon{background:linear-gradient(145deg,#5367e8,#4fc8b4);box-shadow:0 8px 19px rgba(83,103,232,.2)}
        .landingNav nav a{color:#5f6f88;transition:color .18s,transform .18s}
        .landingNav nav a:hover{color:#5367e8;transform:translateY(-2px)}
        .landingNav nav .navCta{background:linear-gradient(110deg,#5367e8,#657cf0);border-radius:11px;box-shadow:0 12px 26px rgba(83,103,232,.2)}
        .eyebrow{color:#6575c7}
        .eyebrow>span{background:#5367e8;box-shadow:0 0 0 5px rgba(83,103,232,.1)}
        .eyebrow i{color:#5367e8;background:#eef1ff}
        .hero h1{color:#17243a;letter-spacing:-4.8px}
        .hero h1 em,.sectionIntro h2 em{color:#5367e8}
        .heroLead{color:#748198}
        .heroVisual{background:radial-gradient(ellipse at 55% 48%,#e5eaff 0%,#f0f3ff 43%,rgba(240,243,255,0) 76%);border-radius:26px}
        .paperCard{border-color:#e1e8f4;border-radius:18px;box-shadow:0 28px 70px rgba(20,37,68,.12)}
        .paperCardBack{background:linear-gradient(145deg,#e7ebff,#f4f7ff);color:#9ba9d2}
        .backGlyph{color:#9ba9d2}
        .mainCard{border-radius:20px;box-shadow:0 32px 78px rgba(20,37,68,.17)}
        .cardPattern{color:#263d79}
        .cardPattern small{color:#5367e8}
        .cardRule{background:#f1f4ff;border:1px solid #e5eaff;border-radius:9px}
        .cardRule>span{color:#5367e8}
        .floatingChip{border-color:#e1e8f3;border-radius:13px;box-shadow:0 16px 38px rgba(20,37,68,.13)}
        .floatingChip span{color:#72819a}
        .streakChip b{color:#5367e8}
        .miniRing{border-color:#e5eaff;border-top-color:#4fc8b4;color:#5367e8}
        .heroSeal{color:#8997be}
        .featureSection{background:#fff;border-color:#e4eaf3}
        .sectionIntro h2{color:#17243a}
        .sectionIntro p,.featureList p{color:#748198}
        .featureList article{border-color:#e9eef6;transition:transform .2s,padding .2s}
        .featureList article:hover{padding-left:9px;transform:translateX(2px)}
        .featureList article>span,.featureList article>b{color:#5367e8}
        .landingFooter{border-color:#e4eaf3}
        .landingFooter>a:last-child{color:#5367e8}
        .landingFooter>a[href='/contact']{color:#65748b}
        @media(max-width:800px){.landingNav nav .navCta{padding:11px 14px}.heroVisual{border-radius:21px}}
        @media(prefers-reduced-motion:no-preference){
          .paperCard.mainCard{animation:landingCardFloat 7s ease-in-out infinite}
          .floatingChip{animation:landingChipFloat 6s ease-in-out infinite}
          @keyframes landingCardFloat{0%,100%{transform:rotate(-3deg) translateY(0)}50%{transform:rotate(-2deg) translateY(-7px)}}
          @keyframes landingChipFloat{0%,100%{translate:0 0}50%{translate:0 -5px}}
        }
`}</style>
    </main>
  );
}
