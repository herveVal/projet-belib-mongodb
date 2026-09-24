# Projet gestion de données : Belib' (Open Data Paris) avec MongoDB et Hadoop

Analyse de la disponibilité des points de recharge pour véhicules électriques **Belib'** à Paris, à partir du jeu de données Open Data Paris *« Belib' – Points de recharge pour véhicules électriques – Disponibilité temps réel »*.

## Outils

| Outil | Rôle |
|---|---|
| MongoDB 8.3 | Stockage et requêtes (base `belib`) |
| Navicat Premium | Client graphique pour exécuter les requêtes |
| Hadoop / MapReduce (Python) | Traitement distribué *(à venir)* |
| Git / GitHub | Versionnement du projet |

## Structure du dépôt

```
projet-belib-mongodb/
├── data/
│   ├── belib_temps_reel.json            # jeu de données brut (1970 points de charge)
│   └── synthese_arrondissements.json    # export de la synthèse produite au TP3
├── scripts/
│   ├── mongodb/
│   │   ├── tp1_exploration_belib.js
│   │   ├── tp2_nettoyage_belib.js
│   │   └── tp3_agregations_index_geo.js
│   └── hadoop/                          # mapper.py / reducer.py (à venir)
└── README.md
```

## Import des données

```bash
mongoimport --db belib --collection belib_temps_reel --jsonArray --file data/belib_temps_reel.json
```

> Si l'import passe par l'assistant de Navicat, il faut laisser `last_updated` en type **String**. Sinon, Navicat convertit mal les dates au format ISO avec fuseau horaire.

## TP1 : Exploration

Filtres (`find`, `$in`, regex), projections, tri, `distinct` et premières agrégations.

- 1970 points de charge répartis sur environ 400 stations
- Statuts : 1143 disponibles, 734 occupés, 51 en maintenance, 39 inconnus, 3 en mise en service planifiée

## TP2 : Nettoyage et enrichissement

| Étape | Opération | Résultat |
|---|---|---|
| 0 | Sauvegarde (`$out`) | `belib_temps_reel_brut` |
| 1 | Isolement des documents sans adresse ni coordonnées | 12 documents déplacés dans `belib_incomplets`, 1958 restants |
| 2 | Conversion de `last_updated` du texte en date (`$dateFromString`) | 1958 dates |
| 3 | Création d'un champ GeoJSON `location` au format `[lon, lat]` | Prêt pour l'index `2dsphere` |
| 4 | Découpage de `id_pdc` en `id_station` + `num_prise` | 402 stations |
| 5 | Code postal et arrondissement extraits de l'adresse (`$regexFind`) | Le regroupement « Paris centre » est éclaté en 1er, 2e, 3e et 4e |
| 6 | Contrôle de cohérence entre l'arrondissement déclaré et le code postal | 5 incohérences (1 Rue Navier 75017, déclarée dans le 18e) |

## TP3 : Index, recherche géographique et agrégations

- **Index :** avec un index sur `statut_pdc`, la requête passe de `COLLSCAN` (1958 documents lus) à `IXSCAN` (1138 documents lus).
- **Recherche géographique :** la borne disponible la plus proche de la tour Eiffel se trouve au 45 Av. de la Bourdonnais, à 374 m. On compte 36 prises libres dans un rayon de 1 km.
- **Taux de disponibilité par arrondissement :** 4e en tête (77 %), 1er en dernier (37 %).
- 31 stations n'ont aucune prise disponible.
- Une vue `v_stations` a été créée, et une collection `synthese_arrondissements` a été générée avec `$out`.

## Suite du projet

- [ ] Export des données vers HDFS
- [ ] MapReduce en Python (Hadoop Streaming) : agrégations par arrondissement et par station
- [ ] Comparaison des résultats MongoDB et Hadoop

## Source

Données : [Paris Data – Belib'](https://opendata.paris.fr/), sous Licence ODbL.
