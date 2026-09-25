export type SearchMetric = { value: string; clicks: number; impressions: number; position: number | null };
export type SearchPair = { value: string; clicks: number; impressions: number };
export type Opportunity = {
  query: string;
  page: string | null;
  title: string;
  evidence: string;
  relevance: string;
  effort: string;
  nextStep: string;
};

export function selectOpportunities(current: SearchMetric[], previous: SearchMetric[], pairs: SearchPair[], days: number): Opportunity[] {
  const old = new Map(previous.map(row => [row.value, row]));
  const matched = new Map<string, { page: string; impressions: number }>();
  for (const pair of pairs) {
    let keys: unknown;
    try { keys = JSON.parse(pair.value); } catch { continue; }
    if (!Array.isArray(keys) || keys.length !== 2 || typeof keys[0] !== "string" || typeof keys[1] !== "string") continue;
    const [query, page] = keys as string[];
    const existing = matched.get(query);
    if (!existing || pair.impressions > existing.impressions) matched.set(query, { page, impressions: pair.impressions });
  }
  const candidates = current.flatMap(row => {
    if (row.impressions < 20) return [];
    const prior = old.get(row.value);
    const declining = Boolean(prior && prior.impressions >= 20 && prior.clicks >= 5 && row.clicks <= prior.clicks * .7);
    const lowCtr = row.impressions >= 40 && row.clicks / row.impressions < .05;
    if (!declining && !lowCtr) return [];
    const page = matched.get(row.value)?.page ?? null;
    const rate = Math.round(row.clicks / row.impressions * 1000) / 10;
    const title = declining ? "Review a search that lost clicks" : "Review a search seen often but rarely clicked";
    const evidence = declining
      ? `“${row.value}” brought ${row.clicks} clicks from ${row.impressions} appearances in the last ${days} complete days, down from ${prior!.clicks} clicks in the previous ${days} days.`
      : `“${row.value}” appeared ${row.impressions} times and received ${row.clicks} clicks (${rate}% click-through rate) in the last ${days} complete days.`;
    const nextStep = page
      ? `Open ${page}. Check that its title and visible service details answer this search accurately. Draft any change for review before publishing.`
      : "Find the most relevant service page. Check that its title and visible content answer this search accurately. Draft any change for review before publishing.";
    const score = (declining ? 100 : 0) + Math.min(row.impressions, 1000) / 10 + (page ? 5 : 0);
    return [{ score, item: { query: row.value, page, title, evidence, relevance: "May help people already seeing this business in Google Search decide whether to visit.", effort: "Low to medium", nextStep } }];
  });
  return candidates.sort((a, b) => b.score - a.score).slice(0, 3).map(candidate => candidate.item);
}
