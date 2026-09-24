# TP5 : MapReduce en Java, co-occurrence des statuts par station

## L'idée : du panier de courses à la station Belib'

Les fichiers Java d'origine (`java/original/MonMapper.java`, `MonReducer.java` et `MonDriver.java`) implémentent l'algorithme classique **« produits achetés ensemble »** :

| Code d'origine (panier de courses) | Adaptation Belib' |
|---|---|
| 1 ligne = 1 panier = `salade,patate,lait` | 1 ligne = 1 station = `Disponible,Occupé (en charge),Inconnu` |
| Clé = un produit | Clé = le statut d'une prise |
| Valeur = un autre produit du même panier | Valeur = le statut d'une **autre prise de la même station** |
| Résultat : « avec la salade, on achète surtout des patates » | Résultat : « quand une prise est *Inconnu*, les autres prises de la station sont surtout *Inconnu* aussi » |

**La question métier :** les pannes sont-elles isolées (une seule prise touchée) ou affectent-elles des stations entières (coupure de communication, par exemple) ?

## Les corrections apportées au code d'origine (dossier `java/belib/`)

| Problème dans l'original | Correction |
|---|---|
| Le mapper n'émet que les couples `j > i` : le résultat dépend de l'ordre des éléments dans la ligne, et le dernier élément n'a jamais de « voisins » | On émet les deux sens (`j != i`) : la relation devient symétrique |
| Pas de `trim()`, ni de gestion des lignes vides | Ajoutés |
| Chemins `/mpmr/input` codés en dur | Chemins passés en arguments, avec des valeurs par défaut |
| `Job.getInstance()` ignore la configuration de `ToolRunner` | `Job.getInstance(getConf(), ...)` |
| `setOutputKeyClass` et `setOutputValueClass` absents | Ajoutés |
| 3 reducers, donc 3 fichiers de sortie à fusionner | 1 reducer, donc un seul fichier `part-r-00000` |
| Concaténation de chaînes avec `+=` dans une boucle | Utilisation d'un `StringBuilder`, et ajout des compteurs dans la sortie |

## Étape 1 : préparer les paniers (1 ligne = 1 station)

Dans le conteneur (`docker exec -it hadoop bash`) :
```bash
cd /projet/scripts/hadoop
python3 prepare_paniers.py /projet/data/belib_clean.jsonl /projet/data/paniers_stations.txt
head -3 /projet/data/paniers_stations.txt
```
Résultat attendu : `402 stations écrites`.

## Étape 2 : compiler le code Java et créer le fichier .jar

```bash
cd /projet/scripts/hadoop/java
mkdir -p classes
javac -cp "$(hadoop classpath)" -d classes belib/*.java
jar cf cooc-belib.jar -C classes .
ls -lh cooc-belib.jar
```
`hadoop classpath` fournit à `javac` toutes les bibliothèques Hadoop (`Mapper`, `Reducer`, `Job`, etc.).

## Étape 3 : charger les paniers dans HDFS et lancer le job

```bash
hdfs dfs -mkdir -p /belib/cooc/input
hdfs dfs -put -f /projet/data/paniers_stations.txt /belib/cooc/input/
hdfs dfs -rm -r -f /belib/cooc/output
hadoop jar cooc-belib.jar CoocDriver /belib/cooc/input /belib/cooc/output
```

## Étape 4 : lire le résultat

```bash
hdfs dfs -cat /belib/cooc/output/part-r-00000
hdfs dfs -get -f /belib/cooc/output/part-r-00000 /projet/data/resultat_cooccurrence_java.tsv
```
Résultat attendu :
```
Disponible          Disponible:3096,Occupé (en charge):1541,En maintenance:119,Inconnu:10
En maintenance      Disponible:119,Occupé (en charge):69,En maintenance:18
Inconnu             Inconnu:114,Disponible:10,Occupé (en charge):6
Occupé (en charge)  Occupé (en charge):1602,Disponible:1541,En maintenance:69,Inconnu:6
```

## Interprétation

- **Inconnu :** dans 88 % des cas (114 sur 130), les autres prises de la station sont elles aussi *Inconnu*. Les pertes de communication touchent donc **des stations entières**.
- **En maintenance :** les autres prises sont surtout *Disponible* ou *Occupé*. Les pannes matérielles sont **isolées**, prise par prise.
- **Disponible et Occupé** cohabitent souvent : les stations sont en fonctionnement normal.

## Bonus : pourquoi la correction `j != i` est importante

Avec le mapper d'origine (`j > i`), on obtient `Disponible → Occupé : 773` mais `Occupé → Disponible : 768`. Ces deux valeurs devraient être égales, et leur écart dépend uniquement de l'ordre des prises dans la ligne. La version corrigée donne 1541 dans les deux sens.

## Questions pour le rapport

1. Quelles différences voyez-vous entre MapReduce en Java (`Mapper`/`Reducer` typés, fichier `.jar`) et en Python (Hadoop Streaming) ?
2. Pourquoi le reducer a-t-il besoin d'une `HashMap` ici, alors que ce n'était pas le cas au TP4 ?
3. Que se passerait-il avec `setNumReduceTasks(3)` ? Où seraient les résultats ?
