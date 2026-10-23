/**
 * PortalOne mission model.
 *
 * The important idea here: agent steps are DERIVED, not scripted. `runMission`
 * evaluates each plan against the evidence and writes the transcript from the
 * verdict. If a plan's evidence changes, the explanation changes with it.
 */

export type AgentName = "PLANNER" | "ZETARIS" | "EVALUATOR" | "REPLANNER";

export type StepKind = "plan" | "fetch" | "reject" | "pass" | "replan" | "dispatch";

export type CorridorStatus = "proposed" | "rejected" | "verified";

export type Severity = "flood" | "conflict" | "outage";

/** A single record retrieved through Zetaris, with provenance intact. */
export interface EvidenceRecord {
  id: string;
  /** Where the record came from, e.g. "GDACS via Zetaris". */
  source: string;
  /** Table or feed the record was read from. */
  dataset: string;
  /** One-line human-readable fact. */
  statement: string;
  /** When the source observed it, not when we fetched it. */
  observedAt: string;
  /** Minutes since observation. Undefined for static reference data. */
  ageMinutes?: number;
  /** 0..1, carried from the source. */
  confidence: number;
  /** Machine-readable facts this record can support. */
  tags: string[];
}

export interface Corridor {
  id: string;
  name: string;
  /** SVG path used by the map. */
  path: string;
  status: CorridorStatus;
}

export interface Hazard {
  id: string;
  label: string;
  cx: number;
  cy: number;
  r: number;
  severity: Severity;
  evidenceId: string;
}

export interface MapNode {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: "depot" | "target" | "asset";
}

export interface CargoLine {
  label: string;
  quantity: number;
  unit: string;
}

export interface PlanRoute {
  id: string;
  /** Unit that moves, e.g. "Truck group A (5 trucks)". */
  label: string;
  /** Origin depot. */
  from: string;
  corridorId: string;
  cargo: CargoLine[];
  /** Travel time in minutes. */
  etaMinutes: number;
}

export interface Plan {
  id: string;
  label: string;
  summary: string;
  routes: PlanRoute[];
  /** Tags that invalidate the plan outright. */
  risks: string[];
  /** Tags that must be supported by fresh, confident evidence. */
  requires: string[];
}

export type RuleName =
  | "blocker"
  | "missing-evidence"
  | "stale-evidence"
  | "low-confidence"
  | "late"
  | "supported";

export type FindingSeverity = "block" | "warn" | "info";

export interface Finding {
  rule: RuleName;
  severity: FindingSeverity;
  message: string;
  evidenceIds: string[];
}

export interface Verdict {
  status: "approved" | "rejected" | "unverified";
  findings: Finding[];
  blockers: Finding[];
  warnings: Finding[];
}

export interface AgentStep {
  id: string;
  agent: AgentName;
  kind: StepKind;
  title: string;
  detail: string;
  evidenceIds: string[];
  corridorIds: string[];
  verdict?: Verdict;
}

export interface DispatchOrder {
  unit: string;
  from: string;
  route: string;
  cargo: string;
  eta: string;
}

export interface Scenario {
  id: string;
  title: string;
  query: string;
  /** Minutes since midnight, fixed so the demo is reproducible. */
  nowMinutes: number;
  /** Hard ceiling on travel time, in minutes. */
  deadlineMinutes: number;
  evidence: EvidenceRecord[];
  hazards: Hazard[];
  nodes: MapNode[];
  corridors: Corridor[];
  plans: Plan[];
}

export interface MissionRun {
  steps: AgentStep[];
  verdicts: Record<string, Verdict>;
  corridors: Corridor[];
  directive: DispatchOrder[] | null;
}

/** Evidence older than this is shown to the operator but cannot carry a plan. */
export const MAX_EVIDENCE_AGE_MINUTES = 90;

/** Below this, a record is treated as too weak to support a hard constraint. */
export const MIN_CONFIDENCE = 0.8;

function findByTag(evidence: EvidenceRecord[], tag: string): EvidenceRecord[] {
  return evidence.filter((record) => record.tags.includes(tag));
}

function uniqueIds(findings: Finding[]): string[] {
  return [...new Set(findings.flatMap((finding) => finding.evidenceIds))];
}

/**
 * Evaluate one plan. Hard constraints (a known blocker, a missed deadline) and
 * soft constraints (missing, stale or weak evidence) produce different verdicts
 * on purpose: missing evidence means "we don't know yet", not "unsafe".
 */
export function evaluatePlan(
  plan: Plan,
  evidence: EvidenceRecord[],
  deadlineMinutes: number,
): Verdict {
  const findings: Finding[] = [];

  for (const tag of plan.risks) {
    for (const record of findByTag(evidence, tag)) {
      findings.push({
        rule: "blocker",
        severity: "block",
        message: record.statement,
        evidenceIds: [record.id],
      });
    }
  }

  for (const tag of plan.requires) {
    const supporting = findByTag(evidence, tag);
    if (supporting.length === 0) {
      findings.push({
        rule: "missing-evidence",
        severity: "warn",
        message: `No record supports ${tag}. The plan is held until it can be checked.`,
        evidenceIds: [],
      });
      continue;
    }
    for (const record of supporting) {
      findings.push({
        rule: "supported",
        severity: "info",
        message: record.statement,
        evidenceIds: [record.id],
      });
    }
  }

  for (const id of uniqueIds(findings)) {
    const record = evidence.find((candidate) => candidate.id === id);
    if (!record) continue;

    if (
      record.ageMinutes !== undefined &&
      record.ageMinutes > MAX_EVIDENCE_AGE_MINUTES
    ) {
      findings.push({
        rule: "stale-evidence",
        severity: "warn",
        message: `${record.id} is ${record.ageMinutes} minutes old; treat it as a lead, not a fact.`,
        evidenceIds: [record.id],
      });
    }

    if (record.confidence < MIN_CONFIDENCE) {
      findings.push({
        rule: "low-confidence",
        severity: "warn",
        message: `${record.id} is only ${Math.round(record.confidence * 100)}% confident.`,
        evidenceIds: [record.id],
      });
    }
  }

  const slowest = plan.routes.reduce(
    (max, route) => Math.max(max, route.etaMinutes),
    0,
  );
  if (slowest > deadlineMinutes) {
    findings.push({
      rule: "late",
      severity: "block",
      message: `Slowest unit arrives in ${formatDuration(slowest)}, past the ${formatDuration(deadlineMinutes)} window.`,
      evidenceIds: [],
    });
  }

  const blockers = findings.filter((finding) => finding.severity === "block");
  const warnings = findings.filter((finding) => finding.severity === "warn");

  return {
    status:
      blockers.length > 0
        ? "rejected"
        : warnings.length > 0
          ? "unverified"
          : "approved",
    findings,
    blockers,
    warnings,
  };
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

function formatClock(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} UTC`;
}

function routeSummary(route: PlanRoute, corridors: Corridor[]): string {
  const corridor = corridors.find((candidate) => candidate.id === route.corridorId);
  return `${route.label} via ${corridor?.name ?? route.corridorId}`;
}

function cargoSummary(route: PlanRoute): string {
  return route.cargo
    .map((line) => `${line.quantity.toLocaleString("en-US")} ${line.unit} ${line.label.toLowerCase()}`)
    .join(" · ");
}

/**
 * Walk the scenario's plans in order. A rejected plan triggers a replan; the
 * next plan is evaluated against the same evidence. Dispatch is only issued
 * after an approved plan, and it is built from that plan's routes.
 */
export function runMission(scenario: Scenario): MissionRun {
  const steps: AgentStep[] = [];
  const verdicts: Record<string, Verdict> = {};
  const corridors = scenario.corridors.map((corridor) => ({ ...corridor }));
  let directive: DispatchOrder[] | null = null;
  let index = 0;

  const push = (step: Omit<AgentStep, "id">) => {
    index += 1;
    steps.push({ id: `step-${index}`, ...step });
  };

  push({
    agent: "PLANNER",
    kind: "plan",
    title: "Decomposed the request",
    detail:
      "Locate supplies, pick a route that is safe right now, deliver water and medicine first because the clinic has no power, and verify every assumption against federated data before dispatch.",
    evidenceIds: [],
    corridorIds: [],
  });

  push({
    agent: "ZETARIS",
    kind: "fetch",
    title: `Federated ${scenario.evidence.length} records`,
    detail:
      "Queried stock, fleet, road, flood, security, power and population sources through Zetaris. Provenance and confidence travel with every row.",
    evidenceIds: scenario.evidence.map((record) => record.id),
    corridorIds: [],
  });

  let approved: Plan | null = null;

  for (let planIndex = 0; planIndex < scenario.plans.length; planIndex += 1) {
    const plan = scenario.plans[planIndex];
    if (!plan) continue;

    if (planIndex > 0) {
      push({
        agent: "ZETARIS",
        kind: "fetch",
        title: `Re-checked the alternative for ${plan.label}`,
        detail:
          "The previous plan was rejected, so the required records were re-read before proposing a replacement.",
        evidenceIds: [...new Set(plan.requires.flatMap((tag) => findByTag(scenario.evidence, tag).map((record) => record.id)))],
        corridorIds: [],
      });
    }

    const verdict = evaluatePlan(plan, scenario.evidence, scenario.deadlineMinutes);
    verdicts[plan.id] = verdict;

    push({
      agent: "PLANNER",
      kind: "plan",
      title: `${plan.label} — ${plan.summary}`,
      detail: plan.routes
        .map(
          (route) =>
            `${routeSummary(route, corridors)}; ${cargoSummary(route)}; ETA ${formatDuration(route.etaMinutes)}.`,
        )
        .join(" "),
      evidenceIds: [],
      corridorIds: plan.routes.map((route) => route.corridorId),
    });

    if (verdict.status === "approved") {
      approved = plan;
      for (const route of plan.routes) {
        const corridor = corridors.find((candidate) => candidate.id === route.corridorId);
        if (corridor) corridor.status = "verified";
      }
      push({
        agent: "EVALUATOR",
        kind: "pass",
        title: `${plan.label} approved`,
        detail:
          "Every hard constraint holds and every required record is fresh enough to trust. The citations below are the whole basis for the approval.",
        evidenceIds: uniqueIds(verdict.findings),
        corridorIds: plan.routes.map((route) => route.corridorId),
        verdict,
      });
      continue;
    }

    for (const route of plan.routes) {
      const corridor = corridors.find((candidate) => candidate.id === route.corridorId);
      if (corridor && verdict.status === "rejected") corridor.status = "rejected";
    }

    push({
      agent: "EVALUATOR",
      kind: verdict.status === "rejected" ? "reject" : "replan",
      title:
        verdict.status === "rejected"
          ? `${plan.label} rejected`
          : `${plan.label} held for missing evidence`,
      detail:
        verdict.blockers.length > 0
          ? verdict.blockers.map((finding) => finding.message).join(" ")
          : verdict.warnings.map((finding) => finding.message).join(" "),
      evidenceIds: uniqueIds(verdict.findings),
      corridorIds: plan.routes.map((route) => route.corridorId),
      verdict,
    });

    const next = scenario.plans[planIndex + 1];
    if (next) {
      const reason =
        verdict.blockers[0]?.message ??
        verdict.warnings[0]?.message ??
        "The plan could not be confirmed.";
      push({
        agent: "REPLANNER",
        kind: "replan",
        title: `Replanned around ${plan.label}`,
        detail: `${reason} Trying ${next.label}.`,
        evidenceIds: [],
        corridorIds: [],
      });
    }
  }

  if (approved) {
    directive = approved.routes.map((route) => {
      const corridor = corridors.find((candidate) => candidate.id === route.corridorId);
      return {
        unit: route.label,
        from: route.from,
        route: corridor?.name ?? route.corridorId,
        cargo: cargoSummary(route),
        eta: formatClock(scenario.nowMinutes + route.etaMinutes),
      };
    });

    push({
      agent: "PLANNER",
      kind: "dispatch",
      title: "Dispatch directive issued",
      detail:
        "Only an approved plan can produce a directive. Both units move on verified corridors, and the citations remain attached to the order.",
      evidenceIds: uniqueIds(verdicts[approved.id]?.findings ?? []),
      corridorIds: approved.routes.map((route) => route.corridorId),
    });
  } else {
    const blocked = Object.values(verdicts).flatMap((verdict) => verdict.blockers);
    push({
      agent: "EVALUATOR",
      kind: "reject",
      title: "No viable plan — escalated to human control",
      detail:
        "Every proposed plan was blocked by a hard constraint. PortalOne does not dispatch on an unverified route; the incident is escalated with the full citation trail intact.",
      evidenceIds: uniqueIds(blocked),
      corridorIds: [...new Set(scenario.plans.flatMap((plan) => plan.routes.map((route) => route.corridorId)))],
    });
  }

  return { steps, verdicts, corridors, directive };
}

export const SCENARIO: Scenario = {
  id: "mbeli-flood",
  title: "Mbeli camp — flood response",
  query:
    "Flooding in Northern Province: get water, food and medical supplies to 12,000 displaced people at Mbeli camp within 6 hours.",
  nowMinutes: 11 * 60 + 20,
  deadlineMinutes: 6 * 60,
  evidence: [
    {
      id: "E1",
      source: "GDACS via Zetaris",
      dataset: "flood_extent_v4",
      statement: "Flooded area in the north grew 38% in six hours.",
      observedAt: "11:02 UTC",
      ageMinutes: 18,
      confidence: 0.94,
      tags: ["flood.north"],
    },
    {
      id: "E2",
      source: "Road authority via Zetaris",
      dataset: "bridge_status",
      statement: "Bridge B-14 is closed to heavy trucks after water damage.",
      observedAt: "10:47 UTC",
      ageMinutes: 33,
      confidence: 0.91,
      tags: ["bridge.b14.closed"],
    },
    {
      id: "E3",
      source: "ACLED mirror via Zetaris",
      dataset: "security_incidents",
      statement: "Two security incidents were recorded on Road R2 in the last 24 hours.",
      observedAt: "09:30 UTC",
      ageMinutes: 110,
      confidence: 0.82,
      tags: ["security.r2"],
    },
    {
      id: "E4",
      source: "WFP ledger via Zetaris",
      dataset: "stock_levels",
      statement: "Kassa warehouse holds 41 t of food, 18,000 L of water and 6 medical kits.",
      observedAt: "11:10 UTC",
      ageMinutes: 10,
      confidence: 0.97,
      tags: ["stock.kassa"],
    },
    {
      id: "E5",
      source: "Grid telemetry via Zetaris",
      dataset: "substation_status",
      statement: "Power is out at the clinic; its generators have nine hours of fuel.",
      observedAt: "11:05 UTC",
      ageMinutes: 15,
      confidence: 0.88,
      tags: ["power.clinic.out"],
    },
    {
      id: "E6",
      source: "Fleet GPS via Zetaris",
      dataset: "vehicle_positions",
      statement: "Seven trucks are ready at Kassa and two boats are ready at Port Lino.",
      observedAt: "11:12 UTC",
      ageMinutes: 8,
      confidence: 0.96,
      tags: ["fleet.kassa", "fleet.lino"],
    },
    {
      id: "E7",
      source: "Census 2025 via Zetaris",
      dataset: "population_density",
      statement: "About 12,400 people are staying at Mbeli camp.",
      observedAt: "static reference",
      confidence: 0.86,
      tags: ["population.mbeli"],
    },
  ],
  hazards: [
    { id: "H1", label: "Flooding", cx: 330, cy: 150, r: 70, severity: "flood", evidenceId: "E1" },
    { id: "H2", label: "Unsafe road R2", cx: 520, cy: 300, r: 45, severity: "conflict", evidenceId: "E3" },
    { id: "H3", label: "Power out", cx: 640, cy: 140, r: 38, severity: "outage", evidenceId: "E5" },
  ],
  nodes: [
    { id: "kassa", label: "Kassa warehouse", x: 110, y: 330, kind: "depot" },
    { id: "lino", label: "Port Lino", x: 150, y: 90, kind: "depot" },
    { id: "mbeli", label: "Mbeli camp", x: 700, y: 230, kind: "target" },
    { id: "b14", label: "Bridge B-14", x: 360, y: 210, kind: "asset" },
  ],
  corridors: [
    {
      id: "C1",
      name: "Road R1 over Bridge B-14",
      path: "M110 330 C 220 300, 300 240, 360 210 S 600 200, 700 230",
      status: "proposed",
    },
    {
      id: "C2",
      name: "Road R2 (south highway)",
      path: "M110 330 C 300 360, 450 320, 520 300 S 660 260, 700 230",
      status: "proposed",
    },
    {
      id: "C3",
      name: "Hill road R4",
      path: "M110 330 C 230 420, 420 420, 560 380 C 640 350, 690 300, 700 230",
      status: "proposed",
    },
    {
      id: "C4",
      name: "Boats from Port Lino",
      path: "M150 90 C 300 40, 520 50, 620 90 S 700 180, 700 230",
      status: "proposed",
    },
  ],
  plans: [
    {
      id: "A",
      label: "Plan A",
      summary: "seven trucks straight up Road R1",
      routes: [
        {
          id: "A-trucks",
          label: "Truck group A (7 trucks)",
          from: "Kassa warehouse",
          corridorId: "C1",
          cargo: [
            { label: "Food", quantity: 41, unit: "t" },
            { label: "Water", quantity: 18000, unit: "L" },
          ],
          etaMinutes: 190,
        },
      ],
      risks: ["bridge.b14.closed", "flood.north"],
      requires: ["stock.kassa", "fleet.kassa", "population.mbeli"],
    },
    {
      id: "B",
      label: "Plan B",
      summary: "the south highway instead",
      routes: [
        {
          id: "B-trucks",
          label: "Truck group A (7 trucks)",
          from: "Kassa warehouse",
          corridorId: "C2",
          cargo: [
            { label: "Food", quantity: 41, unit: "t" },
            { label: "Water", quantity: 18000, unit: "L" },
          ],
          etaMinutes: 225,
        },
      ],
      risks: ["security.r2"],
      requires: ["stock.kassa", "fleet.kassa", "population.mbeli"],
    },
    {
      id: "C",
      label: "Plan C",
      summary: "split the load across road and river",
      routes: [
        {
          id: "C-trucks",
          label: "Truck group A (5 trucks)",
          from: "Kassa warehouse",
          corridorId: "C3",
          cargo: [
            { label: "Food", quantity: 41, unit: "t" },
            { label: "Water", quantity: 15000, unit: "L" },
          ],
          etaMinutes: 245,
        },
        {
          id: "C-boats",
          label: "Boat group B (2 boats)",
          from: "Port Lino",
          corridorId: "C4",
          cargo: [
            { label: "Medical kits", quantity: 6, unit: "kits" },
            { label: "Generator fuel", quantity: 800, unit: "L" },
            { label: "Water", quantity: 3000, unit: "L" },
          ],
          etaMinutes: 140,
        },
      ],
      risks: ["road.r4.blocked", "port.lino.closed"],
      requires: ["stock.kassa", "fleet.kassa", "fleet.lino", "population.mbeli"],
    },
  ],
};
