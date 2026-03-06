# Ford-Beardo March Madness Pool

A private NCAA tournament pool app for the Ford-Beardo group. Built with SvelteKit and PocketBase.

## How it works

### Roles

- **Admin** — manages the pool, runs the draft, records scores
- **Player** — joins a pool team, participates in the draft, tracks standings

### Pool setup (Admin → Pool Admin)

Each entry in the pool is a **pool team** (e.g. "Doan, JK & Stutts"). Pool teams can have 1 or 2 slots. Players request to join a team; the admin approves or rejects each request. Only approved members appear in the leaderboard and can participate in the draft.

### Draft (Admin → Draft)

The draft uses a **snake format** across 3 round groups:

- **Group 1** — lottery order determined by the admin before the draft starts
- **Group 2 & 3** — drawn live during the draft night

Before starting, the admin randomizes or drags pool teams into lottery order, then clicks **Confirm Order**. The **Start Draft** button is disabled until the order is confirmed and all teams have an approved participant.

During the draft, the admin sees:
- **Available teams** — all NCAA teams not yet picked, grouped by region
- **On the Clock** — which pool team is currently picking, with a timer and auto-pick option
- **Draft Log** — all picks made so far

Players on the dashboard see their current picks and whose turn it is.

### Scoring (Admin → Scores)

After each tournament round, the admin records results using the bulk elimination UI:

1. Select the round tab (1st Round, 2nd Round, Sweet 16, etc.)
2. Check every team that was **eliminated** — winners are recorded automatically for all unchecked teams
3. The submit button is disabled until exactly the right number of losers are selected (32 for Round 1, 16 for Round 2, and so on)
4. After submitting, the tab advances to the next round and the completed round shows a checkmark

To fix a mistake, switch to the **Corrections** tab, click the team with the wrong result, and select the swap partner from the modal. Both results flip atomically.

### Leaderboard

Points are awarded per win by a picked team. The leaderboard groups scores by pool team and is visible to all logged-in users at /leaderboard.

### Blog

Admins can post updates visible to all participants at /dashboard/blog. Posts are authored and timestamped.

### Tools (Admin → Tools)

Testing utilities:
- **Seed Draft** — generates a full set of 60 random picks in snake order, sets draft status to complete
- **Reset All** — wipes all picks, results, and draft orders; resets status to not started
