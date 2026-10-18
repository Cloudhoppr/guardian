// Prints PHOTON_SPACE_ID and PHOTON_AGENT_USER_ID for Grandma's shared-line
// thread. Run after Grandma has texted the assigned line at least once:
//   npm run photon:ids

import { GRANDMA_PHONE_E164 } from "@/lib/demo";

type Received = {
  id: string;
  createdAt: string;
  sentBy: { id: string; handle?: string };
  receivedBy?: { id: string; handle?: string };
  space: { id: string; kind: string; participantIds: string[] };
};

async function main() {
  const apiKey = process.env.PHOTON_API_KEY;
  const projectId = process.env.PHOTON_PROJECT_ID;
  const url = process.env.PHOTON_API_URL ?? "https://api.photon.codes";
  if (!apiKey || !projectId) throw new Error("PHOTON_API_KEY and PHOTON_PROJECT_ID must be set in .env.local");

  const qs = new URLSearchParams({ direction: "received", platform: "imessage", order: "desc", pageSize: "20" });
  const res = await fetch(`${url}/v1/projects/${projectId}/messages?${qs}`, {
    headers: { authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`photon ${res.status}: ${await res.text()}`);
  const { items } = (await res.json()) as { items: Received[] };

  const msg = items.find((m) => m.sentBy.handle === GRANDMA_PHONE_E164 && m.space.kind === "direct");
  if (!msg) {
    console.log(`No inbound iMessage from ${GRANDMA_PHONE_E164} yet. Text the assigned line first, then rerun.`);
    console.log("Recent senders:", items.map((m) => m.sentBy.handle ?? m.sentBy.id));
    return;
  }

  const agentUserId = msg.receivedBy?.id ?? msg.space.participantIds.find((id) => id !== msg.sentBy.id);
  console.log(`PHOTON_SPACE_ID=${msg.space.id}`);
  console.log(`PHOTON_AGENT_USER_ID=${agentUserId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
