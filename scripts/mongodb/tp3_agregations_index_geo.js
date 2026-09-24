// =====================================================================
// TP3 - Agrégations avancées, index et recherche géographique
// Base : belib   |   Collection : belib_temps_reel (nettoyée au TP2)
// Exécuter les blocs UN PAR UN (sélection + Run Selected dans Navicat)
// =====================================================================

use("belib");

// =====================================================================
// PARTIE A - INDEX ET PERFORMANCES
// =====================================================================

// A1. Plan d'exécution SANS index : MongoDB lit toute la collection
db.belib_temps_reel.find({ statut_pdc: "Disponible" }).explain("executionStats");
// -> Regarder : winningPlan.stage = "COLLSCAN"
//              executionStats.totalDocsExamined = 1958

// A2. Création d'un index sur le statut
db.belib_temps_reel.createIndex({ statut_pdc: 1 });

// A3. Même requête AVEC index
db.belib_temps_reel.find({ statut_pdc: "Disponible" }).explain("executionStats");
// -> winningPlan : "IXSCAN" (via FETCH)
//    totalDocsExamined = 1143 : MongoDB ne lit plus que les documents utiles

// A4. Index composé : utile pour "statut + arrondissement"
db.belib_temps_reel.createIndex({ arrondissement_num: 1, statut_pdc: 1 });

// A5. Lister les index de la collection
db.belib_temps_reel.getIndexes();


// =====================================================================
// PARTIE B - RECHERCHE GÉOGRAPHIQUE
// =====================================================================

// B1. Index géospatial sur le champ GeoJSON créé au TP2
db.belib_temps_reel.createIndex({ location: "2dsphere" });

// B2. Les 5 bornes DISPONIBLES les plus proches de la tour Eiffel
//     Tour Eiffel : longitude 2.2945, latitude 48.8584 (ordre GeoJSON : [lon, lat])
db.belib_temps_reel.find(
  {
    statut_pdc: "Disponible",
    location: {
      $near: {
        $geometry: { type: "Point", coordinates: [2.2945, 48.8584] },
        $maxDistance: 1000            // en mètres
      }
    }
  },
  { _id: 0, id_pdc: 1, adresse_station: 1 }
).limit(5);
// -> Attendu : 4 prises au 45 Av. de la Bourdonnais (~374 m), puis 10 Rue de la Fédération (~499 m)

// B3. Même chose avec $geoNear : on obtient la DISTANCE en plus
//     ($geoNear doit être la première étape du pipeline)
db.belib_temps_reel.aggregate([
  { $geoNear: {
      near: { type: "Point", coordinates: [2.2945, 48.8584] },
      distanceField: "distance_m",
      maxDistance: 1000,
      query: { statut_pdc: "Disponible" }
  } },
  { $project: { _id: 0, id_pdc: 1, adresse_station: 1, distance_m: { $round: ["$distance_m", 0] } } },
  { $limit: 10 }
]);

// B4. Combien de prises disponibles à moins de 1 km de la tour Eiffel ?
db.belib_temps_reel.countDocuments({
  statut_pdc: "Disponible",
  location: { $geoWithin: { $centerSphere: [[2.2945, 48.8584], 1 / 6378.1] } }   // 1 km / rayon Terre
});
// -> Attendu : 36


// =====================================================================
// PARTIE C - AGRÉGATIONS AVANCÉES
// =====================================================================

// C1. Taux de disponibilité par arrondissement ($cond dans un $group)
db.belib_temps_reel.aggregate([
  { $group: {
      _id: "$arrondissement_num",
      nb_points: { $sum: 1 },
      nb_dispo:  { $sum: { $cond: [{ $eq: ["$statut_pdc", "Disponible"] }, 1, 0] } }
  } },
  { $project: {
      _id: 0, arrondissement: "$_id", nb_points: 1, nb_dispo: 1,
      taux_dispo: { $round: [{ $multiply: [{ $divide: ["$nb_dispo", "$nb_points"] }, 100] }, 1] }
  } },
  { $sort: { taux_dispo: -1 } }
]);
// -> Attendu : 4e en tête (77.3 %), 1er en dernier (36.7 %)

// C2. Vue "par station" : on passe de 1958 prises à 402 stations
db.belib_temps_reel.aggregate([
  { $group: {
      _id: "$id_station",
      adresse: { $first: "$adresse_station" },
      arrondissement: { $first: "$arrondissement_num" },
      location: { $first: "$location" },
      nb_prises: { $sum: 1 },
      nb_dispo: { $sum: { $cond: [{ $eq: ["$statut_pdc", "Disponible"] }, 1, 0] } },
      statuts: { $addToSet: "$statut_pdc" }
  } },
  { $sort: { nb_prises: -1 } },
  { $limit: 10 }
]);

// C3. Stations où AUCUNE prise n'est disponible
db.belib_temps_reel.aggregate([
  { $group: {
      _id: "$id_station",
      adresse: { $first: "$adresse_station" },
      nb_prises: { $sum: 1 },
      nb_dispo: { $sum: { $cond: [{ $eq: ["$statut_pdc", "Disponible"] }, 1, 0] } }
  } },
  { $match: { nb_dispo: 0 } },
  { $count: "stations_sans_prise_dispo" }
]);
// -> Attendu : 31

// C4. Répartition des stations par nombre de prises ($bucket)
db.belib_temps_reel.aggregate([
  { $group: { _id: "$id_station", nb_prises: { $sum: 1 } } },
  { $bucket: {
      groupBy: "$nb_prises",
      boundaries: [1, 3, 5, 7, 8],
      default: "autre",
      output: { nb_stations: { $sum: 1 } }
  } }
]);
// -> [1-3[ : 2   [3-5[ : 157   [5-7[ : 206   [7-8[ : 37

// C5. Fraîcheur des données : points non mis à jour depuis plus de 7 jours
//     (date de référence = date de l'extraction du jeu de données)
db.belib_temps_reel.aggregate([
  { $project: {
      _id: 0, id_pdc: 1, statut_pdc: 1, last_updated: 1,
      jours_sans_maj: { $dateDiff: {
          startDate: "$last_updated",
          endDate: ISODate("2026-09-23T09:00:00Z"),
          unit: "day"
      } }
  } },
  { $match: { jours_sans_maj: { $gt: 7 } } },
  { $sort: { jours_sans_maj: -1 } }
]);
// -> Environ 64 points : à croiser avec leur statut (maintenance ? inconnu ?)

// C6. Même question, résumée par statut
db.belib_temps_reel.aggregate([
  { $match: { last_updated: { $lt: ISODate("2026-09-16T09:00:00Z") } } },
  { $group: { _id: "$statut_pdc", nb: { $sum: 1 } } },
  { $sort: { nb: -1 } }
]);


// =====================================================================
// PARTIE D - SAUVEGARDER LES RÉSULTATS
// =====================================================================

// D1. Créer une VUE (apparaît dans Navicat > belib > Views)
//     Une vue est recalculée à chaque lecture : pas de données dupliquées.
db.createView("v_stations", "belib_temps_reel", [
  { $group: {
      _id: "$id_station",
      adresse: { $first: "$adresse_station" },
      arrondissement: { $first: "$arrondissement_num" },
      nb_prises: { $sum: 1 },
      nb_dispo: { $sum: { $cond: [{ $eq: ["$statut_pdc", "Disponible"] }, 1, 0] } }
  } }
]);
db.v_stations.find().sort({ nb_dispo: -1 }).limit(5);

// D2. Matérialiser la synthèse par arrondissement dans une collection ($out)
//     -> c'est ce fichier qu'on exportera pour Hadoop / GitHub
db.belib_temps_reel.aggregate([
  { $group: {
      _id: "$arrondissement_num",
      nb_points: { $sum: 1 },
      nb_stations: { $addToSet: "$id_station" },
      nb_dispo: { $sum: { $cond: [{ $eq: ["$statut_pdc", "Disponible"] }, 1, 0] } },
      nb_occupe: { $sum: { $cond: [{ $eq: ["$statut_pdc", "Occupé (en charge)"] }, 1, 0] } },
      nb_hors_service: { $sum: { $cond: [{ $in: ["$statut_pdc", ["En maintenance", "Inconnu"]] }, 1, 0] } }
  } },
  { $set: { nb_stations: { $size: "$nb_stations" } } },
  { $sort: { _id: 1 } },
  { $out: "synthese_arrondissements" }
]);
db.synthese_arrondissements.find();                     // 20 documents
