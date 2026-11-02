# Labels

Both skills use the same vocabulary. Create missing labels on first use; never invent a new
label that is not in this list without asking the user.

## Status (one per issue)

| Label | Meaning |
|---|---|
| `status::ready` | Spec is clear enough to plan from. |
| `status::blocked` | Waiting on a dependency or on a missing spec. |
| `status::in-progress` | An agent has claimed it. |
| `status::done` | Merged or closed. |

## Size

`size::S` (a few files, hours), `size::M` (a day or two), `size::L` (needs its own breakdown).

## Kind

`kind::feature`, `kind::fix`, `kind::refactor`, `kind::chore`.

## Area

`area::<x>` where `<x>` comes from the repo's top-level directories or config. Suggested on first
run from `ls` of the repo root, excluding dot-directories and dependency directories
(`node_modules`, `vendor`, `.git`). The user confirms the list once; it is stored in config.

## Creating labels

GitLab: `glab label create <name> --color "#4287f5"`.
GitHub: `gh label create <name> --color "4287f5"`.

Pick stable colors: status::ready `#2e7d32`, status::blocked `#c62828`, status::in-progress
`#f9a825`, status::done `#616161`; sizes `#1565c0` / `#6a1b9a` / `#ef6c00`; kinds any neutral blue.
