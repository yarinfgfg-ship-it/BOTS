#!/bin/sh
set -e

mkdir -p /app/data

# First deploy: copy the local JSON settings into the data directory.
for f in /app/seed/*.json; do
  [ -e "$f" ] || continue
  target="/app/data/$(basename "$f")"
  [ -e "$target" ] || cp "$f" "$target"
done

# Optional: paste settings as env vars on hosts without a persistent disk.
[ -z "$GUILDS_JSON" ] || printf '%s' "$GUILDS_JSON" > /app/data/guilds.json
[ -z "$TICKETS_JSON" ] || printf '%s' "$TICKETS_JSON" > /app/data/tickets.json
[ -z "$PROFILES_JSON" ] || printf '%s' "$PROFILES_JSON" > /app/data/profiles.json
[ -z "$OAUTH_JSON" ] || printf '%s' "$OAUTH_JSON" > /app/data/oauth.json
[ -z "$GIVEAWAYS_JSON" ] || printf '%s' "$GIVEAWAYS_JSON" > /app/data/giveaways.json
[ -z "$SUGGESTIONS_JSON" ] || printf '%s' "$SUGGESTIONS_JSON" > /app/data/suggestions.json
[ -z "$LEVELS_JSON" ] || printf '%s' "$LEVELS_JSON" > /app/data/levels.json
[ -z "$VERIFICATIONS_JSON" ] || printf '%s' "$VERIFICATIONS_JSON" > /app/data/verifications.json

exec node index.js
