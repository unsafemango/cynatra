# Deploying Cynatra on Kubernetes for free

This guide puts the whole app (web, gateway, picker, Postgres, Redis) on a single
**Oracle Cloud "Always Free"** server running **k3s**, a lightweight but standard
Kubernetes. Within Oracle's free limits it costs nothing; you only pay for a domain
(about $10 a year).

> **Status:** everything except backups is in the repo: the Kubernetes manifests
> (`k8s/`) and the GitHub Actions image build (`.github/workflows/images.yml`).
> The manifests are set up for `cynatra.app`; for another domain, change it in
> `k8s/ingress.yaml` and `k8s/kustomization.yaml`.

---

## What you'll end up with

```
                   https://yourdomain.com
                             │
                 Traefik ingress (k3s) + Let's Encrypt HTTPS
                ┌────────────┴────────────┐
             /api/*                        /*
                │                           │
            gateway ──► picker ──► TMDB    web (Next.js)
             │    │       │
       Postgres  Brevo   Redis
       (on disk) (email) (cache)
```

- **One domain** for everything: `/api/*` goes to the gateway, the rest to the web
  app. No CORS settings, and only one origin to allow for Google sign-in.
- **Images** are built by GitHub Actions (free for public repos) and stored in
  GitHub's container registry (`ghcr.io`, free for public images), for both ARM
  (Oracle's free servers) and Intel.
- **Secrets** (TMDB key, JWT secret, Brevo, Google client ID) live in a
  Kubernetes Secret on the server, never in git.
- **Email** keeps going through Brevo; Mailpit is only for local development.

### What's free, and the catches

| Item | Free allowance | Catch |
|---|---|---|
| Oracle Ampere A1 server | 4 CPU cores, 24 GB RAM, permanently | Popular regions are often "out of capacity"; you may need to retry |
| Disk (block storage) | 200 GB total | Plenty for this app |
| Outbound traffic | 10 TB / month | Plenty |
| GitHub Actions + ghcr.io | Free for public repos | Your repo is public, so ✅ |
| Let's Encrypt HTTPS | Free | Needs a real domain |
| Domain | ❌ ~$10 / year | The only cost |

> **Important: idle servers can be reclaimed.** Oracle may reclaim an *Always Free*
> server that sits almost idle (very low CPU, network and memory use) for 7 days,
> which a quiet hobby app can trigger. Upgrading the account to **Pay As You Go**
> stops this. You still pay nothing as long as you stay within the free limits. Set
> a **budget alert** (step 2) so you'd hear about any charge immediately.

---

## 1. Buy a domain

Any registrar works. **Cloudflare Registrar** sells at cost with no markup;
**Namecheap** and **Porkbun** are also cheap. A `.com` is about $10 a year, and
some other endings are cheaper.

You'll add DNS records in step 5, once the server has an IP address.

## 2. Create an Oracle Cloud account

1. Sign up at **https://www.oracle.com/cloud/free/**. A card is needed for
   identity verification; Always Free use isn't charged.
2. **Pick your home region carefully: it can't be changed later.** Choose one
   near your users. If a region is constantly out of A1 capacity, a less busy
   one nearby is better.
3. Recommended: **Billing → Upgrade to Pay As You Go**, to avoid idle reclamation
   (see above).
4. **Billing → Budgets → Create budget**: set an amount of **$1** with an alert
   at 100%, so any accidental charge emails you straight away.

## 3. Create the server (VM)

1. **Compute → Instances → Create instance.**
2. **Image:** Canonical **Ubuntu 24.04** (pick the *aarch64* / ARM build).
3. **Shape:** *Change shape* → **Ampere** → `VM.Standard.A1.Flex`, with
   **4 OCPUs and 24 GB** memory.
4. **Networking:** keep the default new VCN and **assign a public IPv4 address**.
5. **SSH keys:** upload your public key (`~/.ssh/id_ed25519.pub`, or create one
   with `ssh-keygen -t ed25519`).
6. **Boot volume:** 100 GB is fine.
7. **Create.** If you get *"Out of capacity"*, try another availability domain
   in the same region or try again later; it usually works within a day.

Note the server's **public IP address**.

## 4. Open ports 80 and 443

Two firewalls need opening.

**a) Oracle's network firewall:** *Networking → Virtual cloud networks → your VCN
→ Security Lists → Default → Add Ingress Rules*, adding two rules:

| Source CIDR | Protocol | Destination port |
|---|---|---|
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

**b) The server's own firewall.** Oracle's Ubuntu images block everything except
SSH. Connect and allow web traffic:

```bash
ssh ubuntu@YOUR_SERVER_IP
```

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
```

The same image also rejects traffic between containers, which breaks Kubernetes
networking. Allow k3s's pod and service networks, drop the blanket `FORWARD`
reject, and save so it all survives a reboot:

```bash
sudo iptables -I INPUT 6 -s 10.42.0.0/16 -j ACCEPT
sudo iptables -I INPUT 6 -s 10.43.0.0/16 -j ACCEPT
sudo iptables -D FORWARD -j REJECT --reject-with icmp-host-prohibited
sudo netfilter-persistent save
```

Don't open the Kubernetes API port (6443) to the internet. Run `kubectl` on the
server over SSH (or through an SSH tunnel) instead.

## 5. Point your domain at the server

In your registrar's DNS settings, add:

| Type | Name | Value |
|---|---|---|
| `A` | `@` (the bare domain) | `YOUR_SERVER_IP` |
| `A` | `www` | `YOUR_SERVER_IP` |

If your DNS is on Cloudflare, set these to **DNS only** (grey cloud) for now, so
Let's Encrypt can reach the server directly in step 6.

Check it from your laptop (it can take a few minutes):

```bash
dig +short yourdomain.com
```

## 6. Install Kubernetes (k3s) and HTTPS (cert-manager)

On the server:

```bash
curl -sfL https://get.k3s.io | sh -
```

```bash
mkdir -p ~/.kube && sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config && sudo chown $USER ~/.kube/config
```

k3s's `kubectl` reads its root-only `/etc/rancher/k3s/k3s.yaml` unless told
otherwise, so point it at your copy (log out and back in afterwards):

```bash
echo "KUBECONFIG=$HOME/.kube/config" | sudo tee -a /etc/environment
```

```bash
kubectl get nodes
```

You should see one node with status `Ready`. k3s already includes **Traefik**
(routes web traffic) and a **local-path** storage class (disks for Postgres).

Install **cert-manager**, which gets and renews free HTTPS certificates:

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
```

```bash
kubectl -n cert-manager rollout status deploy/cert-manager-webhook
```

## 7. Prepare the secrets

Generate a strong JWT secret on your laptop (keep it private):

```bash
openssl rand -hex 32
```

On the server, create a namespace and the secret, filling in your real values.
These are the same values as your local `.env`, except `JWT_SECRET`, which
should be the new one above:

```bash
kubectl create namespace cynatra
```

```bash
kubectl -n cynatra create secret generic cynatra-secrets \
  --from-literal=TMDB_API_KEY='...' \
  --from-literal=JWT_SECRET='...' \
  --from-literal=POSTGRES_PASSWORD="$(openssl rand -hex 24)" \
  --from-literal=GOOGLE_CLIENT_ID='...apps.googleusercontent.com' \
  --from-literal=SMTP_HOST='smtp-relay.brevo.com' \
  --from-literal=SMTP_PORT='587' \
  --from-literal=SMTP_USER='...@smtp-brevo.com' \
  --from-literal=SMTP_PASS='...' \
  --from-literal=EMAIL_FROM='Cynatra <no-reply@yourdomain.com>'
```

Leave a leading space before the command if your shell supports
`HISTCONTROL=ignorespace`, so the secrets don't land in your shell history, or
clear it afterwards with `history -c`.

Then update two outside services:

- **Google sign-in:** in Google Cloud Console → Credentials → your OAuth client,
  add **`https://yourdomain.com`** to *Authorized JavaScript origins*. Keep
  `http://localhost:3000` for local development.
- **Email:** in Brevo, *Senders, Domains → Domains → Add a domain*, and add the
  DNS records it gives you (SPF/DKIM). Then send from `no-reply@yourdomain.com`.
  Codes are far less likely to land in spam than when sent from a Gmail address.

## 8. Build the images

Every push to `main` builds `web`, `gateway` and `picker` for ARM
and Intel and pushes them to `ghcr.io/unsafemango/cynatra-<service>`.
After the first run, make each package public: *GitHub → your profile →
Packages → package → Settings → Change visibility → Public*. Then the cluster can
pull them without credentials.

The web image is built for the **same domain** (`/api` instead of
`http://localhost:4000`), so one image works on any domain.

The first build starts when this workflow reaches `main`. You can rerun it any
time from the repo's *Actions* tab → **Images** → **Run workflow**. The first
run takes 10–20 minutes because ARM images are built under emulation; later runs
are cached.

## 9. Deploy

Get the manifests onto the server (the repo is public) and apply them:

```bash
git clone https://github.com/unsafemango/cynatra.git && cd cynatra
```

```bash
kubectl apply -k k8s/
```

```bash
kubectl -n cynatra get pods
```

When every pod is `Running`, open **https://yourdomain.com**. The first HTTPS
certificate can take a minute.

## 10. Updating later

Push to `main`. GitHub Actions builds new images, and its **deploy** job then
restarts web, gateway and picker on the server so they pull them (about 10
minutes in all; watch it under the repo's **Actions** tab).

The deploy job uses its own SSH key, which can only run the restart:

1. Make a key pair just for GitHub: `ssh-keygen -t ed25519 -N "" -C github-actions-deploy -f deploy_key`
2. On the server, save the restart script as `/usr/local/bin/cynatra-deploy`
   (`kubectl -n cynatra rollout restart deploy/web deploy/gateway deploy/picker`,
   then `rollout status` for each) and make it executable.
3. Add the public key to the server's `~/.ssh/authorized_keys`, forced to that
   script: `restrict,command="/usr/local/bin/cynatra-deploy" ssh-ed25519 AAAA… github-actions-deploy`
4. Add two repo secrets (Settings → Secrets and variables → Actions):
   `DEPLOY_SSH_KEY` (the private key file) and `DEPLOY_KNOWN_HOSTS`
   (`ssh-keyscan -t ed25519 YOUR_SERVER_IP`). Then delete the local private key.

To restart by hand instead:

```bash
ssh ubuntu@YOUR_SERVER_IP 'kubectl -n cynatra rollout restart deploy/web deploy/gateway deploy/picker'
```

If the manifests in `k8s/` changed, apply them from your laptop first:

```bash
kubectl kustomize k8s/ | ssh ubuntu@YOUR_SERVER_IP kubectl apply -f -
```

## 11. Backups (recommended)

Your accounts, watchlists and history live in Postgres on the server's disk.
A nightly dump to Oracle's free **Object Storage** (20 GB free) protects them.
A backup job isn't in the manifests yet.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Site doesn't load at all | Ports 80/443 not open in **both** firewalls (step 4), or DNS not pointing at the server yet (`dig +short yourdomain.com`) |
| Browser says "Not secure" | Certificate still being issued: `kubectl -n cynatra describe certificate`. Cloudflare proxy (orange cloud) on during issuance? |
| "Google sign-in isn't available" | `https://yourdomain.com` missing from the OAuth client's Authorized JavaScript origins |
| Sign-up says "We couldn't send the email" | Brevo SMTP values in the secret, or `EMAIL_FROM` isn't a verified sender |
| Spins fail | TMDB key in the secret: `kubectl -n cynatra logs deploy/picker` |
| A pod keeps restarting | `kubectl -n cynatra describe pod <name>` and `kubectl -n cynatra logs <name>` |

## Not keen on running a server?

A no-Kubernetes free setup also works, at the cost of slow first requests after
idle periods:

- Website on **Vercel**
- Gateway and picker on **Render** or **Koyeb** free tiers (they sleep when idle)
- Postgres on **Neon**
- Redis on **Upstash**
- Email on **Brevo**
