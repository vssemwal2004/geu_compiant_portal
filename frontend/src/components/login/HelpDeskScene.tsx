import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BadgeCheck, Camera, Route } from 'lucide-react';
import './HelpDeskScene.css';

/**
 * Animated "campus service desk" illustration for the login page.
 * Story (9 s loop): a lab assistant raises a complaint from a phone → the ticket flies to the desk →
 * staff take it on a call → it is resolved; both characters gesture and glass cards highlight each stage.
 * Interactions: pointer tilt (3D parallax) on desktop; tap/click anywhere for a confetti "resolved" cheer;
 * hovering the plant makes it rustle. Everything stops under prefers-reduced-motion.
 */

// Confetti pieces: direction, spin and colour. Values are in SVG user units.
const CONFETTI = [
  { dx: -70, dy: -90, r: 200, c: '#ffcc00' },
  { dx: -30, dy: -120, r: -160, c: '#00005c' },
  { dx: 10, dy: -130, r: 240, c: '#9fb3ff' },
  { dx: 50, dy: -110, r: -220, c: '#ffcc00' },
  { dx: 85, dy: -80, r: 180, c: '#4747a8' },
  { dx: -95, dy: -40, r: -140, c: '#9fb3ff' },
  { dx: 110, dy: -35, r: 260, c: '#ffcc00' },
  { dx: -50, dy: -150, r: 120, c: '#4747a8' },
  { dx: 30, dy: -160, r: -260, c: '#ffcc00' },
  { dx: 70, dy: -150, r: 150, c: '#00005c' },
];

export default function HelpDeskScene() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [cheer, setCheer] = useState(0);
  const [cheering, setCheering] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Pointer parallax: tilt follows the pointer within the scene's parent panel.
  useEffect(() => {
    const root = rootRef.current;
    const area = root?.closest('.login-brand') ?? root?.parentElement;
    if (!root || !area || reducedMotion || !window.matchMedia('(hover: hover)').matches) return;

    let frame = 0;
    function onMove(e: Event) {
      const { clientX, clientY } = e as PointerEvent;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = area!.getBoundingClientRect();
        const x = (clientX - r.left) / r.width - 0.5;
        const y = (clientY - r.top) / r.height - 0.5;
        root!.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
        root!.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`);
      });
    }
    function onLeave() {
      root!.style.setProperty('--ry', '0deg');
      root!.style.setProperty('--rx', '0deg');
    }
    area.addEventListener('pointermove', onMove);
    area.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      area.removeEventListener('pointermove', onMove);
      area.removeEventListener('pointerleave', onLeave);
    };
  }, [reducedMotion]);

  // Tap / click: celebrate a resolved ticket.
  useEffect(() => {
    if (!cheer) return;
    setCheering(true);
    const id = setTimeout(() => setCheering(false), 1700);
    return () => clearTimeout(id);
  }, [cheer]);

  return (
    <div className={`hd ${cheering ? 'is-cheering' : ''}`} ref={rootRef}>
      <div className="hd__stage" onClick={() => !reducedMotion && setCheer((c) => c + 1)}>
        <svg
          className="hd__svg"
          viewBox="0 0 600 480"
          role="img"
          aria-label="Illustration: a lab assistant reports an issue from a phone and a help desk staff member resolves it"
        >
          <defs>
            <linearGradient id="hd-bg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#e8ebff" />
              <stop offset="1" stopColor="#fff4cc" />
            </linearGradient>
            <linearGradient id="hd-glass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#e4eaff" />
              <stop offset="1" stopColor="#b3c0f0" />
            </linearGradient>
            <linearGradient id="hd-top" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#f6f8ff" />
              <stop offset="1" stopColor="#dbe2ff" />
            </linearGradient>
            <linearGradient id="hd-side" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#8a97d8" />
              <stop offset="1" stopColor="#5f6cbc" />
            </linearGradient>
            <linearGradient id="hd-shirt" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffd633" />
              <stop offset="1" stopColor="#f2b600" />
            </linearGradient>
            <linearGradient id="hd-navy" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#25259a" />
              <stop offset="1" stopColor="#00005c" />
            </linearGradient>
            <linearGradient id="hd-leaf" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#9fb3ff" />
              <stop offset="1" stopColor="#4747a8" />
            </linearGradient>
            <radialGradient id="hd-glow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#ffcc00" stopOpacity="0.55" />
              <stop offset="1" stopColor="#ffcc00" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Backdrop */}
          <circle cx="320" cy="250" r="200" fill="url(#hd-bg)" />
          <circle className="hd-orbit" cx="320" cy="250" r="226" fill="none" stroke="#c9c9e6" strokeWidth="1.5" strokeDasharray="2 9" />
          <g className="hd-spark" stroke="#b9bde6" strokeWidth="2" fill="none" strokeLinecap="round">
            <g style={{ transformOrigin: '96px 118px' }}>
              <circle cx="96" cy="118" r="7" />
              <path d="M96 104v-5M96 137v-5M82 118h-5M115 118h-5" />
            </g>
            <g style={{ transformOrigin: '540px 150px' }}>
              <circle cx="540" cy="150" r="6" />
              <path d="M540 138v-4M540 166v-4M528 150h-4M556 150h-4" />
            </g>
            <g style={{ transformOrigin: '560px 340px' }}>
              <circle cx="560" cy="340" r="5" />
            </g>
          </g>

          {/* Wall clock — the desk is open and working */}
          <g className="hd-clock">
            <circle cx="424" cy="150" r="17" fill="#fff" stroke="#00005c" strokeWidth="2.5" />
            <path d="M424 136v3M424 161v3M410 150h3M435 150h3" stroke="#9fb3ff" strokeWidth="2" strokeLinecap="round" />
            <path className="hd-clock__hour" d="M424 150v-8" stroke="#00005c" strokeWidth="2.6" strokeLinecap="round" />
            <path className="hd-clock__min" d="M424 150v-12" stroke="#f2b600" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="424" cy="150" r="2" fill="#00005c" />
          </g>

          {/* Floor */}
          <ellipse cx="320" cy="436" rx="250" ry="15" fill="#00005c" opacity="0.07" />
          <path d="M50 430H585" stroke="#c9c9e6" strokeWidth="2" strokeLinecap="round" />
          <path d="M120 446H260M300 446H470M180 458H330" stroke="#dcdcef" strokeWidth="2" strokeLinecap="round" />

          {/* Staff member behind the desk */}
          <g className="hd-staff">
            <rect x="316" y="222" width="88" height="86" rx="20" fill="#c9cdf0" />
            {/* Right arm: types, then raises a hand when the ticket is resolved */}
            <g className="hd-staff-arm">
              <g className="hd-typing">
                <path d="M392 262q16 16 10 30h-15q2-9-5-18z" fill="url(#hd-navy)" />
                <ellipse cx="394" cy="292" rx="9" ry="5" fill="#f4c7a5" />
              </g>
            </g>
            <path d="M326 300V254a34 34 0 0 1 68 0v46z" fill="url(#hd-navy)" />
            <path d="M350 224l10 15 10-15z" fill="#fff" />
            <rect x="353" y="208" width="14" height="17" rx="5" fill="#e3a982" />
            <g className="hd-staff__head">
              <circle cx="360" cy="190" r="22" fill="#f4c7a5" />
              <path d="M337 194c-3-23 12-36 24-36 17 0 28 13 25 31-5-10-14-15-26-15-10 0-18 6-23 20z" fill="#1d1d4f" />
              <path d="M338 190c-5 18-3 34 8 45l6-4c-6-10-8-24-6-41z" fill="#1d1d4f" />
              <path d="M383 186c6 16 4 34-6 46l-6-4c6-10 8-24 6-40z" fill="#1d1d4f" />
              <g className="hd-eyes">
                <circle cx="352" cy="193" r="2.2" fill="#1d1d4f" />
                <circle cx="368" cy="193" r="2.2" fill="#1d1d4f" />
              </g>
              <path className="hd-mouth" d="M354 202q6 4 12 0" stroke="#c2785a" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M337 186a23 23 0 0 1 46 0" fill="none" stroke="#ffcc00" strokeWidth="4" />
              <rect x="332" y="183" width="9" height="15" rx="4.5" fill="#ffcc00" />
              <path d="M336 197q3 14 17 14" stroke="#ffcc00" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </g>
            {/* On a call: sound waves from the headset */}
            <g className="hd-voice" stroke="#f2b600" strokeWidth="2.2" fill="none" strokeLinecap="round">
              <path d="M326 184q-6 8 0 16" />
              <path d="M319 179q-11 13 0 26" />
            </g>
            <g className="hd-typing hd-typing--alt">
              <path d="M328 262q-12 14-14 30h15q2-9 7-18z" fill="url(#hd-navy)" />
              <ellipse cx="322" cy="292" rx="9" ry="5" fill="#f4c7a5" />
            </g>
          </g>

          {/* Laptop on the desk (back faces the viewer) */}
          <g className="hd-laptop">
            <path d="M246 236h92l6 56h-104z" fill="#eef1ff" stroke="#b9c2ec" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="292" cy="264" r="15" fill="url(#hd-glow)" className="hd-laptop__glow" />
            <circle cx="292" cy="264" r="6" fill="#ffcc00" stroke="#00005c" strokeWidth="1.5" />
          </g>

          {/* Ticket printer: a slip slides out on a loop */}
          <g className="hd-printer">
            <rect className="hd-slip" x="424" y="258" width="22" height="22" rx="2" fill="#fff" stroke="#c9c9e6" />
            <path className="hd-slip" d="M428 264h14M428 269h9" stroke="#4747a8" strokeWidth="1.6" strokeLinecap="round" />
            <rect x="416" y="270" width="38" height="18" rx="5" fill="url(#hd-navy)" />
            <circle className="hd-printer__led" cx="446" cy="279" r="2.4" fill="#ffcc00" />
          </g>

          {/* Desk: top, side and glass front give the 3D block */}
          <g className="hd-desk">
            <polygon points="190,300 470,300 494,286 214,286" fill="url(#hd-top)" />
            <polygon points="470,300 494,286 494,414 470,428" fill="url(#hd-side)" />
            <rect x="190" y="300" width="280" height="128" fill="url(#hd-glass)" />
            <rect x="190" y="300" width="280" height="6" fill="#00005c" opacity="0.9" />
            <rect x="190" y="306" width="280" height="2" fill="#ffcc00" />
            <path className="hd-shine" d="M214 412L304 322" stroke="#fff" strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round" />
            <path d="M240 414L306 350" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
            <text x="352" y="378" textAnchor="middle" fontSize="12" fontWeight="800" letterSpacing="4" fill="#00005c" opacity="0.5">
              HELP DESK
            </text>
            <path d="M318 392h68" stroke="#fff" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
          </g>

          {/* Plant — every leaf moves on its own; one falls now and then */}
          <g className="hd-plant">
            <g className="hd-plant__leaves">
              <path d="M532 392C530 344 536 306 532 258" stroke="#4747a8" strokeWidth="3" fill="none" strokeLinecap="round" />
              <path d="M531 350c-8-4-14-12-16-20M533 318c8-4 13-11 15-19" stroke="#4747a8" strokeWidth="2" fill="none" strokeLinecap="round" />
              <g className="hd-leaf" style={{ '--d': '0s', '--a': '7deg' } as CSSProperties}>
                <ellipse cx="518" cy="330" rx="12" ry="30" transform="rotate(-28 518 330)" fill="url(#hd-leaf)" />
              </g>
              <g className="hd-leaf" style={{ '--d': '-0.8s', '--a': '-6deg' } as CSSProperties}>
                <ellipse cx="548" cy="312" rx="12" ry="30" transform="rotate(26 548 312)" fill="url(#hd-leaf)" />
              </g>
              <g className="hd-leaf" style={{ '--d': '-1.6s', '--a': '8deg' } as CSSProperties}>
                <ellipse cx="520" cy="284" rx="10" ry="26" transform="rotate(-20 520 284)" fill="#b9c6ff" />
              </g>
              <g className="hd-leaf" style={{ '--d': '-2.2s', '--a': '-7deg' } as CSSProperties}>
                <ellipse cx="544" cy="266" rx="9" ry="24" transform="rotate(22 544 266)" fill="#8fa3ff" />
              </g>
              <g className="hd-leaf hd-leaf--top" style={{ '--d': '-0.4s', '--a': '5deg' } as CSSProperties}>
                <ellipse cx="532" cy="246" rx="8" ry="20" fill="#c9d3ff" />
              </g>
            </g>
            <ellipse className="hd-falling-leaf" cx="552" cy="300" rx="4.5" ry="10" fill="#8fa3ff" />
            <rect x="508" y="388" width="48" height="9" rx="4.5" fill="#ffcc00" />
            <path d="M512 397h40l-5 31h-30z" fill="url(#hd-navy)" />
          </g>

          {/* Lab assistant raising a complaint from a phone */}
          <g className="hd-visitor">
            <rect x="104" y="332" width="15" height="94" rx="6" fill="#1d1d4f" />
            <rect x="124" y="332" width="15" height="94" rx="6" fill="#2b2b72" />
            <rect x="98" y="422" width="24" height="8" rx="4" fill="#00005c" />
            <rect x="122" y="422" width="24" height="8" rx="4" fill="#00005c" />
            {/* Free arm: hangs, then waves "thanks" when the ticket is resolved */}
            <g className="hd-wave-arm">
              <path d="M100 262q-8 30-4 58" stroke="#f2b600" strokeWidth="13" fill="none" strokeLinecap="round" />
              <circle cx="96" cy="324" r="6" fill="#e8b08b" />
            </g>
            <path d="M96 342V262a26 26 0 0 1 52 0v80z" fill="url(#hd-shirt)" />
            <path d="M112 240l10 50 10-50" stroke="#00005c" strokeWidth="2" fill="none" />
            <rect x="114" y="288" width="16" height="21" rx="3" fill="#fff" stroke="#00005c" strokeWidth="1.5" />
            <rect x="114" y="288" width="16" height="6" rx="2" fill="#00005c" />
            <rect x="115" y="222" width="13" height="18" rx="5" fill="#d9a07c" />
            <g className="hd-visitor__head">
              <circle cx="122" cy="206" r="21" fill="#e8b08b" />
              <path d="M101 205c-3-19 9-30 24-30 15 0 23 11 21 23-6-6-15-8-23-6-9 2-15 7-22 13z" fill="#1d1d4f" />
              <g className="hd-eyes hd-eyes--late">
                <circle cx="133" cy="206" r="2.2" fill="#1d1d4f" />
              </g>
              <path className="hd-mouth" d="M131 215q5 3 9-1" stroke="#a8604a" strokeWidth="2" fill="none" strokeLinecap="round" />
            </g>
            <g className="hd-phone-arm">
              <path d="M142 258l18 26 16-20" stroke="url(#hd-shirt)" strokeWidth="13" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="177" cy="262" r="6" fill="#e8b08b" />
              <rect x="170" y="234" width="15" height="25" rx="3.5" fill="#00005c" />
              <rect x="172.5" y="238" width="10" height="15" rx="1.5" fill="#ffcc00" className="hd-phone-screen" />
            </g>
            <g className="hd-bubble">
              <rect x="168" y="196" width="40" height="24" rx="12" fill="#fff" stroke="#c9c9e6" />
              <circle className="hd-dot" cx="180" cy="208" r="2.6" fill="#00005c" />
              <circle className="hd-dot" cx="188" cy="208" r="2.6" fill="#00005c" />
              <circle className="hd-dot" cx="196" cy="208" r="2.6" fill="#00005c" />
            </g>
          </g>

          {/* Ticket flight path: phone → desk */}
          <path id="hd-route" className="hd-route" d="M186 232C212 120 300 116 292 236" fill="none" stroke="#4747a8" strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />
          {!reducedMotion && (
            <g className="hd-ticket">
              <rect x="-11" y="-8" width="22" height="16" rx="3" fill="#ffcc00" stroke="#00005c" strokeWidth="1.5" />
              <path d="M-6 -2h12M-6 3h7" stroke="#00005c" strokeWidth="1.5" strokeLinecap="round" />
              <animateMotion dur="4.5s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.55;1" calcMode="linear">
                <mpath href="#hd-route" />
              </animateMotion>
              <animate attributeName="opacity" dur="4.5s" repeatCount="indefinite" values="0;1;1;0;0" keyTimes="0;0.06;0.5;0.58;1" />
            </g>
          )}

          {/* Tap/click celebration */}
          {cheer > 0 && (
            <g key={cheer} className="hd-confetti" transform="translate(330 282)">
              {CONFETTI.map((p, i) => (
                <rect
                  key={i}
                  x="-4"
                  y="-2.5"
                  width={i % 3 === 0 ? 7 : 9}
                  height={i % 3 === 0 ? 7 : 5}
                  rx={i % 3 === 0 ? 3.5 : 1.5}
                  fill={p.c}
                  style={{ '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--r': `${p.r}deg`, animationDelay: `${i * 18}ms` } as CSSProperties}
                />
              ))}
            </g>
          )}
        </svg>

        {/* Glass status cards — each lights up in turn */}
        <div className="hd-card hd-card--new">
          <span className="hd-card__icon">
            <Camera size={16} />
          </span>
          <span>
            <strong>New complaint</strong>
            <small>Computer · Lab 205</small>
          </span>
          <em>WhatsApp</em>
        </div>

        <div className="hd-card hd-card--route">
          <span className="hd-card__icon">
            <Route size={16} />
          </span>
          <span>
            <strong>Auto-routed</strong>
            <small>to GR IT Admin</small>
          </span>
        </div>

        <div className="hd-card hd-card--queue" aria-hidden="true">
          <strong>Live queue</strong>
          <span className="hd-bars">
            <i style={{ '--w': '72%' } as CSSProperties} />
            <i style={{ '--w': '48%' } as CSSProperties} />
            <i style={{ '--w': '88%' } as CSSProperties} />
          </span>
        </div>

        <div className="hd-card hd-card--done">
          <span className="hd-card__icon hd-card__icon--ok">
            <BadgeCheck size={16} />
          </span>
          <span>
            <strong>Resolved</strong>
            <small>Confirmed by lab assistant</small>
          </span>
        </div>
      </div>
    </div>
  );
}
