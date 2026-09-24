# Projet gestion de données : Belib' (Open Data Paris) avec MongoDB et Hadoop

Analyse de la disponibilité des points de recharge pour véhicules électriques **Belib'** à Paris, à partir du jeu de données Open Data Paris *« Belib' – Points de recharge pour véhicules électriques – Disponibilité temps réel »*.

## Outils

| Outil | Rôle |
|---|---|
| MongoDB 8.3 | Stockage et requêtes (base `belib`) |
| Navicat Premium | Client graphique pour exécuter les requêtes |
| Hadoop 3.4.1 (Docker) | HDFS + YARN, MapReduce en Python (Hadoop Streaming) |
| Git / GitHub | Versionnement du projet |

## Structure du dépôt

```
projet-belib-mongodb/
├── data/
│   ├── belib_temps_reel.json            # jeu de données brut (1970 points de charge)
│   ├── synthese_arrondissements.json    # export de la synthèse produite au TP3
│   ├── belib_clean.jsonl                # données nettoyées, 1 document JSON par ligne (entrée MapReduce)
│   ├── resultat_dispo_hadoop.tsv        # résultat du job MapReduce Python (TP4)
│   ├── paniers_stations.txt             # 1 ligne = 1 station = statuts de ses prises (TP5)
│   └── resultat_cooccurrence_java.tsv   # résultat du job MapReduce Java (TP5)
├── docker/                              # cluster Hadoop pseudo-distribué (Dockerfile, docker-compose, conf XML)
├── scripts/
│   ├── mongodb/
│   │   ├── tp1_exploration_belib.js
│   │   ├── tp2_nettoyage_belib.js
│   │   └── tp3_agregations_index_geo.js
│   └── hadoop/                          # mappers / reducers Python (TP4), guides TP4 et TP5
│       └── java/                        # original/ (code de cours) et belib/ (version adaptée)
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

## TP4 : HDFS et MapReduce en Python

**Démarrer le cluster :** `cd docker`, puis `docker compose up -d --build`. L'interface HDFS est sur http://localhost:9870 et l'interface YARN sur http://localhost:8088.

| Étape | Commande clé | Résultat |
|---|---|---|
| Export des données | `mongoexport` sans `--jsonArray` | 1958 lignes dans `belib_clean.jsonl` |
| Chargement dans HDFS | `hdfs dfs -put` | `/belib/input/belib_clean.jsonl` (1,6 Mo) |
| Test local | `cat \| mapper \| sort \| reducer` | 20 arrondissements |
| Job 1 : taux de disponibilité par arrondissement | `mapred streaming` | Résultats identiques à MongoDB (TP3) |
| Job 2 : points par statut (équivalent du WordCount) | `mapred streaming` | Disponible 1138, Occupé 734, Maintenance 49, Inconnu 37 |

**Conclusion :** MongoDB, le pipeline local et Hadoop donnent exactement les mêmes résultats. Sur un volume aussi petit (1,6 Mo), MongoDB répond en quelques millisecondes, alors qu'un job Hadoop prend environ 25 s à cause du lancement des conteneurs YARN. Hadoop devient intéressant quand les données dépassent la capacité d'une seule machine (de l'ordre du To) : le traitement est alors distribué et tolérant aux pannes.

## TP5 : MapReduce en Java, co-occurrence des statuts par station

Il s'agit de l'adaptation d'un job classique « produits achetés ensemble » (`java/original/`) aux données Belib' (`java/belib/`). Chaque ligne d'entrée représente une station, avec la liste des statuts de ses prises. Pour chaque statut, le job compte les statuts des **autres prises de la même station**.

**Corrections apportées au code d'origine :**
- le mapper émet les deux sens (`j != i`), ce qui rend la relation symétrique ;
- les chemins sont passés en arguments ;
- le driver utilise `getConf()` et déclare les classes de sortie ;
- un seul reducer produit un seul fichier de sortie ;
- le reducer utilise un `StringBuilder` et affiche les compteurs.

```
javac -cp "$(hadoop classpath)" -d classes belib/*.java && jar cf cooc-belib.jar -C classes .
hadoop jar cooc-belib.jar CoocDriver /belib/cooc/input /belib/cooc/output
```

| Statut d'une prise | Statuts des autres prises de la station |
|---|---|
| Disponible | Disponible 3096, Occupé 1541, En maintenance 119, Inconnu 10 |
| En maintenance | Disponible 119, Occupé 69, En maintenance 18 |
| Inconnu | **Inconnu 114**, Disponible 10, Occupé 6 |
| Occupé (en charge) | Occupé 1602, Disponible 1541, En maintenance 69, Inconnu 6 |

**Interprétation :**
- **Statut Inconnu :** quand une prise est *Inconnu*, 88 % des autres prises de la même station le sont aussi. Les pertes de communication touchent donc **des stations entières**.
- **Maintenance :** les autres prises restent majoritairement en service. Les pannes matérielles sont donc **isolées**, prise par prise.

## Suite du projet

- [ ] Jobs plus avancés : top stations, analyse de la fraîcheur des données
- [ ] Visualisation des résultats

## Source

Données : [Paris Data – Belib'](https://opendata.paris.fr/), sous Licence ODbL.
