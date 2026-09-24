# =====================================================================
# Hadoop 3.4 en mode pseudo-distribué (1 conteneur = 1 mini-cluster)
# HDFS (NameNode + DataNode) + YARN (ResourceManager + NodeManager)
# Java 11 + Python 3 pour MapReduce en Python (Hadoop Streaming)
# =====================================================================
FROM eclipse-temurin:11-jdk-jammy

ARG HADOOP_VERSION=3.4.1

# curl est déjà présent dans l'image de base : on ne le réinstalle pas
# (évite une mise à jour de curl qui échouait avec une erreur 404 du miroir Ubuntu)
RUN apt-get -o Acquire::Retries=3 update \
 && apt-get -o Acquire::Retries=3 install -y --no-install-recommends --no-upgrade python3 procps nano \
 && rm -rf /var/lib/apt/lists/*

# Téléchargement de Hadoop (version "lean" plus légère, sinon version complète)
RUN cd /tmp \
 && ( curl -fSL -o hadoop.tgz https://archive.apache.org/dist/hadoop/common/hadoop-${HADOOP_VERSION}/hadoop-${HADOOP_VERSION}-lean.tar.gz \
   || curl -fSL -o hadoop.tgz https://archive.apache.org/dist/hadoop/common/hadoop-${HADOOP_VERSION}/hadoop-${HADOOP_VERSION}.tar.gz ) \
 && tar -xzf hadoop.tgz -C /opt \
 && mv /opt/hadoop-${HADOOP_VERSION} /opt/hadoop \
 && rm hadoop.tgz \
 && rm -rf /opt/hadoop/share/doc

ENV HADOOP_HOME=/opt/hadoop \
    HADOOP_CONF_DIR=/opt/hadoop/etc/hadoop \
    HADOOP_MAPRED_HOME=/opt/hadoop \
    HDFS_NAMENODE_USER=root \
    HDFS_DATANODE_USER=root \
    HDFS_SECONDARYNAMENODE_USER=root \
    YARN_RESOURCEMANAGER_USER=root \
    YARN_NODEMANAGER_USER=root
ENV PATH=$PATH:$HADOOP_HOME/bin:$HADOOP_HOME/sbin

# Configuration du cluster
COPY conf/*.xml $HADOOP_CONF_DIR/
COPY start-hadoop.sh /usr/local/bin/start-hadoop.sh
RUN sed -i 's/\r$//' $HADOOP_CONF_DIR/*.xml /usr/local/bin/start-hadoop.sh \
 && chmod +x /usr/local/bin/start-hadoop.sh \
 && echo "export JAVA_HOME=${JAVA_HOME}" >> $HADOOP_CONF_DIR/hadoop-env.sh

WORKDIR /projet

# 9870 = interface HDFS, 8088 = interface YARN, 9864 = interface DataNode
EXPOSE 9870 8088 9864

CMD ["/usr/local/bin/start-hadoop.sh"]
