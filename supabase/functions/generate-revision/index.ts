import { assertPremium, askClaude, authenticate, collectNotebook, handle, HttpError } from "../_shared/common.ts";

const FORMULES = "Les formules s'écrivent en LaTeX entre $...$ (en ligne) ou $$...$$ (bloc).";

const PROMPTS = {
  general: `Tu es un tuteur universitaire. À partir de l'INTÉGRALITÉ du cahier fourni (notes, audios transcrits, documents, schémas), produis une RÉVISION GÉNÉRALE en français, en Markdown :
- une vue d'ensemble du cours en quelques lignes ;
- un plan par grandes parties, dans l'ordre du cahier ;
- pour chaque partie : les points essentiels, définitions clés, formules, dates/articles/auteurs à retenir ;
- une fiche « À retenir absolument » finale (10 à 15 puces) ;
- les liens entre les notions.
Reste STRICTEMENT fidèle au cahier : n'ajoute aucune information extérieure. ${FORMULES}`,
  approfondie: `Tu es un professeur d'université pédagogue. À partir de l'INTÉGRALITÉ du cahier fourni, produis une RÉVISION APPROFONDIE en français, en Markdown, visant la COMPRÉHENSION et la RÉTENTION :
- reformule chaque notion dans un langage juridique/académique précis MAIS expliqué simplement ;
- pour chaque notion : définition rigoureuse → explication en mots simples → exemple concret → piège fréquent → moyen mnémotechnique si pertinent ;
- relie les notions entre elles et explique le « pourquoi » ;
- termine chaque partie par 3 questions d'auto-vérification (sans réponses) ;
- le texte doit se lire naturellement à voix haute : phrases complètes, pas de tableaux, pas de jargon non expliqué.
Reste STRICTEMENT fidèle au cahier : n'ajoute aucune information extérieure. ${FORMULES}`,
} as const;

Deno.serve(handle(async (req) => {
  const { notebookId, mode } = await req.json();
  if (!notebookId || !(mode in PROMPTS)) throw new HttpError(400, "Paramètres invalides");
  const { admin, user } = await authenticate(req);
  await assertPremium(admin, user.id);

  const { title, text } = await collectNotebook(admin, notebookId, user.id);
  const content = await askClaude(PROMPTS[mode as keyof typeof PROMPTS], text, mode === "approfondie" ? 16000 : 8000);

  const { data, error } = await admin.from("revisions")
    .insert({ user_id: user.id, notebook_id: notebookId, mode, content })
    .select("id,mode,content,created_at").single();
  if (error) throw new HttpError(500, error.message);
  return { revision: data, notebookTitle: title };
}));
