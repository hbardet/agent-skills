# Label vocabulary

Two label prefixes. No size, no area, no dependency labels — the issue body carries that.

## status::

| Label | Meaning |
|---|---|
| `status::ready` | Spec and acceptance criteria are good enough to plan from. |
| `status::blocked` | Missing information, or waiting on another issue. Needs a `needs spec` note in the body. |
| `status::in-progress` | Claimed by an agent. Only one in-progress issue per agent at a time. |
| `status::done` | MR merged. |

## kind::

| Label | Meaning |
|---|---|
| `kind::feature` | New capability or behavior. |
| `kind::fix` | Corrects a defect. |
| `kind::refactor` | Internal change with no behavior change. |
| `kind::chore` | Build, deps, tooling, config, cleanup. |

## Rules

- Apply exactly one `status::` and one `kind::` label to every issue.
- If a label does not exist on the tracker, create it on first run using the tracker CLI:
  - GitLab: `glab label create "status::ready" --color "#428BCA"`
  - GitHub: `gh label create "status::ready" --color "428BCA"`
- Rename an existing close-enough label rather than creating a duplicate, and say so in your
  report.
- `status::blocked` is set manually. There is no dependency label; ordering or blocking goes in
  the issue body under **Notes**.
