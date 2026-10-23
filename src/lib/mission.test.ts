import { describe, expect, it } from "vitest";

import {
  SCENARIO,
  evaluatePlan,
  runMission,
  type Plan,
  type Scenario,
} from "./mission";

function getPlan(id: string): Plan {
  const plan = SCENARIO.plans.find((candidate) => candidate.id === id);
  if (!plan) throw new Error(`missing plan ${id}`);
  return plan;
}

describe("evaluatePlan", () => {
  it("rejects Plan A on the bridge and flood records", () => {
    const verdict = evaluatePlan(
      getPlan("A"),
      SCENARIO.evidence,
      SCENARIO.deadlineMinutes,
    );

    expect(verdict.status).toBe("rejected");
    expect(verdict.blockers).toHaveLength(2);
    expect(verdict.blockers.flatMap((finding) => finding.evidenceIds)).toEqual(
      expect.arrayContaining(["E2", "E1"]),
    );
    expect(verdict.blockers.every((finding) => finding.rule === "blocker")).toBe(true);
  });

  it("rejects Plan B on the security record and flags that record as stale", () => {
    const verdict = evaluatePlan(
      getPlan("B"),
      SCENARIO.evidence,
      SCENARIO.deadlineMinutes,
    );

    expect(verdict.status).toBe("rejected");
    expect(verdict.blockers.flatMap((finding) => finding.evidenceIds)).toContain("E3");
    expect(
      verdict.warnings.some(
        (finding) =>
          finding.rule === "stale-evidence" && finding.evidenceIds.includes("E3"),
      ),
    ).toBe(true);
  });

  it("approves Plan C and cites every required record", () => {
    const verdict = evaluatePlan(
      getPlan("C"),
      SCENARIO.evidence,
      SCENARIO.deadlineMinutes,
    );

    expect(verdict.status).toBe("approved");
    expect(verdict.blockers).toHaveLength(0);
    const supported = verdict.findings
      .filter((finding) => finding.rule === "supported")
      .flatMap((finding) => finding.evidenceIds);
    expect(supported).toEqual(expect.arrayContaining(["E4", "E6", "E7"]));
  });

  it("holds a plan instead of approving it when a required record is missing", () => {
    const base = getPlan("C");
    const held: Plan = {
      ...base,
      id: "held",
      label: "Plan Held",
      requires: [...base.requires, "shelter.mbeli"],
      risks: [],
    };

    const verdict = evaluatePlan(held, SCENARIO.evidence, SCENARIO.deadlineMinutes);

    expect(verdict.status).toBe("unverified");
    expect(
      verdict.warnings.some((finding) => finding.rule === "missing-evidence"),
    ).toBe(true);
  });

  it("rejects a plan that misses the response window", () => {
    const base = getPlan("C");
    const late: Plan = {
      ...base,
      id: "late",
      label: "Plan Late",
      risks: [],
      routes: base.routes.map((route) => ({ ...route, etaMinutes: 500 })),
    };

    const verdict = evaluatePlan(late, SCENARIO.evidence, SCENARIO.deadlineMinutes);

    expect(verdict.status).toBe("rejected");
    expect(verdict.blockers.some((finding) => finding.rule === "late")).toBe(true);
  });
});

describe("runMission", () => {
  it("rejects twice, approves once, and dispatches only after approval", () => {
    const run = runMission(SCENARIO);

    expect(run.steps[0]?.agent).toBe("PLANNER");
    expect(run.steps.at(-1)?.kind).toBe("dispatch");
    expect(run.steps.filter((step) => step.kind === "reject")).toHaveLength(2);
    expect(run.steps.filter((step) => step.kind === "pass")).toHaveLength(1);

    const evidenceByStep = new Map(
      run.steps.map((step) => [step.title, step.evidenceIds]),
    );
    expect(evidenceByStep.get("Plan A rejected") ?? []).toEqual(
      expect.arrayContaining(["E1", "E2"]),
    );
    expect(evidenceByStep.get("Plan B rejected") ?? []).toContain("E3");
  });

  it("marks rejected corridors rejected and the approved ones verified", () => {
    const run = runMission(SCENARIO);
    const status = new Map(
      run.corridors.map((corridor) => [corridor.id, corridor.status]),
    );

    expect(status.get("C1")).toBe("rejected");
    expect(status.get("C2")).toBe("rejected");
    expect(status.get("C3")).toBe("verified");
    expect(status.get("C4")).toBe("verified");
  });

  it("builds the directive from the approved plan, with clock times", () => {
    const run = runMission(SCENARIO);

    expect(run.directive).not.toBeNull();
    expect(run.directive ?? []).toHaveLength(2);
    expect((run.directive ?? []).map((order) => order.eta)).toEqual([
      "15:25 UTC",
      "13:40 UTC",
    ]);
    expect((run.directive ?? []).map((order) => order.route)).toEqual([
      "Hill road R4",
      "Boats from Port Lino",
    ]);
  });

  it("issues no directive when every plan is rejected", () => {
    const deadEnd: Scenario = {
      ...SCENARIO,
      plans: [getPlan("A"), getPlan("B")],
    };

    const run = runMission(deadEnd);

    expect(run.directive).toBeNull();
    expect(run.steps.some((step) => step.kind === "dispatch")).toBe(false);
    const last = run.steps.at(-1);
    expect(last?.kind).toBe("reject");
    expect(last?.title).toContain("No viable plan");
    expect(last?.evidenceIds).toEqual(expect.arrayContaining(["E1", "E2", "E3"]));
  });
});
