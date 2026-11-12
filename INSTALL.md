# Installation — Révision, Examen simulé, Premium, Cours techniques

Hypothèse : React + Vite/Next + TypeScript, client Supabase exporté depuis `src/lib/supabase.ts`
(`export const supabase = createClient(...)`). Adapte les imports `./supabase` si le chemin diffère.

## 1) GitHub — fichiers à déposer
Copie les dossiers de ce zip à la racine du dépôt :
- `supabase/migrations/20261111000000_revision_examen_premium.sql`
- `supabase/functions/` (_shared, generate-revision, generate-exam, grade-exam, create-checkout, stripe-webhook)
- `src/lib/studyApi.ts`, `src/lib/usePremium.ts`
- `src/components/premium/PremiumGate.tsx`
- `src/components/study/` (RichText, AudioPlayer, RevisionPage, ExamPage)
- `src/components/technical/` (SymbolPalette, DrawingCanvas)
- `src/styles/study.css`

Dépendances : `npm i react-markdown remark-math rehype-katex katex`

## 2) Brancher dans l'app
```tsx
import { RevisionPage } from "./components/study/RevisionPage";
import { ExamPage } from "./components/study/ExamPage";
// Dans la vue d'un cahier (onglets "Notes | Révision | Examen") :
<RevisionPage notebookId={notebook.id} />
<ExamPage notebookId={notebook.id} />

// Éditeur de page (cours techniques) :
const ta = useRef<HTMLTextAreaElement>(null);
<SymbolPalette target={ta} />  <textarea ref={ta} ... />
<DrawingCanvas notebookId={notebook.id} pageId={page.id} />
```
Pour afficher les formules dans tes pages, rends leur contenu avec `<RichText>` ($x^2$, $$\int…$$, \ce{H2O}).

## 3) Supabase — à faire toi-même
1. **SQL Editor** : colle et exécute le fichier de migration.
   Crée : subscriptions (essai 2 mois auto à l'inscription + utilisateurs existants), revisions, exams,
   exam_keys (corrigé caché), exam_attempts, drawings + RLS.
2. **Adapter `collectNotebook`** (`_shared/common.ts`) si tes tables/colonnes diffèrent
   (notebooks, pages, transcripts, documents). C'est le seul endroit à modifier.
3. **Secrets** (Project Settings > Edge Functions > Secrets) :
   `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`
   (optionnel : `CLAUDE_MODEL`). `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont déjà fournis.
4. **Déployer** (CLI) :
   ```
   supabase link --project-ref <ref>
   supabase db push                      # ou SQL Editor
   supabase functions deploy generate-revision generate-exam grade-exam create-checkout
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```
5. **Stripe** : crée un produit avec un prix mensuel/annuel → copie son `price_...` dans `STRIPE_PRICE_ID`.
   Webhook vers `https://<ref>.supabase.co/functions/v1/stripe-webhook`, événements :
   `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
   Copie le « Signing secret » dans `STRIPE_WEBHOOK_SECRET`.
6. **Test** : nouveau compte → accès libre 2 mois. Pour tester le paywall :
   `update subscriptions set trial_ends_at = now() - interval '1 day' where user_id = '<uuid>';`

## Notes
- Le premium est vérifié CÔTÉ SERVEUR (has_premium_access) : le contourner côté client ne sert à rien.
- Le corrigé n'est jamais envoyé au navigateur avant la remise de la copie.
- Audio : synthèse vocale du navigateur (gratuite). Voix plus naturelle possible plus tard via un service TTS.
- Les dessins sont décrits par une légende que l'IA lit ; elle ne « voit » pas les traits.
- Examen blanc : chrono 2 h, rendu automatique à 0, alerte avant de quitter la page, brouillon sauvegardé localement.
