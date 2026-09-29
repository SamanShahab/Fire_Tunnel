import { useEffect, useState } from "react";

const particles = Array.from({ length: 20 }, (_, index) => index);
const securityStatuses = [
  { delay: 0, text: "INITIALIZING SECURE CONNECTION..." },
  { delay: 1650, text: "ENCRYPTION PROTOCOL: ACTIVE" },
  { delay: 3150, text: "AUTHENTICATING SECURITY PROTOCOLS..." },
  { delay: 4700, text: "SECURITY CHECK: VERIFIED" },
  { delay: 5910, text: "ACCESS GRANTED ✓" },
];

export default function IntroLoader() {
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const timers = securityStatuses.slice(1).map(({ delay }, index) => (
      window.setTimeout(() => setStatusIndex(index + 1), delay)
    ));

    return () => timers.forEach(window.clearTimeout);
  }, []);

  return (
    <div className="entry-loader" role="status" aria-label="Securing your session">
      <video className="loader-background-video" autoPlay loop muted playsInline preload="auto" src="/firetunnel-pin-bg.mp4" aria-hidden="true" />
      <div className="loader-grid" aria-hidden="true" />
      <div className="loader-code" aria-hidden="true">
        <span>0101 // SECURE NODE // 1001</span>
        <span>ACCESS CONTROL :: 0x04F2</span>
        <span>ENCRYPTION ACTIVE :: AES-256</span>
      </div>
      <div className="loader-circuit loader-circuit-one" aria-hidden="true" />
      <div className="loader-circuit loader-circuit-two" aria-hidden="true" />
      <span className="loader-node loader-node-one" aria-hidden="true" />
      <span className="loader-node loader-node-two" aria-hidden="true" />
      <span className="loader-node loader-node-three" aria-hidden="true" />

      <div className="loader-stage" aria-hidden="true">
        <div className="loader-pulse" />
        <svg className="loader-lock" viewBox="0 0 260 300" role="presentation">
          <defs>
            <linearGradient id="loader-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff1be" />
              <stop offset="0.38" stopColor="#d4af37" />
              <stop offset="0.72" stopColor="#806b20" />
              <stop offset="1" stopColor="#f4d879" />
            </linearGradient>
            <linearGradient id="loader-body" x1="0" y1="0" x2="0.9" y2="1">
              <stop offset="0" stopColor="#382d14" />
              <stop offset="0.48" stopColor="#15130c" />
              <stop offset="1" stopColor="#30240e" />
            </linearGradient>
            <mask id="loader-keyhole-mask" maskUnits="userSpaceOnUse" x="28" y="128" width="204" height="144">
              <rect x="28" y="128" width="204" height="144" rx="18" fill="white" />
              <circle cx="130" cy="194" r="9" fill="black" />
              <path d="M124 200h12l7 22h-26z" fill="black" />
            </mask>
          </defs>
          <path className="loader-shackle" d="M78 145V94a52 52 0 0 1 104 0v51" fill="none" stroke="url(#loader-gold)" strokeWidth="10" strokeLinecap="round" />
          <rect className="loader-lock-body" x="28" y="128" width="204" height="144" rx="18" fill="url(#loader-body)" mask="url(#loader-keyhole-mask)" />
          <rect x="28" y="128" width="204" height="144" rx="18" fill="none" stroke="url(#loader-gold)" strokeWidth="3" />
          <rect x="36" y="136" width="188" height="128" rx="13" fill="none" stroke="rgba(255,224,143,0.22)" strokeWidth="1" />
          <path d="M130 148l30 12v25c0 22-13 38-30 48-17-10-30-26-30-48v-25z" fill="none" stroke="url(#loader-gold)" strokeWidth="2" opacity="0.62" />
          <g className="loader-cylinder">
            <circle cx="130" cy="194" r="13" fill="none" stroke="url(#loader-gold)" strokeWidth="1.5" />
            <path d="M130 204v13" stroke="url(#loader-gold)" strokeWidth="1.2" opacity="0.72" />
          </g>
          <path d="M54 249h46" stroke="url(#loader-gold)" strokeWidth="1" opacity="0.32" />
          <path d="M160 249h46" stroke="url(#loader-gold)" strokeWidth="1" opacity="0.32" />
        </svg>
        <svg className="loader-key-shaft" viewBox="0 0 100 48">
          <g transform="translate(-64 -24)">
            <path d="M39 24h52v8H79v8H68v-8H57v-8" fill="none" stroke="url(#loader-gold)" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
            <path d="M44 18h35" stroke="#fff1be" strokeWidth="1" opacity="0.45" />
          </g>
        </svg>
        <svg className="loader-key-bow" viewBox="0 0 100 48">
          <g transform="translate(-64 -24)">
            <circle cx="23" cy="24" r="17" fill="#100d07" stroke="url(#loader-gold)" strokeWidth="5" />
            <circle cx="23" cy="24" r="10" fill="none" stroke="url(#loader-gold)" strokeWidth="2" />
            <circle cx="23" cy="24" r="4" fill="#d4af37" />
          </g>
        </svg>
        <div className="loader-particles">
          {particles.map((particle) => (
            <span
              key={particle}
              className="loader-particle"
              style={{
                "--burst-x": `${((particle % 5) - 2) * 76}px`,
                "--burst-y": `${(Math.floor(particle / 5) - 1.5) * 64}px`,
                "--particle-delay": `${5.88 + (particle % 5) * 0.04}s`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="loader-intro-copy" aria-live="polite" aria-atomic="true">
        <span className="loader-intro-label">FIRETUNNEL <i /> SECURITY OPERATIONS</span>
        <h1 className="loader-welcome-title">WELCOME TO THE <strong>FIRETUNNEL</strong></h1>
        <div className={`loader-status-line ${statusIndex === securityStatuses.length - 1 ? "is-granted" : ""}`}>
          <span className="loader-prompt">&gt;</span>
          <span key={securityStatuses[statusIndex].text} className="loader-status-text">{securityStatuses[statusIndex].text}</span>
          <span className="loader-cursor" aria-hidden="true" />
        </div>
      </div>
      <div className="loader-footer" aria-hidden="true">
        <span><i /> SOC LINK ENCRYPTED</span>
        <span>AUTHENTICATING ENVIRONMENT</span>
      </div>
    </div>
  );
}