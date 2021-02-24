#!/bin/bash

# /hanako-san から相対パスで実行しないとエラーが出るので移動
cd /hanako-san

# --project で 参照する tsconfig を指定（これがないとエラーになる）
node_modules/.bin/ts-node --project tsconfig.json src/main.ts