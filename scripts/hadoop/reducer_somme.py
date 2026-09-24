#!/usr/bin/env python3
# REDUCER générique - Somme des valeurs par clé
# Entrée : <clé>\t<nombre>, triées par clé   |   Sortie : <clé>\t<total>
import sys

cle_courante, total = None, 0
for ligne in sys.stdin:
    cle, valeur = ligne.rstrip("\n").split("\t")
    if cle != cle_courante:
        if cle_courante is not None:
            print(f"{cle_courante}\t{total}")
        cle_courante, total = cle, 0
    total += int(valeur)
if cle_courante is not None:
    print(f"{cle_courante}\t{total}")
