# hanako-san

環境省が提供する、[環境省花粉観測システム（愛称：はなこさん）](http://kafun.taiki.go.jp/index.aspx) で提供されている  
リアルタイムの花粉飛散状況を取得して Slack に通知するだけのシステムです。  
毎時 55 分頃に、1時間あたりの花粉飛散量がどれくらいだったかを  
- 少なめ  
- やや多め  
- 多め  
- 非常に多め  

の 4 段階の判定ではなこさんが教えてくれます。

リポジトリを pull 後、プロジェクトルートで `.env` を作成後に、`build & up` するだけで、docker上で cron が動き出す想定です。  

```
# 以下を実行後、`.env` の `SLACK_WEBHOOK_URL` を入力・保存
$ cp .env.example .env
```

## build & up
```
$ cd docker  

$ make build-up

# または
$ docker-compose build && docker-compose up -d && docker-compose exec linux bash -c "npm run build"
```

### crond が動いてるか確認するコマンド
`systemctl status crond.service`

### systemd のログを `less` コマンドで表示
-  `-b`(起動時からのログすべて)   
`journalctl -b | less`  
-  `-r`(出力順を逆にする) `-u cron`(systemd ユニットを指定)   
`journalctl -r -u cron | less`