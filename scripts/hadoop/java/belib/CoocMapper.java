import java.io.IOException;

import org.apache.hadoop.io.LongWritable;
import org.apache.hadoop.io.Text;
import org.apache.hadoop.mapreduce.Mapper;

/**
 * MAPPER - Co-occurrence des statuts dans une même station Belib'
 * (adapté de MonMapper : "produits achetés ensemble" -> "statuts présents ensemble")
 *
 * Entrée : 1 ligne = 1 station = liste des statuts de ses prises, séparés par des virgules
 *          ex. "Disponible,Occupé (en charge),Disponible,En maintenance"
 * Sortie : pour chaque couple de prises (i, j) avec i != j : (statut_i, statut_j)
 *
 * Différence avec l'original : on émet les DEUX sens (j != i au lieu de j > i),
 * sinon le résultat dépend de l'ordre des prises dans la ligne.
 */
public class CoocMapper extends Mapper<LongWritable, Text, Text, Text> {

	private final Text cle = new Text();
	private final Text valeur = new Text();

	@Override
	protected void map(LongWritable key, Text value, Context context)
			throws IOException, InterruptedException {

		String ligne = value.toString().trim();
		if (ligne.isEmpty()) {
			return;
		}
		String[] statuts = ligne.split(",");

		for (int i = 0; i < statuts.length; i++) {
			for (int j = 0; j < statuts.length; j++) {
				if (i == j) {
					continue; // une prise n'est pas "voisine" d'elle-même
				}
				cle.set(statuts[i].trim());
				valeur.set(statuts[j].trim());
				context.write(cle, valeur);
			}
		}
	}
}
