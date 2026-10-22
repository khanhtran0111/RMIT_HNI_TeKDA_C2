import { classifyTideError } from "@/tide-integration/refusal";
import { Icon } from "./Icon";
import { NodeGrid, TIDE_NETWORK } from "./tide";

// The hero visual of the demo. Numbers come only from the observed error (classifyTideError(...).nodes);
// the network size is this network's constant and is labelled as such.
export function RefusalPanel({ error, action = "open" }: { error: unknown; action?: "open" | "seal" }) {
  const result = classifyTideError(error);
  const sealing = action === "seal";
  const refused = result.kind === "refused";
  const outage = result.kind === "outage";
  const title = refused ? "Refused by the Tide network" : outage ? "Cannot reach the Tide network, try again" : "Could not complete this request";
  const required = result.nodes?.required ?? TIDE_NETWORK.required;
  const kicker = refused ? "Tide network decision" : outage ? "Connection problem" : "Something went wrong";
  return (
    <section className={`result-panel result-${result.kind}`} role="alert" aria-label={sealing ? "Seal result" : "Open result"}>
      <div className="refusal-head">
        <span className="refusal-icon"><Icon name={refused ? "shieldX" : "alert"} size={26} /></span>
        <div>
          <p className="refusal-kicker">{kicker}</p>
          <h3 className="refusal-title">{title}</h3>
        </div>
      </div>
      {refused && result.nodes && <p className="node-count">{result.nodes.got} of {result.nodes.required} nodes would release this key</p>}
      {refused && <NodeGrid state="refused" got={result.nodes?.got} required={required} total={TIDE_NETWORK.total} headline={result.nodes ? `On ${TIDE_NETWORK.label}, ${required} of ${TIDE_NETWORK.total} independent nodes must agree before a key is released.` : undefined} sub={result.nodes ? false : undefined} />}
      {refused && <p className="refusal-explain">{sealing
        ? "The network checked this record’s owner policy against the roles in your session and did not agree. This item was not sealed or sent."
        : "The network checked this item’s policy against the roles in your session. Without enough nodes agreeing, this item cannot be decrypted by anyone, including Heirloom."}</p>}
      {result.reason && <div className="refusal-reason"><p className="refusal-label">Reason given by the policy check</p><pre className="contract-cause">{result.reason}</pre></div>}
      {!refused && <p className="error-message">{result.message}</p>}
      <details><summary>Show raw error</summary><pre>{JSON.stringify({ message: result.message, cause: result.cause, kind: result.kind, nodes: result.nodes }, null, 2)}</pre></details>
    </section>
  );
}
