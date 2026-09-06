---
target: telas de criacao de registro (veneralato, contas, sessoes, cobrancas)
total_score: 17
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:C:\\sygmahorus\\apps\\frontend\\src\\app\\dashboard\\veneralato\\page.tsx"
target_fingerprint: "sha256:64ee80725849ffd104920e1d938d21af999479d2e10318045918de160d580622"
target_path: "C:\\sygmahorus\\apps\\frontend\\src\\app\\dashboard\\veneralato\\page.tsx"
timestamp: 2026-09-06T07-50-56Z
slug: src-app-dashboard-veneralato-page-tsx
---
Method: dual-agent (A: general-purpose sub-agent · B: general-purpose sub-agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2/4 | No in-flight/disabled state on primary create/edit buttons; success and error messages render identically. |
| 2 | Match System / Real World | 3/4 | Strong domain language (Veneralato, Art. 002, Passo 1/2/3); undercut by letting a brand-new conta be created already "Pago"/"Vencido". |
| 3 | User Control and Freedom | 2/4 | Destructive actions go through confirm dialogs, but no cancel/reset on long forms (Cobrança em massa) beyond that. |
| 4 | Consistency and Standards | 2/4 | The full-width-card pattern is consistent — consistently wrong. None of the 4 screens use the shared `<Card>` component; several buttons hand-duplicate `Button`'s variant classes. |
| 5 | Error Prevention | 1/4 | Raw `<input>` bypasses `<Input error=…>`'s built-in validation display; no double-submit guard; status settable to "Vencido" at creation. |
| 6 | Recognition Rather Than Recall | 3/4 | Dropdowns show real names not IDs; native date pickers; good inline help on the Art. 002 checkbox. |
| 7 | Flexibility and Efficiency | 1/4 | Every field is full desktop-width regardless of content — pure Fitts's-law cost for repetitive daily entry; no dense mode. |
| 8 | Aesthetic and Minimalist Design | 1/4 | Core of the complaint: oversized card, oversized pill button; Cobranças stacks 3 full-width cards of equal weight before the list. |
| 9 | Error Recovery | 1/4 | Success and failure both render through `<Alert intent="warn">` in all 4 files — a treasurer cannot visually tell "Período criado." from a rejected request. |
| 10 | Help and Documentation | 1/4 | Only one field (mensalidade checkbox) carries inline explanation of consequences. |
| **Total** | | **17/40** | **Poor — significant improvements needed** |

## Design Specificity Verdict

**LLM assessment (Assessment A):** The domain vocabulary and the three-step Veneralato closing workflow (Tesoureiro → Venerável → Admin, each gated with role tags and ✓ states) are genuinely authored for this product — no generic admin template ships that segregation-of-duties flow. But the "create record" composition on all four screens (veneralato, contas, sessões, cobranças) is the opposite: a `<section>` card that eats the full `max-w-6xl` content column, a `grid md:grid-cols-2` of raw inputs, and a submit `Button` spanning both columns — copy-pasted four times, indistinguishable from any Bootstrap/shadcn CRUD scaffold. The ceremonial identity lives in the copy and in one workflow section; the form-authoring layer underneath it is templated.

**Deterministic scan (Assessment B):** `impeccable detect --json` against all four files returned exit 0 with zero findings, confirmed on a second run with `--no-config` (no local suppression exists). This is a plausible **false negative**, not a clean bill of health: the flagged pattern is a computed-layout defect (CSS Grid's default `justify-items: stretch` expanding an `inline-flex` button to its grid track), which the tool's text/regex scan mode has no literal signature to match. Only the tool's live-DOM (browser) mode would likely catch it, and that mode was unreachable this run (see below).

**Visual overlays:** Not available. The local dev server's NextAuth API routes (`/api/auth/providers`, `/api/auth/csrf`) returned HTTP 500 for the full duration of this run ("Jest worker encountered 2 child process exceptions, exceeding retry limit") — a dev-environment fault from repeated server restarts earlier in the session, unrelated to the flagged design pattern. Every authenticated navigation redirected back to `/login`, so no live screenshot or `getBoundingClientRect()` measurement exists. Assessment B compensated with **source-computed structural evidence**: with no `tailwind.config.*` override, `max-w-6xl` = 1152px is confirmed as the content column width; the card carries no width class of its own, so **card width = 100% of the parent column at every breakpoint** (ratio 1.00, both 1440px and 1024px, since both sit above the `md` 768px breakpoint where the grid would otherwise collapse). The submit button's intrinsic width (short label + padding) is ≈130–170px against a ~1104px (1440px viewport) or ~928px (1024px viewport) grid track — a **≈6.5–8.5× stretch**. `CobrancasClient.tsx` has the exact same mechanism twice in one page (lines 181 and 212).

## Overall Impression

The workflow logic and copy are the real product; the form-authoring layer is not. Every "create new record" screen in these four areas hand-rolls the same unconstrained-card-plus-stretched-button recipe instead of using the design system's own `<Card>` component, and — tellingly — `veneralato/page.tsx` itself proves the team already knows the better pattern: its own encerramento section two blocks below uses `grid gap-6 lg:grid-cols-[1fr_1.3fr]` to sit two panels side-by-side at content width. The single biggest opportunity is exactly what was flagged: give these forms a content-driven max-width and let panels reflow, rather than stretching to fill whatever column they're dropped into.

## What's Working

- **veneralato/page.tsx:238-294** — the three-step "Encerramento do veneralato" gating with role tags and ✓ states enforces real segregation of duties (Tesoureiro → Venerável → Admin); domain-authored, not templated.
- **veneralato/page.tsx:173** — `grid gap-6 lg:grid-cols-[1fr_1.3fr]` is already the exact side-by-side, non-full-bleed pattern being asked for elsewhere on the very same page.
- **ContasClient.tsx:165** — inline contextual help on the mensalidade checkbox ties a UI control to the lodge's actual bylaws (Art. 002, 60 days), not generic copy.

## Priority Issues

**[P0] Success and error feedback are visually identical.**
Why it matters: every `message` state (success or failure) renders through `<Alert intent="warn">` in all four files (veneralato/page.tsx:160, ContasClient.tsx:130, SessoesClient.tsx:48, CobrancasClient.tsx:141), even though `Alert` already supports `intent="ok"` (emerald, `role="status"`) and `intent="danger"` (rose, `role="alert"`). In a financial app, a treasurer needs an unambiguous signal a charge/account/period was actually created — right now "Período criado." and a rejected API call are the same amber box, both announced to screen readers as `role="alert"`.
Fix: branch on `response.ok` and use `intent="ok"` for success, `intent="danger"` for real errors, everywhere `setMessage` is called.
Suggested command: `$impeccable clarify`

**[P1] The flagged full-width card + stretched button.**
"Novo período" (veneralato/page.tsx:162-171), "Nova/Editar conta" (ContasClient.tsx:132-171), "Nova sessão" (SessoesClient.tsx:50-65), "Cobrança em massa" and "Nova cobrança" (CobrancasClient.tsx:156-214, twice on one page) each sit in a `<section>` inheriting the page's full 1152px column, wrap a two-column grid, and finish with a button spanning both columns. Computed: ~1104px-wide track, ~540px-wide single-line text inputs, submit button stretched ≈6.5–8.5× its natural width — the pill shape becomes an undifferentiated bar.
Why it matters: this is the exact "engessado" complaint, and the page's own encerramento section (line 173) already proves the reflowing alternative exists in this codebase.
Fix: give the form card a content-driven max-width (`max-w-xl`/`max-w-2xl`), lay it out with the list using a wrapping/auto-fit grid so panels sit side-by-side when width allows, and give the submit button `justify-self-start` (or move it out of the grid) instead of `col-span-2`.
Suggested command: `$impeccable layout`

**[P1] No in-flight guard on primary create/edit submits.**
`handleSubmit`/`create` in all four files fire a fetch with no `isSubmitting` state disabling the button; only the unrelated bulk-invoice/cron actions in CobrancasClient (`bulkProcessing`, `processing`) have that guard.
Why it matters: a treasurer double-clicking "Criar período"/"Salvar conta"/"Criar cobrança" on a slow connection can create duplicate financial records with zero client-side prevention.
Fix: reuse the existing `bulkProcessing`-style disabled/label-swap pattern on every create/edit submit button.
Suggested command: `$impeccable harden`

**[P1] `Button` has zero `focus-visible` styling across all variants.**
`src/components/ui/button.tsx` defines no focus ring for primary/secondary/ghost/danger — only `Input` gets one (`field-styles.ts`).
Why it matters: every button in the app is invisible to keyboard focus, a WCAG 2.4.7 failure most dangerous on irreversible actions like "Encerrar veneralato" or "Excluir período", where a keyboard user has no visual confirmation of what's about to fire.
Fix: add a shared `focus-visible:ring-2 focus-visible:ring-gold/50` to the Button base class.
Suggested command: `$impeccable audit`

**[P2] Ungrouped, oversized forms.**
ContasClient's "Nova conta" packs 9 fields into one flat grid with no subheadings; CobrancasClient's "Cobrança em massa" packs 8, including 3 recurring-only fields left visible-but-disabled instead of hidden.
Why it matters: violates chunking (>4 items/group) and progressive disclosure, adding scanning cost to a form filled out repeatedly.
Fix: split into labeled subsections ("Detalhes" / "Recorrência") and conditionally render recurring fields only when the checkbox is checked.
Suggested command: `$impeccable layout`

## Persona Red Flags

**Alex (power-user treasurer, daily entry):** every create/save button can be double-clicked into a duplicate record (no submit guard); ~540px-wide title/amount inputs on a 1440px monitor mean more mouse travel per field than the content warrants — directly working against someone entering dozens of accounts/cobranças a week.

**Jordan (first-timer, e.g. a newly-elected secretary):** the "Períodos" list on veneralato (lines 176-183) has no `<EmptyState>` fallback — unlike Contas/Sessões/Cobranças, which all use branded `<EmptyState>` copy — so a lodge with no periods yet sees a blank box with no explanation. Combined with the amber "warning" styling on a successful "Período criado.", a first-timer has real reason to doubt whether their action worked.

**Sam (accessibility-dependent):** the member/office `<select>` elements in veneralato (lines 205-212) have no `<label>`, relying on a placeholder option as their only accessible name; destructive text-links ("Excluir período", "Desfazer fechamento") use 60%-opacity rose against a dark card — low contrast on exactly the actions where clarity matters most; and the missing focus-visible ring means Sam cannot see which control is focused before activating an irreversible action.

## Minor Observations

- None of the four screens use the shared `<Card>`/`<CardTitle>` components; all hand-roll the card classes with `p-6` instead of the component's canonical `p-5`.
- Several buttons (Vincular, Fechar caixa, Aprovar, Processar recorrentes, Encerrar) hand-duplicate `Button`'s variant classes instead of importing it, so the focus-ring fix above won't propagate to them automatically.
- CobrancasClient stacks three full-width, visually identical cards before the list — "Recorrência" (a single button) carries the same visual weight as the far more consequential bulk-charge form beside it.
- The `assignOffice` control (veneralato/page.tsx:213-217) reads two `<select>` values via `document.getElementById` instead of React state, and silently no-ops if either is empty.
- The CLI detector's zero findings on this exact pattern is itself worth noting as a tool-coverage gap, not a clean bill of health (see Design Specificity Verdict).

## Questions to Consider

- If the encerramento section on the same page already proves the team can build a reflowing, content-width layout — why does the form above it revert to full-bleed?
- Is there a reason "Pago" and "Vencido" are offered as creation-time states for a brand-new account, given the product's stated principle that "toda alteração relevante deixa trilha"?
- If success and failure render in the identical amber box across every screen, has anyone watched a treasurer try to tell the two apart in the field?
