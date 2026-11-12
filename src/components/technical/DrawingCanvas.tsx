import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase"; // ⚠️ adapte l'import

export interface Stroke { c: string; w: number; e?: boolean; p: [number, number][] } // coordonnées 0..1

interface Props { notebookId: string; pageId?: string; drawingId?: string; initial?: Stroke[]; initialCaption?: string; onSaved?: (id: string) => void }

/** Zone de dessin (stylet, doigt, souris) pour schémas, circuits, molécules, graphes… */
export function DrawingCanvas({ notebookId, pageId, drawingId, initial = [], initialCaption = "", onSaved }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>(initial);
  const [color, setColor] = useState("#1f3a5f");
  const [width, setWidth] = useState(3);
  const [eraser, setEraser] = useState(false);
  const [grid, setGrid] = useState(true);
  const [caption, setCaption] = useState(initialCaption);
  const [msg, setMsg] = useState("");
  const cur = useRef<Stroke | null>(null);

  function redraw(list: Stroke[]) {
    const cv = ref.current!, ctx = cv.getContext("2d")!, W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    if (grid) { ctx.strokeStyle = "rgba(120,140,170,.25)"; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 0; x <= W; x += 32) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = 0; y <= H; y += 32) { ctx.moveTo(0, y); ctx.lineTo(W, y); } ctx.stroke(); }
    list.forEach((s) => {
      ctx.globalCompositeOperation = s.e ? "destination-out" : "source-over";
      ctx.strokeStyle = s.c; ctx.lineWidth = s.w * (s.e ? 5 : 1) * (W / 800); ctx.lineCap = ctx.lineJoin = "round";
      ctx.beginPath(); s.p.forEach(([x, y], i) => (i ? ctx.lineTo(x * W, y * H) : ctx.moveTo(x * W, y * H)));
      if (s.p.length === 1) ctx.lineTo(s.p[0][0] * W + 0.1, s.p[0][1] * H); ctx.stroke();
    });
    ctx.globalCompositeOperation = "source-over";
  }
  useEffect(() => redraw(strokes), [strokes, grid]);

  const pt = (e: React.PointerEvent): [number, number] => {
    const r = ref.current!.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  const down = (e: React.PointerEvent) => { ref.current!.setPointerCapture(e.pointerId);
    cur.current = { c: color, w: e.pressure && e.pointerType === "pen" ? width * (0.5 + e.pressure) : width, e: eraser, p: [pt(e)] }; };
  const move = (e: React.PointerEvent) => { if (!cur.current) return; cur.current.p.push(pt(e)); redraw([...strokes, cur.current]); };
  const up = () => { if (cur.current) setStrokes((s) => [...s, cur.current!]); cur.current = null; };

  async function save() {
    setMsg("Enregistrement…");
    const { data: u } = await supabase.auth.getUser();
    const row = { user_id: u.user!.id, notebook_id: notebookId, page_id: pageId ?? null, strokes, caption, updated_at: new Date().toISOString() };
    const q = drawingId ? supabase.from("drawings").update(row).eq("id", drawingId).select("id").single()
                        : supabase.from("drawings").insert(row).select("id").single();
    const { data, error } = await q;
    if (error) return setMsg("Erreur : " + error.message);
    setMsg("Enregistré ✓"); onSaved?.(data.id);
  }

  return (
    <div className="st-draw">
      <div className="st-drawbar">
        <input type="color" value={color} onChange={(e) => { setColor(e.target.value); setEraser(false); }} aria-label="Couleur" />
        <input type="range" min={1} max={12} value={width} onChange={(e) => setWidth(+e.target.value)} aria-label="Épaisseur" />
        <button className={!eraser ? "on" : ""} onClick={() => setEraser(false)}>Crayon</button>
        <button className={eraser ? "on" : ""} onClick={() => setEraser(true)}>Gomme</button>
        <button onClick={() => setStrokes((s) => s.slice(0, -1))} disabled={!strokes.length}>Annuler</button>
        <button onClick={() => setStrokes([])}>Effacer tout</button>
        <label className="st-check"><input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} />Grille</label>
      </div>
      <canvas ref={ref} width={1200} height={800} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ width: "100%", aspectRatio: "3/2", touchAction: "none" }} />
      <input className="st-caption" value={caption} onChange={(e) => setCaption(e.target.value)}
        placeholder="Décris ce schéma en une phrase (utilisé par l'IA pour les révisions et examens)" />
      <button className="st-btn" onClick={save}>Enregistrer le dessin</button> <span className="st-muted">{msg}</span>
    </div>
  );
}
