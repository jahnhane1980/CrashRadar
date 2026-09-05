#!/usr/bin/env bash
set -e

echo "=== 1. Installiere Antigravity (agy) ==="
curl -fsSL https://antigravity.google/cli/install.sh | bash

# Umgebungsvariablen / Pfade für die laufende Subshell laden
export PATH="$HOME/.local/bin:$HOME/.antigravity/bin:$PATH"
[ -f "$HOME/.bashrc" ] && source "$HOME/.bashrc"

echo "=== 2. Installiere Graphify ==="
# Sicherstellen, dass Python-Tools verfügbar sind
pip install --no-cache-dir graphifyy

echo "=== 3. Registriere Graphify bei Antigravity ==="
graphify antigravity install --project

# Workaround/Absicherung: Falls der Ordner .agent (Einzahl) erzeugt wurde, 
# aber Antigravity .agents (Mehrzahl) erwartet:
if [ -d ".agent" ] && [ ! -d ".agents/rules" ]; then
    mkdir -p .agents
    cp -rn .agent/* .agents/ 2>/dev/null || true
fi

echo "=== 4. Initialisiere Graphify Knowledge Graph ==="
graphify update .
graphify export html

echo "=== Setup erfolgreich abgeschlossen! ==="