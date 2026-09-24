import org.apache.hadoop.conf.Configured;
import org.apache.hadoop.conf.Configuration;
import org.apache.hadoop.fs.Path;
import org.apache.hadoop.io.Text;
import org.apache.hadoop.mapreduce.Job;
import org.apache.hadoop.mapreduce.lib.input.FileInputFormat;
import org.apache.hadoop.mapreduce.lib.input.TextInputFormat;
import org.apache.hadoop.mapreduce.lib.output.FileOutputFormat;
import org.apache.hadoop.mapreduce.lib.output.TextOutputFormat;
import org.apache.hadoop.util.Tool;
import org.apache.hadoop.util.ToolRunner;

/**
 * DRIVER - Configure et lance le job de co-occurrence des statuts Belib'.
 * (adapté de MonDriver)
 *
 * Usage : hadoop jar cooc-belib.jar CoocDriver [entrée] [sortie]
 * Par défaut : /belib/cooc/input  ->  /belib/cooc/output
 */
public class CoocDriver extends Configured implements Tool {

	@Override
	public int run(String[] args) throws Exception {

		String entree = args.length > 0 ? args[0] : "/belib/cooc/input";
		String sortie = args.length > 1 ? args[1] : "/belib/cooc/output";

		Job job = Job.getInstance(getConf(), "cooccurrence-statuts-belib");
		job.setJarByClass(CoocDriver.class);

		job.setMapperClass(CoocMapper.class);
		job.setReducerClass(CoocReducer.class);

		// 1 seul reducer -> 1 seul fichier part-r-00000 (l'original en avait 3)
		job.setNumReduceTasks(1);

		job.setMapOutputKeyClass(Text.class);
		job.setMapOutputValueClass(Text.class);
		job.setOutputKeyClass(Text.class);
		job.setOutputValueClass(Text.class);

		job.setInputFormatClass(TextInputFormat.class);
		FileInputFormat.addInputPath(job, new Path(entree));

		job.setOutputFormatClass(TextOutputFormat.class);
		FileOutputFormat.setOutputPath(job, new Path(sortie));

		return job.waitForCompletion(true) ? 0 : 1;
	}

	public static void main(String[] args) throws Exception {
		System.exit(ToolRunner.run(new Configuration(), new CoocDriver(), args));
	}
}
