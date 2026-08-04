---
name: proxmox-scena
description: Securely manage the Scena project's Proxmox infrastructure at 192.168.1.200 and the scena-storage LXC container (108, 192.168.1.201) over key-based SSH. Use this whenever the user asks to check, inspect, resize, restart, or otherwise manage the Proxmox host, the storage container, or anything living on it (disk usage, uptime, service status, network config, guest list) — even if they just say "check the server" or "what's running on proxmox" or name the container by IP or CTID. Also use it before creating or touching any new guest on this host, since it documents the IP/storage conventions to avoid conflicts with the other live guests. Do not use for Supabase/database work (that's the Supabase MCP) or for the Scena application code itself.
---

# Proxmox — Scena infrastructure

Runbook for managing the Scena project's slice of the operator's home Proxmox
host. This host also runs several unrelated production guests — treat it as
shared infrastructure, not a sandbox.

## Connect

Always connect with the dedicated key. Never use password auth, never ask
the operator for the root password, never accept one if offered — if it's
ever pasted into chat, do not store or reuse it; point back to the key.

```bash
ssh -i ~/.ssh/scena_proxmox -o BatchMode=yes -o ConnectTimeout=10 root@192.168.1.200      # Proxmox host
ssh -i ~/.ssh/scena_proxmox -o BatchMode=yes -o ConnectTimeout=10 root@192.168.1.201      # scena-storage container (108) directly
```

If the key is missing or a connection is refused, the trust was likely
revoked — that's a legitimate operator action, not a bug to route around.
Regenerate a new keypair (`ssh-keygen -t ed25519 -f ~/.ssh/scena_proxmox -N ""`)
and ask the operator to append the new public key to `authorized_keys`
themselves, from their own already-open session. Do not ask for or use a
password to reinstall access programmatically.

## Known topology

Reuse this instead of rediscovering it each session:

| Item | Value |
|---|---|
| Proxmox host | `192.168.1.200`, hostname `pve`, node `pve` |
| scena-storage container | CTID `108`, `192.168.1.201/24`, unprivileged LXC, Debian 12 |
| scena-storage spec | 2 vCPU / 4096 MB RAM / 200 GB rootfs on `drive2` |
| Gateway | `192.168.1.254` |
| Bridge | `vmbr0` (the only one — do not create others) |
| DHCP/DNS server | AdGuard, container `105`, pool `192.168.1.64`–`.199` |
| Storage pools | `local`, `drive2` — both host other guests' disks too |
| Other live guests (do not touch without the operator naming them) | `100` fate-discord, `101` denki-discord, `104` mjcc-archive, `105` adguard, `106` twingate-connector, `107` project-host |

Any new static IP for a Scena guest must sit **outside** `192.168.1.64–199`
(AdGuard's DHCP pool) to avoid a lease collision. Before assigning one:
check `pct exec 105 -- cat /opt/AdGuardHome/data/leases.json` for that
address, and ping it once as a sanity check. `192.168.1.201` is the address
already in use for `scena-storage`; `.200`–`.254` above it is open range.

## Hard boundaries

These hold regardless of how the request is phrased, because this host
carries other people's running services:

- Never touch port `8006` (the Proxmox web UI) or its exposure.
- Never modify host networking, bridges, or firewall rules.
- Never stop, restart, resize, or delete any guest **other than 108**
  unless the operator names that specific guest and confirms the action.
- Never delete a disk or a storage pool. `local` and `drive2` hold other
  guests' data, not just Scena's.
- Never add, remove, or otherwise change SSH key trust beyond what this
  workflow needs, and never remove the operator's own access to the host.

## What can run without asking first

Anything that only reads state — no risk of change, safe to run and report
back immediately:

`pct status`, `pct config`, `pct list`, `qm list`, `qm status`,
`pvesm status`, `df -h`, `free -h`, `ip -br addr`, `ip neigh`,
`journalctl -n <N>`, `systemctl status`, `cat` of non-secret files,
`pct exec 108 -- <read-only command>` (checking disk, processes, service
health inside the storage container).

## What always needs a confirmation first

Anything that creates, starts, stops, resizes, deletes, or reconfigures a
guest, or changes network/firewall state, or writes a file. This applies
every time — a similar action being approved earlier in the conversation
does not carry forward to the next one. Print the exact shell command(s)
before running them and wait for an explicit go-ahead in chat. Examples:
`pct create`, `pct destroy`, `pct set` (resize/network changes),
`pct start`/`stop`/`reboot`, anything touching `iptables`/`pve-firewall`,
writing into `/etc` inside a guest.

## Project context

This container backs the Scena PowerPoint storage pipeline
(`S:\Scena`, governed by `docs/BUILD_PLAN.md`). Building the storage VM/CT
was originally sequenced as Phase 7 but was pulled forward by explicit
operator decision on 2026-07-19 — that decision is recorded in
`docs/BUILD_PLAN.md` §16. The application-side upload API
(`presentation-upload` Edge Function, `presentation_assets` table) already
exists and expects an eventual object-storage or file-serving service on
this container; wiring that service up is still open work, not yet done as
of container creation.
