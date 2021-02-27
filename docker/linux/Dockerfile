FROM centos:latest

WORKDIR /hanako-san

# yum アップデートと crontabs & sudo & curl & vim のインストール
RUN yum -y update && \
    yum -y install crontabs && \
    yum -y install sudo && \
    yum -y install curl && \
    yum -y install vim

# node.js の LTS バージョンをインストール
RUN curl -sL https://rpm.nodesource.com/setup_lts.x | bash - && \
    yum -y install nodejs

# タイムゾーン変更
RUN cp /usr/share/zoneinfo/Asia/Tokyo /etc/localtime 

# cron ファイルを cron.d/ にコピーする
COPY cron/hanako-san /etc/cron.d/hanako-san

# 実行できるように権限を付ける
# chmod rw-r--r-- 
RUN chmod 644 /etc/cron.d/hanako-san && \
    # ファイルの所有者を変更するコマンド（これを行うか、crontab にタスクを書かないと cron が動かなかった） 
    chown root /etc/cron.d/hanako-san

# ログ出力先
RUN touch /tmp/hanako-san.log && \
    touch /tmp/hanako-san-err.log

COPY package.json /hanako-san/package.json

COPY docker/linux/aliases.txt /hanako-san/docker/linux/aliases.txt

# コンテナ内で利用できるエイリアスを bashrc に追加
RUN cat /hanako-san/docker/linux/aliases.txt >> ~/.bashrc
