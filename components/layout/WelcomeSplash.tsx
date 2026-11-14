"use client";

import { useEffect, useState } from "react";

export function WelcomeSplash() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [welcomeFading, setWelcomeFading] = useState(false);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem("haddir_splash") === "1"; } catch {}
    if (seen) { setShowWelcome(false); return; }
    try { sessionStorage.setItem("haddir_splash", "1"); } catch {}
    let removeTimer: number | undefined;
    const fadeTimer = window.setTimeout(() => {
      setWelcomeFading(true);
      removeTimer = window.setTimeout(() => setShowWelcome(false), 450);
    }, 2600);
    return () => {
      window.clearTimeout(fadeTimer);
      if (removeTimer !== undefined) window.clearTimeout(removeTimer);
    };
  }, []);

  if (!showWelcome) return null;
  return {showWelcome&&<div id="haddir-splash" className={welcomeFading?"out":""} role="img" aria-label="حاضر" onClick={()=>{if(!welcomeFading){setWelcomeFading(true);window.setTimeout(()=>setShowWelcome(false),450);}}}>
  <svg viewBox="30 370 905 230" aria-hidden="true">
    <g className="logo p">
      <path className="line" d="M60 484H905" stroke="#fff" strokeWidth="4" strokeDasharray="12 9" strokeLinecap="round" fill="none"/>
      <rect className="cover" x="40" y="470" width="885" height="28" fill="#5B2EFF"/>
      <g fill="#fff">
        <path className="notch p" style={{animationDelay:".05s, .75s"}} d="M49 480a11 11 0 0 1 22 0zM49 488a11 11 0 0 0 22 0z"/>
        <path className="notch p" style={{animationDelay:".15s, .75s"}} d="M199 480a11 11 0 0 1 22 0zM199 488a11 11 0 0 0 22 0z"/>
        <path className="notch p" style={{animationDelay:".25s, .75s"}} d="M377 480a11 11 0 0 1 22 0zM377 488a11 11 0 0 0 22 0z"/>
        <path className="notch p" style={{animationDelay:".35s, .75s"}} d="M553 480a11 11 0 0 1 22 0zM553 488a11 11 0 0 0 22 0z"/>
        <path className="notch p" style={{animationDelay:".45s, .75s"}} d="M706 480a11 11 0 0 1 22 0zM706 488a11 11 0 0 0 22 0z"/>
        <path className="notch p" style={{animationDelay:".55s, .75s"}} d="M755 480a11 11 0 0 1 22 0zM755 488a11 11 0 0 0 22 0z"/>
        <path className="notch p" style={{animationDelay:".6s, .75s"}} d="M894 480a11 11 0 0 1 22 0zM894 488a11 11 0 0 0 22 0z"/>
      </g>
      <g fill="#fff">
        <path className="hp p hp-one" style={{animationDelay:".5s"}} d="M60 410h48v148H60z"/>
        <path className="hp p hp-two" style={{animationDelay:".6s"}} d="M108 476h47v39h-47z"/>
        <path className="hp p hp-three" style={{animationDelay:".7s"}} d="M155 410h48v148h-48z"/>
        <g className="hx"><g fill="#5B2EFF"><circle cx="60" cy="430" r="7"/><circle cx="108" cy="430" r="7"/><circle cx="155" cy="536" r="7"/><circle cx="203" cy="536" r="7"/></g>
          <path className="march" d="M155 443h48M60 536h48" stroke="#5B2EFF" strokeWidth="3" fill="none"/></g>
        <g className="L p" style={{animationDelay:".75s"}}><path d="M256 410h80l37 148h-50l-27-118-27 118h-51z"/></g>
        <g className="L p tilt-left" style={{animationDelay:".88s"}}><path d="M402 411h70c50 0 81 28 81 73s-31 74-81 74h-70z"/>
          <g className="icon p"><rect x="444" y="435" width="55" height="102" rx="7" fill="#5B2EFF"/>
            <path className="march" d="M444 460h55" stroke="#fff" strokeWidth="3" fill="none"/>
            <circle cx="471" cy="435" r="8" fill="#fff"/><circle cx="471" cy="537" r="8" fill="#fff"/></g></g>
        <g className="L p" style={{animationDelay:"1.01s"}}><path d="M585 420h42c55 0 67 38 67 64s-12 64-67 64h-42z" fill="none" stroke="#fff" strokeWidth="19"/></g>
        <g className="L p tilt-left" style={{animationDelay:"1.14s"}}><rect x="730" y="410" width="20" height="148"/><path className="march" d="M730 443h20" stroke="#5B2EFF" strokeWidth="3"/></g>
        <g className="L p" style={{animationDelay:"1.27s"}}><path d="M792 558V420h53c40 0 52 20 52 42 0 26-17 43-47 46 8 32 25 45 55 41" fill="none" stroke="#fff" strokeWidth="19"/></g>
      </g>
    </g>
  </svg>
</div>};
}
