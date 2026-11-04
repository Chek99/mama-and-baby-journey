<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules

- Frontend-only: no server functions, database or Cloud code in this project. All backend calls go through `src/lib/api/` to `VITE_API_URL`, and every endpoint is documented in `docs/BACKEND_API.md` — why: the user builds the backend separately, so the contract file must stay in sync with any new call.
- Sessions are bearer tokens in localStorage (`src/lib/api/http.ts`); signed-in pages use `ssr: false` + `requirePortal` in `beforeLoad` — why: the server render cannot see browser storage.
