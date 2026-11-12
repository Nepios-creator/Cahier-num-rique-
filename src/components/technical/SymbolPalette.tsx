import { RefObject, useState } from "react";

const SETS: Record<string, string[]> = {
  "Grec": ["α","β","γ","δ","ε","θ","λ","μ","π","ρ","σ","τ","φ","ω","Γ","Δ","Θ","Λ","Σ","Φ","Ψ","Ω"],
  "Maths": ["±","×","÷","≠","≈","≤","≥","∞","√","∛","∑","∏","∫","∬","∂","∇","′","″","°","‰","%"],
  "Ensembles": ["∈","∉","⊂","⊆","∪","∩","∅","ℕ","ℤ","ℚ","ℝ","ℂ","∀","∃","∄","¬","∧","∨","⊕"],
  "Flèches": ["→","←","↔","⇒","⇐","⇔","↑","↓","⇌","↦","⟶"],
  "Indices": ["⁰","¹","²","³","⁴","⁵","⁶","⁷","⁸","⁹","⁺","⁻","₀","₁","₂","₃","₄","₅","₆","₇","₈","₉","₊","₋"],
  "Sciences": ["Å","Ω","µ","℃","℉","ħ","ℏ","⊥","∥","∠","≡","∝","⊗","·","⃗"],
};
// Modèles LaTeX (le curseur reste entre les accolades)
const FORMULAS: [string, string][] = [
  ["Fraction", "$\\frac{a}{b}$"], ["Racine", "$\\sqrt{x}$"], ["Puissance", "$x^{n}$"], ["Indice", "$x_{i}$"],
  ["Somme", "$\\sum_{i=1}^{n} x_i$"], ["Intégrale", "$\\int_{a}^{b} f(x)\\,dx$"], ["Limite", "$\\lim_{x \\to 0} f(x)$"],
  ["Matrice", "$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$"], ["Réaction", "$$\\ce{A + B -> C}$$"],
  ["Vecteur", "$\\vec{v}$"],
];

export function insertAtCursor(el: HTMLTextAreaElement | HTMLInputElement | null, text: string) {
  if (!el) return;
  const s = el.selectionStart ?? el.value.length, e = el.selectionEnd ?? s;
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, el.value.slice(0, s) + text + el.value.slice(e));
  el.dispatchEvent(new Event("input", { bubbles: true })); // notifie React
  el.focus(); const p = s + text.length; el.setSelectionRange(p, p);
}

/** Palette de symboles : à placer sous/à côté de l'éditeur de page. */
export function SymbolPalette({ target }: { target: RefObject<HTMLTextAreaElement | HTMLInputElement> }) {
  const [tab, setTab] = useState("Grec");
  const all = { ...SETS, "Formules": [] as string[] };
  return (
    <div className="st-palette" role="toolbar" aria-label="Symboles">
      <div className="st-tabs">{Object.keys(all).map((k) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{k}</button>)}</div>
      <div className="st-symbols">
        {tab === "Formules"
          ? FORMULAS.map(([n, f]) => <button key={n} title={f} onMouseDown={(e) => e.preventDefault()} onClick={() => insertAtCursor(target.current, f)}>{n}</button>)
          : SETS[tab].map((s) => <button key={s} onMouseDown={(e) => e.preventDefault()} onClick={() => insertAtCursor(target.current, s)}>{s}</button>)}
      </div>
    </div>
  );
}
