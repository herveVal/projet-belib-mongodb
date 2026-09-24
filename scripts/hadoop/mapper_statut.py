#!/usr/bin/env python3
# MAPPER - Nombre de points de charge par statut (équivalent du "WordCount")
# Sortie : <statut>\t1
import sys, json

for ligne in sys.stdin:
    try:
        doc = json.loads(ligne)
    except json.JSONDecodeError:
        continue
    statut = doc.get("statut_pdc") or "Non renseigné"
    print(f"{statut}\t1")
