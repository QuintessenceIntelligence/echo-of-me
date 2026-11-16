import { PROVENANCE_LABEL, type Provenance } from "../../../src/domain/vault";

export const KIND_LABEL: Record<string, string> = { memory: "Memory", value_statement: "Value" };

export function ApprovalPill({ approval }: { approval: "draft" | "approved" }) {
  return approval === "approved" ? <span className="pill good">Approved</span> : <span className="pill">Draft, not used in answers</span>;
}

const CLASS: Record<Provenance, string> = {
  P1_original_recording: "prov p1",
  P2_author_written: "prov p2",
  P3_approved_transcript: "prov p3",
  P4_approved_derivation: "prov p3",
  P5_contributor_authored: "prov",
  P6_unapproved_machine_output: "prov p6",
};

/** Says what a piece of material is (01B §4.3), in plain words with the class code for reference. */
export function ProvenanceBadge({ p }: { p: Provenance }) {
  return (
    <span className={CLASS[p]} title={`Provenance class ${p.slice(0, 2)}`}>
      {PROVENANCE_LABEL[p]} <span className="prov-code">{p.slice(0, 2)}</span>
    </span>
  );
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
