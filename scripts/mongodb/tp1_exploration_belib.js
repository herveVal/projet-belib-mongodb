// =====================================================================
// TP1 - Exploration du jeu de données Belib' (Open Data Paris)
// Points de recharge pour véhicules électriques - disponibilité temps réel
// Base : paris_opendata   |   Collection : belib
// À exécuter dans Navicat (Nouvelle requête) ou dans mongosh
// =====================================================================

// ---------------------------------------------------------------------
// 0. IMPORT (à faire une seule fois)
// ---------------------------------------------------------------------
// Option A - Navicat : clic droit sur la base "paris_opendata" > Import Wizard
//            > JSON > choisir le fichier > collection cible "belib".
// Option B - Invite de commandes Windows :
//   mongoimport --db paris_opendata --collection belib --jsonArray ^
//     --file "belib-points-de-recharge-...-temps-reel.json"
// (--jsonArray est obligatoire : le fichier est un tableau JSON [ {...}, {...} ])

use("paris_opendata");

// ---------------------------------------------------------------------
// 1. Premier coup d'œil
// ---------------------------------------------------------------------
db.belib.countDocuments();                 // attendu : 1970 points de charge
db.belib.findOne();                        // structure d'un document

// ---------------------------------------------------------------------
// 2. Filtres simples
// ---------------------------------------------------------------------
// Points de charge disponibles
db.belib.find({ statut_pdc: "Disponible" });
db.belib.countDocuments({ statut_pdc: "Disponible" });

// Points en maintenance dans le 15e
db.belib.find({ statut_pdc: "En maintenance", arrondissement: "15e Arrondissement" });

// Plusieurs valeurs possibles : $in
db.belib.find({ statut_pdc: { $in: ["En maintenance", "Inconnu"] } });

// ---------------------------------------------------------------------
// 3. Projection, tri, limite
// ---------------------------------------------------------------------
// N'afficher que l'adresse et le statut, sans l'_id
db.belib.find(
  { arrondissement: "16e Arrondissement" },
  { _id: 0, adresse_station: 1, statut_pdc: 1 }
).sort({ adresse_station: 1 }).limit(10);

// Les 5 points mis à jour le plus récemment
db.belib.find({}, { _id: 0, id_pdc: 1, statut_pdc: 1, last_updated: 1 })
  .sort({ last_updated: -1 }).limit(5);

// ---------------------------------------------------------------------
// 4. Valeurs distinctes
// ---------------------------------------------------------------------
db.belib.distinct("statut_pdc");           // 5 statuts
db.belib.distinct("arrondissement");       // attention : 1er-4e regroupés en "Paris centre"

// ---------------------------------------------------------------------
// 5. Qualité des données : repérer les valeurs manquantes
// ---------------------------------------------------------------------
db.belib.countDocuments({ arrondissement: null });   // attendu : 12
db.belib.find({ coordonneesxy: null }, { _id: 0, id_pdc: 1, statut_pdc: 1 });

// Recherche texte partielle avec une expression régulière
db.belib.find({ adresse_station: /Rue de Lobau/i }, { _id: 0, id_pdc: 1, statut_pdc: 1 });

// ---------------------------------------------------------------------
// 6. Question bonus : combien de points par statut ? (aperçu du TP3)
// ---------------------------------------------------------------------
db.belib.aggregate([
  { $group: { _id: "$statut_pdc", nb: { $sum: 1 } } },
  { $sort: { nb: -1 } }
]);
