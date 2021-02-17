#!/bin/bash

cd /var/www/hanako-san/

node_modules/.bin/ts-node -r tsconfig-paths/register

node_modules/.bin/ts-node src/main.ts
