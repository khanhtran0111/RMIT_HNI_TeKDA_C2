import { classifyTideError } from "@/tide-integration/refusal";

export function RefusalPanel({ error }: { error: unknown }) {
  const result = classifyTideError(error);
  const refused = result.kind === "refused";
  return (
    <section className={`result-panel result-${result.kind}`} role="alert" aria-label="Open result">
      <h3><span aria-hidden="true">{refused ? "⊘" : "!"}</span> {refused ? "Refused by the Tide network" : result.kind === "outage" ? "Cannot reach the Tide network, try again" : "Could not complete this request"}</h3>
      {refused && result.nodes && <p className="node-count">{result.nodes.got} of {result.nodes.required} nodes would release this key</p>}
      {result.cause && <pre className="contract-cause">{result.cause}</pre>}
      <p className="error-message">{result.message}</p>
      <details><summary>Show raw error</summary><pre>{JSON.stringify({ message: result.message, cause: result.cause, kind: result.kind, nodes: result.nodes }, null, 2)}</pre></details>
    </section>
  );
}
