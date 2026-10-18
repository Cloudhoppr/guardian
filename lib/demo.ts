// Demo identities. Grandma is played by a real iPhone holding the Photon
// shared-line thread; only this handle has an assignment, so photon.ts sends
// to it and logs-and-skips everyone else (Elena has no seat).
export const GRANDMA_PHONE_E164 = "+15822631797";

// The shared-pool number Photon assigned to Guardian. Grandma texts this once
// to open the thread — a shared line can't send the first message.
export const GUARDIAN_LINE_E164 = "+16289988199";
