#!/usr/bin/env python3
# =====================================================================
# Carte interactive des stations Belib' (Paris)
# Entrée : data/belib_clean.jsonl (export mongoexport des données nettoyées, TP2)
# Sortie : carte/carte_stations.html (à ouvrir dans un navigateur)
#
# Usage (depuis la racine du projet) :
#   pip install folium
#   python scripts/visualisation/carte_stations.py
# =====================================================================
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

import folium

RACINE = Path(__file__).resolve().parents[2]
ENTREE = Path(sys.argv[1]) if len(sys.argv) > 1 else RACINE / "data" / "belib_clean.jsonl"
SORTIE = Path(sys.argv[2]) if len(sys.argv) > 2 else RACINE / "carte" / "carte_stations.html"

TOUR_EIFFEL = (48.8584, 2.2945)   # (lat, lon)
RAYON_M = 1000

# Couleurs d'état (palette "status" : chaque couleur est toujours accompagnée d'un libellé)
ETATS = {
    "dispo":   {"libelle": "Au moins une prise disponible", "couleur": "#0ca30c"},
    "complet": {"libelle": "Complète (toutes occupées)",    "couleur": "#fab219"},
    "hs":      {"libelle": "Hors service (maintenance)",    "couleur": "#d03b3b"},
    "inconnu": {"libelle": "Injoignable (statut inconnu)",  "couleur": "#8a8a86"},
}


def distance_m(lat1, lon1, lat2, lon2):
    """Distance à vol d'oiseau (formule de haversine), en mètres."""
    r = 6378100
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


# ---------------------------------------------------------------------
# 1. Regrouper les prises par station (même logique que le $group du TP3)
# ---------------------------------------------------------------------
stations = defaultdict(lambda: {"statuts": []})
with open(ENTREE, encoding="utf-8") as f:
    for ligne in f:
        doc = json.loads(ligne)
        coords = doc.get("coordonneesxy")
        if not coords:
            continue
        sid = doc.get("id_station") or doc["id_pdc"].rsplit("*", 1)[0]
        st = stations[sid]
        st["adresse"] = doc.get("adresse_station")
        st["arrondissement"] = doc.get("arrondissement_num")
        st["lat"], st["lon"] = coords["lat"], coords["lon"]
        st["statuts"].append(doc["statut_pdc"])


def etat_station(statuts):
    if all(s == "Inconnu" for s in statuts):
        return "inconnu"
    if "Disponible" in statuts:
        return "dispo"
    if "Occupé (en charge)" in statuts:
        return "complet"
    return "hs"


# ---------------------------------------------------------------------
# 2. Construire la carte
# ---------------------------------------------------------------------
carte = folium.Map(location=[48.8566, 2.3522], zoom_start=12, tiles="OpenStreetMap",
                   control_scale=True)

groupes = {k: folium.FeatureGroup(name=f"{v['libelle']}", show=True) for k, v in ETATS.items()}
compteurs = defaultdict(int)

for sid, st in sorted(stations.items()):
    etat = etat_station(st["statuts"])
    compteurs[etat] += 1
    nb = len(st["statuts"])
    nb_dispo = st["statuts"].count("Disponible")
    detail = "<br>".join(f"{s} : {st['statuts'].count(s)}" for s in sorted(set(st["statuts"])))
    popup = (f"<b>{st['adresse']}</b><br>"
             f"Arrondissement : {st['arrondissement']}<br>"
             f"Station : {sid}<br>"
             f"<b>{nb_dispo} / {nb} prises disponibles</b><br>"
             f"<i>{ETATS[etat]['libelle']}</i><hr style='margin:4px 0'>{detail}")
    folium.CircleMarker(
        location=[st["lat"], st["lon"]],
        radius=5 + nb,                         # taille = nombre de prises
        color="#ffffff", weight=2,             # anneau blanc pour séparer les points proches
        fill=True, fill_color=ETATS[etat]["couleur"], fill_opacity=0.9,
        tooltip=f"{st['adresse']} - {nb_dispo}/{nb} dispo",
        popup=folium.Popup(popup, max_width=300),
    ).add_to(groupes[etat])

for g in groupes.values():
    g.add_to(carte)

# ---------------------------------------------------------------------
# 3. Reproduire la requête géographique du TP3 : bornes dispo à < 1 km de la tour Eiffel
# ---------------------------------------------------------------------
geo = folium.FeatureGroup(name="TP3 : bornes disponibles à moins de 1 km de la tour Eiffel", show=True)
folium.Circle(TOUR_EIFFEL, radius=RAYON_M, color="#2a5bd7", weight=2, fill=True,
              fill_opacity=0.05, dash_array="6 6").add_to(geo)
folium.Marker(TOUR_EIFFEL, tooltip="Tour Eiffel",
              icon=folium.Icon(color="blue", icon="star")).add_to(geo)

proches = []
for sid, st in stations.items():
    d = distance_m(*TOUR_EIFFEL, st["lat"], st["lon"])
    n = st["statuts"].count("Disponible")
    if d <= RAYON_M and n:
        proches.append((d, st, n))
proches.sort(key=lambda x: x[0])
for d, st, n in proches:
    folium.PolyLine([TOUR_EIFFEL, (st["lat"], st["lon"])], color="#2a5bd7", weight=2,
                    opacity=0.6, tooltip=f"{st['adresse']} : {round(d)} m, {n} prise(s) libre(s)").add_to(geo)
geo.add_to(carte)

# ---------------------------------------------------------------------
# 4. Légende (couleur + libellé + effectif) et contrôle des couches
# ---------------------------------------------------------------------
lignes = "".join(
    f"<div style='margin:3px 0'><span style='display:inline-block;width:12px;height:12px;"
    f"border-radius:50%;background:{v['couleur']};border:2px solid #fff;box-shadow:0 0 0 1px #999;"
    f"vertical-align:middle;margin-right:6px'></span>{v['libelle']} : <b>{compteurs[k]}</b></div>"
    for k, v in ETATS.items())
legende = f"""
<div style="position:fixed;bottom:24px;left:24px;z-index:9999;background:#fff;padding:10px 14px;
     border-radius:8px;box-shadow:0 1px 6px rgba(0,0,0,.25);font:13px/1.35 sans-serif;color:#222">
  <div style="font-weight:600;margin-bottom:4px">Stations Belib' ({len(stations)})</div>
  {lignes}
  <div style="margin-top:6px;color:#555">Taille du cercle = nombre de prises<br>
  Trait bleu = borne libre à &lt; 1 km de la tour Eiffel ({len(proches)} stations)</div>
</div>"""
carte.get_root().html.add_child(folium.Element(legende))
folium.LayerControl(collapsed=False).add_to(carte)

SORTIE.parent.mkdir(parents=True, exist_ok=True)
carte.save(SORTIE)
print(f"{len(stations)} stations -> {SORTIE}")
for k, v in ETATS.items():
    print(f"  {v['libelle']:<35} {compteurs[k]}")
print(f"  Stations avec prise libre à < 1 km de la tour Eiffel : {len(proches)}")

# ---------------------------------------------------------------------
# 5. Version image (PNG) pour l'afficher directement dans le README GitHub
#    (GitHub n'exécute pas le HTML interactif : on ajoute donc une image fixe)
# ---------------------------------------------------------------------
try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(12.5, 7.5), dpi=150)
    for k, v in ETATS.items():
        pts = [st for st in stations.values() if etat_station(st["statuts"]) == k]
        if not pts:
            continue
        ax.scatter([s["lon"] for s in pts], [s["lat"] for s in pts],
                   s=[12 + 6 * len(s["statuts"]) for s in pts], c=v["couleur"],
                   edgecolors="white", linewidths=0.8, label=f"{v['libelle']} ({len(pts)})",
                   zorder=3 if k != "dispo" else 2)
    # cercle de 1 km autour de la tour Eiffel (approximation locale en degrés)
    dlat = RAYON_M / 111_320
    dlon = RAYON_M / (111_320 * math.cos(math.radians(TOUR_EIFFEL[0])))
    angles = [i * 2 * math.pi / 100 for i in range(101)]
    ax.plot([TOUR_EIFFEL[1] + dlon * math.cos(a) for a in angles],
            [TOUR_EIFFEL[0] + dlat * math.sin(a) for a in angles],
            color="#2a5bd7", lw=1.5, ls="--", zorder=4)
    ax.scatter([TOUR_EIFFEL[1]], [TOUR_EIFFEL[0]], marker="*", s=220, c="#2a5bd7",
               edgecolors="white", zorder=5, label="Tour Eiffel (rayon 1 km)")
    ax.set_aspect(1 / math.cos(math.radians(48.8566)))   # évite de déformer Paris
    ax.set_title(f"Stations Belib' à Paris : état des {len(stations)} stations", fontsize=13, loc="left")
    ax.set_xlabel("Longitude"); ax.set_ylabel("Latitude")
    ax.grid(color="#e6e6e6", lw=0.6); ax.set_axisbelow(True)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.legend(loc="upper left", bbox_to_anchor=(1.01, 1), frameon=False, fontsize=9, title="Taille = nombre de prises",
              title_fontsize=8)
    png = SORTIE.with_suffix(".png")
    fig.tight_layout(); fig.savefig(png); plt.close(fig)
    print(f"Image -> {png}")
except ImportError:
    print("matplotlib absent : image PNG non générée (pip install matplotlib)")
