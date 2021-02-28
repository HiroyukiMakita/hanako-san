# hanako-san

環境省の [環境省花粉観測システム（愛称：はなこさん）](http://kafun.taiki.go.jp/index.aspx) で提供されている  
リアルタイムの花粉飛散状況（東京都、新宿区の観測データ）を取得し Slack に通知するだけのシステムです。  
毎時 55 分頃に、1時間平均の花粉飛散量がどれくらいだったかを  
- 少なめ  
- やや多め  
- 多め  
- 非常に多め  

の 4 段階の判定ではなこさんが教えてくれます。  
（判定方法はヤフー天気を参考にしています https://weather.yahoo.co.jp/weather/pollen/3/13/13104/ ）

リポジトリを pull 後、プロジェクトルートで `.env` を作成後に、`build & up` するだけで、docker上で cron が動き出す想定です。  

```
# 以下を実行後、.env の SLACK_WEBHOOK_URL を入力・保存
$ cp .env.example .env
```

## build & up
```
$ cd docker  

$ make build-up

# または

$ mkdir -p ../files/logs && \
  touch ../files/logs/{hanako-san.log,hanako-san-err.log} && \
  docker-compose build && \
  docker-compose up -d && \
  docker-compose exec linux bash -c "npm run build"
```


## cron が動いてるか確認する
 ```
 $ cd docker  

# コンテナに入る
$ make exec-linux

# コンテナ内では以下のコマンドでいろいろできる
# cron の起動
$ startcron

# cron の停止
$ stopcron

# cron の再起動
$ restartcron

# cron が動いてるか確認
$ cronstatus

# cron のログを表示
$ cronlogs

# systemd 起動時からのログすべてを表示
$ systemdlogs
```

[著作権・リンクについて - 環境省](http://www.env.go.jp/mail.html)
