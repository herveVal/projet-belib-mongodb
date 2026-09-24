#!/usr/bin/env python3
# =====================================================================
# MAPPER - Taux de disponibilité par arrondissement
# Entrée  : 1 document JSON par ligne (export mongoexport de belib_temps_reel)
# Sortie  : <arrondissement>\t<1 si Disponible sinon 0>
# =====================================================================
import sys
import json
import re

for ligne in sys.stdin:
    ligne = ligne.strip()
    if not ligne:
        continue
    try:
        doc = json.loads(ligne)
    except json.JSONDecodeError:
        continue  # ligne illisible : on l'ignore

    arr = doc.get("arrondissement_num")
    if arr is None:
        # Plan B : extraire le code postal 750xx de l'adresse
        m = re.search(r"750(\d\d)", doc.get("adresse_station") or "")
        if not m:
            continue
        arr = int(m.group(1))

    dispo = 1 if doc.get("statut_pdc") == "Disponible" else 0
    # Clé sur 2 chiffres pour que le tri de Hadoop donne 01, 02, ... 20
    print(f"{int(arr):02d}\t{dispo}")
