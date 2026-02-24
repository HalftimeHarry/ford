# PocketBase Collections

Create these collections in your PocketBase admin panel.

## users (extend built-in auth collection)

Add these fields to the existing `users` collection:

| Field    | Type   | Options                          |
|----------|--------|----------------------------------|
| name     | text   | required                         |
| phone    | text   |                                  |
| role     | select | values: `admin`, `participant`; default: `participant` |
| pool     | select | values: `pool1`, `pool2`; required |

## ncaa_teams

| Field            | Type   | Options                                                                              |
|------------------|--------|--------------------------------------------------------------------------------------|
| name             | text   | required                                                                             |
| seed             | number | required, min: 1, max: 16                                                            |
| region           | select | values: `East`, `West`, `South`, `Midwest`; required                                 |
| eliminated_round | select | values: `round_1`, `round_2`, `round_3`, `round_4`, `semifinal`, `final`; optional   |

## pool_entries

| Field        | Type     | Options                        |
|--------------|----------|--------------------------------|
| user         | relation | -> users; required             |
| pool         | relation | -> pools; required             |
| paid         | bool     | default: false                 |
| entry_number | number   | min: 1, max: 99               |

Uniqueness constraints:
- `Unique(user, pool)` — one entry per user per pool

## draft_orders

| Field       | Type     | Options                        |
|-------------|----------|--------------------------------|
| user        | relation | -> users; required             |
| position    | number   | required, min: 1, max: 10      |
| round_group | number   | required, min: 1, max: 3       |

Uniqueness constraints:
- `Unique(user, round_group)` — one position per user per group
- `Unique(round_group, position)` — no duplicate positions in a group

## draft_picks

| Field       | Type     | Options                        |
|-------------|----------|--------------------------------|
| user        | relation | -> users; required             |
| team        | relation | -> ncaa_teams; required        |
| draft_round | number   | required, min: 1, max: 6       |
| pick_number | number   | required, min: 1               |

Uniqueness constraints:
- `Unique(team)` — a team can only be drafted once across all entries
- `Unique(user, draft_round)` — one pick per user per draft round

## game_results

| Field            | Type     | Options                                                                  |
|------------------|----------|--------------------------------------------------------------------------|
| team             | relation | -> ncaa_teams; required                                                  |
| tournament_round | select   | values: `round_1`, `round_2`, `round_3`, `round_4`, `semifinal`, `final` |
| won              | bool     | required                                                                 |

Uniqueness constraints:
- `Unique(team, tournament_round)` — prevents double-scoring a team in the same round

## Round mapping

| Code       | NCAA Round      |
|------------|-----------------|
| round_1    | Round of 64     |
| round_2    | Round of 32     |
| round_3    | Sweet 16        |
| round_4    | Elite 8         |
| semifinal  | Final Four      |
| final      | Championship    |
