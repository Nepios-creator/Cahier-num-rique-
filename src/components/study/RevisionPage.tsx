import { useEffect, useState } from "react";
import { generateRevision, getLatestRevision, Revision } from "../../lib/studyApi";
import { PremiumGate } from "../premium/PremiumGate";
import { RichText } from "./RichText";
import { AudioPlayer } from "./AudioPlayer";
import "../../styles/study.css";

type Mode = "general" | "approfondie";
const LABELS: Record<Mode, { t: string; d: string }> = {
  general: { t: "Révision générale", d: "Vue d'ensemble de toutes les pages du cahier." },
  approfondie: { t: "Révision approfondie", d: "Notes reformulées en langage juridique expliqué, pour comprendre et retenir. Écoutable." },
};

export function RevisionPage({ notebookId }: { notebookId: string }) {
  return <PremiumGate><Inner notebookId={notebookId} /></PremiumGate>;
}

function Inner({ notebookId }: { notebookId: string }) {
  const [mode, setMode] = useState<Mode>("general");
  const [rev, setRev] = useState<Revision | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { setRev(null); setErr(""); getLatestRevision(notebookId, mode).then(setRev); }, [notebookId, mode]);

  async function run() {
    setBusy(true); setErr("");
    try { setRev(await generateRevision(notebookId, mode)); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="st-wrap">
      <div className="st-tabs" role="tablist">
        {(Object.keys(LABELS) as Mode[]).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>{LABELS[m].t}</button>
        ))}
      </div>
      <p className="st-muted">{LABELS[mode].d}</p>
      <button className="st-btn" disabled={busy} onClick={run}>
        {busy ? "Analyse du cahier…" : rev ? "Régénérer" : "Générer la révision"}
      </button>
      {err && <p className="st-error" role="alert">{err}</p>}
      {rev && (<>
        {mode === "approfondie" && <AudioPlayer markdown={rev.content} />}
        <article className="st-doc"><RichText>{rev.content}</RichText></article>
        <p className="st-muted">Générée le {new Date(rev.created_at).toLocaleString("fr-FR")}</p>
      </>)}
    </div>
  );
}
