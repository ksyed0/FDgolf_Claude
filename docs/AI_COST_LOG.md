# AI Cost Log

Append-only ledger of AI session costs. Never edit or delete rows.
Updated automatically by the Claude Code stop hook (`tools/capture-cost.js`).

Rows marked `[est]` are manually estimated for sessions that predate the capture-cost hook.
Pricing basis: Claude Sonnet 4.6 — Input $3/MTok · Output $15/MTok · Cache Read $0.30/MTok

---

## Keeping Costs Accurate

**If the AI Cost column in the dashboard is blank or zero for a story**, it means no cost log row has a `Branch` value matching that story's `Branch:` field exactly. Two common causes:

1. **Sessions predating the capture-cost hook** — add estimated rows manually using the `-est` suffix convention (e.g. `sess_NNNN-est`).
2. **Branch name mismatch** — the branch in the cost log row must exactly match the `Branch:` field in RELEASE_PLAN.md (case-sensitive).

**To estimate and backfill costs**, ask your AI assistant:

> "Look at `docs/AI_COST_LOG.md` and `docs/RELEASE_PLAN.md`. For any story whose branch has no matching cost log row, estimate the token usage based on the work described and the t-shirt size, then append new `[est]` rows. Use Claude Sonnet 4.6 pricing: Input $3/MTok · Output $15/MTok · Cache Read $0.30/MTok."

**Human cost** is computed automatically from t-shirt size × hourly rate in `plan-visualizer.config.json`. To update the hourly rate, change `costs.hourlyRate` in the config.

---

| Date       | Session ID                           | Branch | Input Tokens | Output Tokens | Cache Read Tokens | Cost USD |
| ---------- | ------------------------------------ | ------ | ------------ | ------------- | ----------------- | -------- |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 211615       | 20233         | 2449436           | 1.8318   |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 232623       | 25086         | 3243436           | 2.2216   |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 232643       | 25804         | 3385572           | 2.2751   |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 232855       | 26244         | 3528440           | 2.3253   |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 232903       | 26750         | 3671954           | 2.3761   |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 232903       | 26750         | 3671954           | 2.3761   |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 232917       | 27144         | 3816016           | 2.4253   |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 234385       | 31330         | 4105628           | 2.5805   |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 234385       | 31330         | 4105628           | 2.5805   |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 402611       | 39956         | 4299624           | 3.3989   |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 402611       | 39956         | 4299624           | 3.3989   |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 406771       | 45952         | 4730564           | 3.6337   |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 406771       | 45952         | 4730564           | 3.6337   |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 407324       | 59222         | 5289667           | 4.0025   |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 416775       | 65724         | 6102945           | 4.3795   |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 426714       | 81340         | 6835794           | 4.8708   |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 740062       | 100174        | 13817865          | 8.4230   |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 746953       | 120854        | 14440846          | 8.9459   |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 754777       | 136784        | 14929433          | 9.3608   |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 769911       | 144470        | 18088241          | 10.4804  |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 778700       | 162317        | 18629465          | 10.9434  |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 789979       | 185035        | 19198310          | 11.4972  |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 803739       | 210952        | 19801203          | 12.1184  |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 804753       | 218252        | 20229287          | 12.3601  |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 804801       | 227124        | 20665677          | 12.6243  |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 805371       | 235980        | 21110979          | 12.8928  |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 859675       | 263806        | 23716292          | 14.2954  |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 989608       | 373545        | 31369634          | 18.7247  |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 1104878      | 469497        | 39216556          | 22.9503  |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 1283095      | 531412        | 46089830          | 26.6093  |
| 2026-06-08 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 1456497      | 544039        | 47994097          | 28.0202  |
| 2026-06-09 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 1663395      | 544393        | 47994097          | 28.8013  |
| 2026-06-09 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 1670897      | 556285        | 49591472          | 29.4871  |
| 2026-06-09 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 1805608      | 596348        | 59900211          | 33.6856  |
| 2026-06-09 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 1849082      | 598968        | 59934585          | 33.8983  |
| 2026-06-09 | c5709dbc-6ff6-4d92-82cc-981d58ef0056 | main   | 1885326      | 611140        | 61222602          | 34.6031  |
| 2026-06-09 | 9b2c1e60-ded2-4bbe-9053-36bf16409a87 | main   | 202588       | 11112         | 961640            | 1.2146   |
| 2026-06-09 | 9b2c1e60-ded2-4bbe-9053-36bf16409a87 | main   | 211735       | 13848         | 1395704           | 1.4202   |
| 2026-06-09 | 9b2c1e60-ded2-4bbe-9053-36bf16409a87 | main   | 258357       | 32081         | 2843453           | 2.3028   |
| 2026-06-09 | 9b2c1e60-ded2-4bbe-9053-36bf16409a87 | main   | 359231       | 33586         | 3377495           | 2.8638   |
| 2026-06-09 | 9b2c1e60-ded2-4bbe-9053-36bf16409a87 | main   | 371821       | 38465         | 4557135           | 3.3381   |
| 2026-06-09 | 9b2c1e60-ded2-4bbe-9053-36bf16409a87 | main   | 414776       | 49094         | 5610718           | 3.9747   |
