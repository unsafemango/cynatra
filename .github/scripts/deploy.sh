#!/usr/bin/env bash
# Deploys a commit to an environment over SSH:  deploy.sh <staging|prod> <commit sha>
# The server's deploy key only runs /usr/local/bin/cynatra-deploy, which does
# the work; this just connects, retrying connections dropped by bots probing
# port 22 (ssh exits 255), but never a deploy that actually failed.
set -euo pipefail
env="$1" sha="$2"
host=ubuntu@140.238.158.170

install -m 700 -d ~/.ssh
printf '%s\n' "$SSH_KEY" > ~/.ssh/deploy && chmod 600 ~/.ssh/deploy
printf '%s\n' "$KNOWN_HOSTS" > ~/.ssh/known_hosts

for i in 1 2 3 4 5; do
  rc=0
  ssh -i ~/.ssh/deploy -o IdentitiesOnly=yes -o ConnectTimeout=20 "$host" deploy "$env" "$sha" || rc=$?
  [ "$rc" -ne 255 ] && exit "$rc"
  echo "Couldn't connect (attempt $i), retrying"; sleep 15
done
exit 1
