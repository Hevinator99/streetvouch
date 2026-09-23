# Manager dashboard audit — 23 September 2026

Scope: the shared dashboard rendered by both `/manager/village-barbers-cobham` and `/manager/[slug]`. Live read-only checks used the authenticated Village Barbers portal; state-changing checks use code and automated fixtures to avoid changing customer records or sending customer-facing messages.

| Severity | Symptom | Cause | Fix |
| --- | --- | --- | --- |
| High | “Review priority feedback” changes the fragment but leaves the overview visible. | It linked to `#inbox`, while Inbox is a separate route view. | Navigate to Inbox with `view=attention`; show the filtered list. |
| High | Changing filters can leave the visible list unchanged. | The live page has a zero-size duplicate dashboard; scripts bound to its controls instead of the visible copy. | Scope filters, review drafting, report feedback, and reply forms to the visible dashboard. |
| Medium | Alert bell, theme cards, quotes, “view all”, contact follow-up and Google links can land on hidden content. | Same-page fragments point into sections hidden on the overview. | Route to the correct view, preserve period, preselect relevant filter, and open/focus a linked item. |
| Medium | Applying a new reporting period returns managers to Overview. | The GET form did not preserve the active section. | Include the active section/source in the period form. |
| Medium | The weekly chart does not respond to period selection. | It always rendered eight fixed weeks. | Build weekly buckets from the selected 7-, 30- or 90-day interval. |
| Medium | A weekly report with more than 100 feedback or review records understates totals. | Queries silently used `LIMIT 100`. | Include all records from the seven-day period. |
| Medium | Weekly report success can claim “sent” when the email provider only accepted the request; a history-write failure can falsely appear as delivery failure. | Provider acceptance and local history persistence shared one catch path. | Report “accepted for delivery”; record queued status, and distinguish a history failure from a provider failure. |
| Medium | Google connection/sync returns a manager to Overview (or onboarding) rather than Google Reviews; setup errors can disappear. | Redirect destinations differed across routes and client status handling erased `setup_required`. | Return to the Google view with explicit state messaging. |
| Medium | A status request for another business can create a misleading audit event. | Ownership was checked only for delete. | Check feedback ownership before every action. |

Verified before publication: the live Village Barbers priority link targeted only `#inbox`; the live page exposed a hidden duplicate dashboard, and the visible filter selection did not change the result count. The remaining fixes have render/unit/build checks; live post-publication browser outcomes are recorded in the final handoff. Google authorization, sync and reply publication require StreetVouch’s pending Business Profile API access, so those external success paths cannot be certified yet.
