import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.hadoop.io.Text;
import org.apache.hadoop.mapreduce.Reducer;

/**
 * REDUCER - Pour un statut donné, compte les statuts des AUTRES prises de la même station
 * et les trie du plus fréquent au moins fréquent.
 * (adapté de MonReducer : même logique, sortie enrichie avec les compteurs)
 *
 * Entrée : "Inconnu" -> [Inconnu, Inconnu, Disponible, Inconnu, ...]
 * Sortie : Inconnu    Inconnu:114,Disponible:10,Occupé (en charge):6
 */
public class CoocReducer extends Reducer<Text, Text, Text, Text> {

	@Override
	protected void reduce(Text key, Iterable<Text> values, Context context)
			throws IOException, InterruptedException {

		final Map<String, Integer> occurrences = new HashMap<>();
		for (Text value : values) {
			occurrences.merge(value.toString(), 1, Integer::sum);
		}

		List<String> statuts = new ArrayList<>(occurrences.keySet());
		statuts.sort((a, b) -> occurrences.get(b) - occurrences.get(a)); // tri décroissant

		StringBuilder sb = new StringBuilder();
		for (String statut : statuts) {
			if (sb.length() > 0) {
				sb.append(",");
			}
			sb.append(statut).append(":").append(occurrences.get(statut));
		}
		context.write(key, new Text(sb.toString()));
	}
}
