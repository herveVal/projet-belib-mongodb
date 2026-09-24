#!/usr/bin/env python3
# =====================================================================
# REDUCER - Taux de disponibilité par arrondissement
# Entrée  : lignes <arrondissement>\t<0|1>, TRIÉES par clé (fait par Hadoop)
# Sortie  : <arrondissement>\t<nb_points>\t<nb_dispo>\t<taux_dispo_%>
# =====================================================================
import sys

cle_courante = None
nb_points = 0
nb_dispo = 0

def emettre(cle, total, dispo):
    taux = round(100 * dispo / total, 1) if total else 0
    print(f"{cle}\t{total}\t{dispo}\t{taux}")

for ligne in sys.stdin:
    cle, valeur = ligne.rstrip("\n").split("\t")
    if cle != cle_courante:
        if cle_courante is not None:
            emettre(cle_courante, nb_points, nb_dispo)   # nouvelle clé : on sort la précédente
        cle_courante, nb_points, nb_dispo = cle, 0, 0
    nb_points += 1
    nb_dispo += int(valeur)

if cle_courante is not None:
    emettre(cle_courante, nb_points, nb_dispo)
