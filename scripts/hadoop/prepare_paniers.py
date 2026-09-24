#!/usr/bin/env python3
# =====================================================================
# Préparation des "paniers" pour le job Java de co-occurrence (TP5)
# belib_clean.jsonl (1 ligne = 1 prise)  ->  paniers_stations.txt (1 ligne = 1 station)
# Chaque ligne contient les statuts des prises de la station, séparés par des virgules.
# Usage : python3 prepare_paniers.py /projet/data/belib_clean.jsonl /projet/data/paniers_stations.txt
# =====================================================================
import sys
import json
from collections import defaultdict

entree = sys.argv[1] if len(sys.argv) > 1 else "/projet/data/belib_clean.jsonl"
sortie = sys.argv[2] if len(sys.argv) > 2 else "/projet/data/paniers_stations.txt"

stations = defaultdict(list)
with open(entree, encoding="utf-8") as f:
    for ligne in f:
        doc = json.loads(ligne)
        # id_station calculé au TP2 ; sinon on le déduit de id_pdc (on retire le n° de prise)
        id_station = doc.get("id_station") or doc["id_pdc"].rsplit("*", 1)[0]
        stations[id_station].append(doc["statut_pdc"])

with open(sortie, "w", encoding="utf-8") as f:
    for id_station in sorted(stations):
        f.write(",".join(stations[id_station]) + "\n")

print(f"{len(stations)} stations écrites dans {sortie}")
