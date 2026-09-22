# StreetVouch manager dashboard

## Findings and structure

The previous overview repeated metric counts, put setup ahead of follow-up, lacked comparative charts, and implemented the pilot and other businesses separately. It added waiting and flagged counts even when they referred to the same message. Its latest-100-record queries could understate period totals.

The shared dashboard now follows: business and connection status → priority briefing → six metrics → activity and sentiment → recurring themes → customer voice → actionable inbox → Google connection and email reports → recommendations.

## Desktop wireframe

```text
StreetVouch    Overview   Inbox   Google reviews   Reports     Alerts Settings
Business name / location                         Period selector
Google connection / last sync                    Date interval
┌──────────────────────────────────────────────────────────────────────┐
│  N items need your attention    Private messages  | Google reviews   │
│  [Review priority feedback]     Awaiting contact | Flagged messages │
└──────────────────────────────────────────────────────────────────────┘
NFC + QR | Page visits | Google opens | Private feedback | Reviews | Rating
┌──────────────────────────────────────┬───────────────────────────────┐
│ Eight weekly pairs of vertical bars │ Sentiment donut + count / %   │
└──────────────────────────────────────┴───────────────────────────────┘
Recurring theme cards: label, count, comparison, example, related feedback
Customer voice: positive / mixed / negative / contact request if available
Inbox filters → expandable feedback → note, follow-up, resolve, archive
Google connection / sync                  Weekly report / recent deliveries
Evidence-based recommendations
```

## Mobile wireframe

```text
StreetVouch                         Alerts Settings
Overview     Inbox     Google     Reports
Business / connection / date selector
Priority headline and action
Private | Google
Contact | Flagged
Metrics in two columns
Weekly activity chart
Sentiment donut and labelled counts
Theme cards / representative comments
Wrapping inbox filters
Expandable message cards with full-width notes
Google connection
Email report and deliveries
Recommendations
```

## Visual specification

Dark green #163a35 anchors typography and the priority panel; lime #baf348 marks its primary action. Background #f5f7f8 and white cards keep the page light. Weekly bars use lilac #8383eb and teal #26a59b. Sentiment uses green #54a63f, amber #e8ac35, blue-grey #91a2b8 and coral #ed7064 with explicit labels. Main text is 16px, controls and regular labels 14px, secondary metadata 12px. Card radii range from 14–22px. Desktop content is constrained to 1320px. Below 760px the charts stack and the overview becomes a single column. Focus rings and reduced-motion preferences are supported.

## Behaviours and exact copy

Priority: “N items need your attention.” Each outstanding private message counts once, with unanswered Google reviews added separately. Resolved and archived private messages are excluded. The zero state is “You’re all caught up.”

Metrics: selected 7/30/90-day window versus the preceding equal window. Missing Google coverage displays “—”, not a false zero. A new business displays “Building comparison history”. Rating is explicitly the average of imported reviews in the period, not a claimed live Google aggregate.

Activity: up to eight consecutive seven-day buckets ending today, filtered to the business’s recorded lifetime. Each bucket has private-feedback and Google-review bars. Y-axis starts at zero, values sit above bars, and accessible chart text supplies every count. Unknown Google counts are dashes. Weekly labels state the bucket start date.

Sentiment: written comments only; rating-only reviews are excluded from this chart. A deterministic classifier is shared with report categorisation; it is an interpretation, not an AI confidence score. Largest-remainder percentage rounding ensures 100% for nonempty data. Empty state: “Your sentiment breakdown will appear when written feedback arrives.”

Themes: two or more mentions form recurring theme cards; single mentions are listed separately. One comment can appear under multiple themes. Cards open the inbox with their theme selected. Supporting quotes are verbatim excerpts.

Customer voice: select a positive, mixed, negative and contact-request comment when available, without duplicates; remaining slots use other comments. Each links to its full inbox item.

Inbox: outstanding messages remain visible regardless of the date window; closed messages appear within that window. Filters combine source, sentiment, theme, status, urgency/contact/overdue, and free text. Staff names can be searched within comments; inferred staff identities are not fabricated. The location is the business authorised by the session. There is no cross-business location switch because current accounts are scoped to one business.

Private actions: in progress maps to the existing reviewed state. Resolve, archive/restore, contact marking and notes use the authenticated status endpoint. Archive is reversible. Customer email appears only for requested contact. Messages remain private.

Google replies: “Suggest a reply” calls the existing analysis service. Where AI is unavailable, the response explicitly describes a suggested starting point. Drafts remain editable and require a separate public-publish confirmation. Failed requests retain the text for retry. Disconnected accounts cannot publish. No review is posted automatically.

Reports: “Email weekly report” invokes the existing authenticated report action and sends to the signed-in manager. Recent entries are labelled with delivery status; “sent” does not assert inbox receipt. No email is sent during implementation or verification. The dashboard uses the email’s brand, categories and reporting concepts; the existing email layout remains a separate template.

## States

- Loading: route-level skeleton plus “Loading your customer pulse…”.
- Load failure: “Your dashboard couldn’t load.” and “Try again”.
- Action pending: “Saving…”, “Drafting…” or “Publishing…” with duplicate submission disabled.
- Filter empty: “No feedback matches these filters. Try another filter or reporting period.”
- Google disconnected: explain owner consent, display connection action and missing metrics.
- Google sync failure: retain imported data and show “Google needs attention” with last successful sync.
- No history: chart grows from business creation; no invented backfilled reviews.
- No themes: explain the two-comment threshold.

## Delivery priorities and limits

1. Shared tenant-authorised dashboard, truthful counts and connection states.
2. Priority summary, charts, theme cards and balanced customer voice.
3. Inbox filtering, notes, statuses, reversible archive and reply assistance.
4. Responsive layouts, loading/error states and regression checks.

Google API approval and production credentials remain required for live sync and publishing replies. This redesign does not grant API access. Business records must represent authorised clients; no connection or email is triggered simply by opening the dashboard. Review-history metrics describe imported coverage. Sentiment remains heuristic and can misinterpret context. Historical feedback search is limited to the chosen window plus outstanding items; export remains available. Large businesses may eventually require paginated inbox loading while retaining independent aggregate queries.
