# Pack promotion procedure

Used by `/eng-promote <pack-id>`. Promotes a reviewed project pack to the federation standards repo as a local copy only.

1. The argument is a pack id. Load `.eng-team/packs/<id>.md`. If it does not exist, say so and stop.
2. Refuse if `reviewed_by` is empty: "A human must review this pack and set reviewed_by before promotion."
3. Check each source URL resolves (WebFetch). On failure, list the URL and stop.
4. Resolve `profile.standards` to a **local path**. If it is a URL, ask the user for a local clone path, since this procedure never clones for writing.
5. Write a copy to `<standards>/packs/<id>.md` with `tier: federation` and `status: reviewed`, keeping `sources`, `reviewed_by` and `review_by`.
6. Print the exact next steps for the human: `git checkout -b promote/<id>`, `git add packs/<id>.md`, `git commit`, then open a PR. **Never push, commit or open PRs yourself.**
