"use client";

import { AccessGate, AppShell } from "@/components/AppShell";
import { ItemCard } from "@/components/ItemCard";
import { useSession } from "@/components/Session";
import { useVaultItems } from "@/components/VaultData";
import { heirRoleForRecord } from "@/lib/fixtures";

export default function HeirPage() {
  const session = useSession();
  return <AppShell eyebrow="A decision kept for you" title="From Mai, for you" description="Each item has one named recipient. Two independent seats must approve a release before that recipient can open it."><AccessGate allow={["linh", "long"].includes(session.username)}><HeirContent key={`${session.username}:${session.token}`} username={session.username} roles={session.roles} /></AccessGate></AppShell>;
}
function HeirContent({ username, roles }: { username: string; roles: string[] }) {
  const { items, loading, error, refresh, client } = useVaultItems();
  const own = items.filter(item => item.recipientUsername === username);
  const others = items.filter(item => item.recipientUsername !== username);
  return <>
    <div className="notice"><p>Roles arrive on your next sign-in. If a release was just approved, sign out and back in.</p><p className="help">“Released to me” reflects the roles in this session. The Tide network checks the policy when you open an item.</p></div>
    {loading && <p role="status">Loading items from Mai…</p>}{error && <div className="notice" role="alert"><p>{error}</p><button className="button-secondary" onClick={refresh}>Reload items</button></div>}
    {!loading && !error && <><div className="section-heading"><h2>Addressed to you <span className="muted">({own.length})</span></h2></div>{!own.length && <div className="empty-state">Mai has not sealed an item for you yet.</div>}
      <div className="item-list">{own.map(item => <ItemCard key={item.id} item={item} access="heir" released={roles.includes(heirRoleForRecord[item.recordId])} open={() => client.openItem(item, "heir")} />)}</div>
      {!!others.length && <section className="other-items"><h2>Addressed to another recipient</h2><p className="muted">These records remain visible as ciphertext. A release of your item does not grant access to theirs.</p><div className="item-list">{others.map(item => <ItemCard key={item.id} item={item} access="heir" otherRecipient open={() => client.openItem(item, "heir")} />)}</div></section>}
    </>}
  </>;
}
