#!/bin/bash
# Démarre HDFS et YARN, puis garde le conteneur actif
set -e

# Nettoyage des fichiers PID d'un éventuel arrêt précédent
rm -f /tmp/hadoop-*.pid

# Formatage du NameNode uniquement au tout premier démarrage
if [ ! -d /data/hadoop/nn/current ]; then
  echo ">>> Premier démarrage : formatage du NameNode"
  hdfs namenode -format -force -nonInteractive
fi

hdfs --daemon start namenode
hdfs --daemon start datanode
yarn --daemon start resourcemanager
yarn --daemon start nodemanager

echo ">>> Hadoop est démarré"
echo ">>> HDFS : http://localhost:9870   |   YARN : http://localhost:8088"

# Garde le conteneur en vie et affiche les logs du NameNode
tail -F /opt/hadoop/logs/*namenode*.log
