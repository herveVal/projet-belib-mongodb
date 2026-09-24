// =====================================================================
// TP2 - Nettoyage et enrichissement des données Belib'
// Base : belib   |   Collection : belib_temps_reel
// Exécuter les blocs UN PAR UN (sélection + Run Selected dans Navicat)
// Nécessite MongoDB 4.2+ (updates avec pipeline, $regexFind)
// =====================================================================

use("belib");

// ---------------------------------------------------------------------
// ÉTAPE 0 - Sauvegarde avant de modifier quoi que ce soit
// ---------------------------------------------------------------------
// $out copie toute la collection dans une nouvelle collection "brute".
// En cas d'erreur, on pourra repartir de cette copie.
db.belib_temps_reel.aggregate([
  { $match: {} },
  { $out: "belib_temps_reel_brut" }
]);
db.belib_temps_reel_brut.countDocuments();              // attendu : 1970


// ---------------------------------------------------------------------
// ÉTAPE 1 - Isoler les 12 documents incomplets
// ---------------------------------------------------------------------
// 1a. Les observer
db.belib_temps_reel.find(
  { adresse_station: null },
  { _id: 0, id_pdc: 1, statut_pdc: 1, last_updated: 1 }
);

// 1b. Les copier dans une collection à part (on ne perd rien)
db.belib_temps_reel.aggregate([
  { $match: { adresse_station: null } },
  { $out: "belib_incomplets" }
]);
db.belib_incomplets.countDocuments();                   // attendu : 12

// 1c. Les retirer de la collection de travail
db.belib_temps_reel.deleteMany({ adresse_station: null });
db.belib_temps_reel.countDocuments();                   // attendu : 1958


// ---------------------------------------------------------------------
// ÉTAPE 2 - Convertir last_updated (texte) en vraie date
// ---------------------------------------------------------------------
// Le filtre $type: "string" rend l'opération rejouable sans erreur.
db.belib_temps_reel.updateMany(
  { last_updated: { $type: "string" } },
  [ { $set: { last_updated: { $dateFromString: { dateString: "$last_updated" } } } } ]
);

// Vérification : plus aucun texte, 1958 dates
db.belib_temps_reel.countDocuments({ last_updated: { $type: "string" } });  // 0
db.belib_temps_reel.countDocuments({ last_updated: { $type: "date" } });    // 1958

// Maintenant les filtres par date fonctionnent :
db.belib_temps_reel.countDocuments({ last_updated: { $lt: ISODate("2026-09-01") } });  // ~38 points non mis à jour depuis début septembre


// ---------------------------------------------------------------------
// ÉTAPE 3 - Créer un champ GeoJSON "location" pour les requêtes géo
// ---------------------------------------------------------------------
// Attention à l'ordre : GeoJSON = [longitude, latitude]
db.belib_temps_reel.updateMany(
  { "coordonneesxy.lat": { $exists: true } },
  [ { $set: {
      location: {
        type: "Point",
        coordinates: [ "$coordonneesxy.lon", "$coordonneesxy.lat" ]
      }
  } } ]
);

db.belib_temps_reel.findOne({}, { _id: 0, coordonneesxy: 1, location: 1 });


// ---------------------------------------------------------------------
// ÉTAPE 4 - Extraire l'identifiant de station et le numéro de prise
// ---------------------------------------------------------------------
// id_pdc = "FR*V75*E9016*09*1"  ->  id_station = "FR*V75*E9016*09", num_prise = "1"
// Certains id ont 6 morceaux (ex. FR*V75*EHBSAG*LOB*01*2) : on retire
// donc toujours le DERNIER morceau, quelle que soit la longueur.
db.belib_temps_reel.updateMany(
  {},
  [ { $set: {
      _parts: { $split: ["$id_pdc", "*"] }
  } },
  { $set: {
      num_prise: { $arrayElemAt: ["$_parts", -1] },
      id_station: {
        $reduce: {
          input: { $slice: ["$_parts", 1, { $subtract: [{ $size: "$_parts" }, 2] }] },
          initialValue: { $arrayElemAt: ["$_parts", 0] },
          in: { $concat: ["$$value", "*", "$$this"] }
        }
      }
  } },
  { $unset: "_parts" } ]
);

db.belib_temps_reel.findOne({}, { _id: 0, id_pdc: 1, id_station: 1, num_prise: 1 });
db.belib_temps_reel.distinct("id_station").length;      // attendu : 402 stations


// ---------------------------------------------------------------------
// ÉTAPE 5 - Code postal et numéro d'arrondissement depuis l'adresse
// ---------------------------------------------------------------------
// Problème : le champ "arrondissement" regroupe 1er-4e en "Paris centre".
// Le code postal (750xx) dans l'adresse permet de retrouver le vrai numéro.
db.belib_temps_reel.updateMany(
  { adresse_station: { $type: "string" } },
  [ { $set: {
      code_postal: {
        $getField: {
          field: "match",
          input: { $regexFind: { input: "$adresse_station", regex: /750\d\d/ } }
        }
      }
  } } ]
);
// Si ta version de MongoDB est < 5.0 ($getField inconnu), remplace le $set par :
//   { $set: { code_postal: { $let: {
//       vars: { m: { $regexFind: { input: "$adresse_station", regex: /750\d\d/ } } },
//       in: "$$m.match" } } } }

db.belib_temps_reel.updateMany(
  { code_postal: { $type: "string" } },
  [ { $set: { arrondissement_num: { $toInt: { $substrCP: ["$code_postal", 3, 2] } } } } ]
);

// Répartition par vrai arrondissement
db.belib_temps_reel.aggregate([
  { $group: { _id: "$arrondissement_num", nb: { $sum: 1 } } },
  { $sort: { _id: 1 } }
]);


// ---------------------------------------------------------------------
// ÉTAPE 6 - Contrôle qualité : le champ "arrondissement" est-il fiable ?
// ---------------------------------------------------------------------
// On compare l'arrondissement déclaré et le code postal de l'adresse.
db.belib_temps_reel.aggregate([
  { $match: { arrondissement: { $ne: "Paris centre" } } },
  { $project: {
      _id: 0, id_pdc: 1, adresse_station: 1, arrondissement: 1, code_postal: 1,
      arr_declare: { $toInt: { $substrCP: ["$arrondissement", 0, 2] } },
      arrondissement_num: 1
  } },
  { $match: { $expr: { $ne: ["$arr_declare", "$arrondissement_num"] } } }
]);
// -> Attendu : 5 incohérences (1 Rue Navier 75017, déclarée dans le 18e).
// -> Bonus : 3 points "Paris centre" ont une adresse en 75011 (Bd du Temple).
//    Question du TP : lequel des deux champs croire ? Comment le vérifier ?


// ---------------------------------------------------------------------
// ÉTAPE 7 - Vérification finale d'un document nettoyé
// ---------------------------------------------------------------------
db.belib_temps_reel.findOne(
  {},
  { _id: 0, url_description_pdc: 0 }
);
