import { useEffect, useRef, useState } from "react";

const clean = (md: string) =>
  md.replace(/\$\$[\s\S]*?\$\$/g, " formule ").replace(/\$[^$]+\$/g, " formule ")
    .replace(/[#*_`>~|]/g, "").replace(/\[(.*?)\]\(.*?\)/g, "$1").replace(/\n{2,}/g, ". ");

function chunks(text: string, max = 220): string[] {
  const out: string[] = [];
  (text.match(/[^.!?…\n]+[.!?…]*/g) ?? []).forEach((s) => {
    s = s.trim(); if (!s) return;
    if (out.length && (out[out.length - 1] + " " + s).length < max) out[out.length - 1] += " " + s; else out.push(s);
  });
  return out;
}

/** Lecture audio via la synthèse vocale du navigateur (gratuit, sans serveur). */
export function AudioPlayer({ markdown }: { markdown: string }) {
  const parts = useRef<string[]>([]);
  const idx = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [progress, setProgress] = useState(0);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => { parts.current = chunks(clean(markdown)); idx.current = 0; setProgress(0); stop(); return stop; }, [markdown]);

  function speak() {
    if (idx.current >= parts.current.length) { setPlaying(false); idx.current = 0; setProgress(0); return; }
    const u = new SpeechSynthesisUtterance(parts.current[idx.current]);
    u.lang = "fr-FR"; u.rate = rate;
    u.onend = () => { idx.current++; setProgress(idx.current / parts.current.length); if (playingRef.current) speak(); };
    window.speechSynthesis.speak(u);
  }
  const playingRef = useRef(false);
  function play() { window.speechSynthesis.cancel(); playingRef.current = true; setPlaying(true); speak(); }
  function pause() { playingRef.current = false; setPlaying(false); window.speechSynthesis.cancel(); }
  function stop() { playingRef.current = false; setPlaying(false); if (supported) window.speechSynthesis.cancel(); idx.current = 0; setProgress(0); }
  function skip(d: number) { idx.current = Math.max(0, Math.min(parts.current.length - 1, idx.current + d)); if (playing) play(); }

  if (!supported) return <p className="st-muted">La lecture audio n'est pas disponible sur ce navigateur.</p>;
  return (
    <div className="st-audio" role="group" aria-label="Lecture audio">
      <button className="st-btn" onClick={() => skip(-3)} aria-label="Reculer">⏪</button>
      <button className="st-btn" onClick={playing ? pause : play}>{playing ? "Pause" : "Écouter"}</button>
      <button className="st-btn" onClick={() => skip(3)} aria-label="Avancer">⏩</button>
      <button className="st-btn st-ghost" onClick={stop}>Arrêter</button>
      <label className="st-muted">Vitesse
        <select value={rate} onChange={(e) => { setRate(+e.target.value); if (playing) setTimeout(play, 0); }}>
          {[0.8, 1, 1.2, 1.5].map((r) => <option key={r} value={r}>×{r}</option>)}
        </select>
      </label>
      <progress value={progress} max={1} />
    </div>
  );
}
