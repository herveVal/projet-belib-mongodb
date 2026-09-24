# TP4 : HDFS et MapReduce en Python (Hadoop Streaming)

Ce TP calcule le **taux de disponibilité des bornes par arrondissement** avec Hadoop, puis compare le résultat avec celui obtenu dans MongoDB au TP3 (collection `synthese_arrondissements`).

## Étape 0 : exporter les données nettoyées depuis MongoDB (sous Windows)

MapReduce lit les fichiers **ligne par ligne**. On exporte donc un document JSON par ligne, sans l'option `--jsonArray` :

```
mongoexport --db belib --collection belib_temps_reel --out "C:\Users\herve\Documents\projet-belib-mongodb\data\belib_clean.jsonl"
```
Résultat attendu : `exported 1958 records`.

## Étape 1 : entrer dans le conteneur Hadoop

```
docker exec -it hadoop bash
```
Le dossier du projet est visible dans le conteneur, sous `/projet`.

## Étape 2 : manipuler HDFS

```bash
hdfs dfs -mkdir -p /belib/input                             # créer un dossier dans HDFS
hdfs dfs -put -f /projet/data/belib_clean.jsonl /belib/input/   # copier le fichier local dans HDFS
hdfs dfs -ls /belib/input                                   # lister le contenu du dossier
hdfs dfs -du -h /belib/input                                # afficher la taille occupée
hdfs dfs -cat /belib/input/belib_clean.jsonl | head -2      # afficher les 2 premières lignes
```
Tu peux aussi parcourir HDFS dans le navigateur : http://localhost:9870, menu **Utilities**, puis **Browse the file system**.

## Étape 3 : tester le MapReduce en local (sans Hadoop)

Cette commande reproduit en local les trois phases **map**, **shuffle/sort** et **reduce** :
```bash
cd /projet/scripts/hadoop
cat /projet/data/belib_clean.jsonl | python3 mapper_dispo_arrondissement.py | sort | python3 reducer_dispo_arrondissement.py
```
On obtient 20 lignes, au format `arrondissement  nb_points  nb_dispo  taux_%`. Voici les premières :
```
01  30  11  36.7
02  41  17  41.5
03  22  11  50.0
04  66  51  77.3
```

## Étape 4 : lancer le job sur le cluster Hadoop

```bash
hdfs dfs -rm -r -f /belib/output_dispo      # Hadoop refuse d'écrire dans un dossier existant

mapred streaming \
  -files mapper_dispo_arrondissement.py,reducer_dispo_arrondissement.py \
  -mapper "python3 mapper_dispo_arrondissement.py" \
  -reducer "python3 reducer_dispo_arrondissement.py" \
  -input /belib/input/belib_clean.jsonl \
  -output /belib/output_dispo
```
Tu peux suivre le job en direct sur http://localhost:8088.

## Étape 5 : lire et récupérer le résultat

```bash
hdfs dfs -ls /belib/output_dispo                  # doit contenir _SUCCESS et part-00000
hdfs dfs -cat /belib/output_dispo/part-00000
hdfs dfs -get -f /belib/output_dispo/part-00000 /projet/data/resultat_dispo_hadoop.tsv
```
Le fichier `resultat_dispo_hadoop.tsv` apparaît alors dans le dossier `data` du projet, sous Windows.

## Étape 6 : second job, le nombre de points par statut

C'est l'équivalent Belib' du « WordCount », l'exemple classique de MapReduce :
```bash
hdfs dfs -rm -r -f /belib/output_statut
mapred streaming \
  -files mapper_statut.py,reducer_somme.py \
  -mapper "python3 mapper_statut.py" \
  -reducer "python3 reducer_somme.py" \
  -input /belib/input/belib_clean.jsonl \
  -output /belib/output_statut
hdfs dfs -cat /belib/output_statut/part-00000
```
Résultat attendu : Disponible 1138, En maintenance 49, Inconnu 37, Occupé (en charge) 734.

## Questions pour le rapport

1. Les résultats de Hadoop sont-ils identiques à ceux de MongoDB (`synthese_arrondissements`) ?
2. Quel est le rôle de l'étape `sort` dans le test local ? Qu'est-ce qui la remplace sur le cluster ?
3. Pourquoi le reducer n'a-t-il besoin de garder qu'**une seule clé à la fois** en mémoire ?
4. Pour 2 000 lignes, MongoDB répond en quelques millisecondes, alors que Hadoop met environ 30 secondes. À partir de quel volume de données Hadoop devient-il intéressant ?
