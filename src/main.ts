import dotenv from 'dotenv';
import axios, { AxiosRequestConfig } from 'axios';
import * as Fs from 'fs';
import * as Path from 'path';
import { ResponseInner } from './types/response';
import { BindValiables } from './types/request';
import iconv from 'iconv-lite';
import parse from 'csv-parse';
import moment from 'moment';
import { Stream } from 'node:stream';
import { IncomingWebhook } from '@slack/webhook';

// .env 読み込み
dotenv.config();
const env = process.env;

// はなこさんから取得する csv のカラム名
const code: string = '測定局コード';
const amedasCode: string = 'アメダス測定局コード';
const date: string = '年月日';
const hour: string = '時';
const stationName: string = '測定局名';
const stationType: string = '測定局種別';
const prefectureCode: string = '都道府県コード';
const prefectureName: string = '都道府県名';
const townCode: string = '市区町村コード';
const townName: string = '市区町村名';
const pollenDespersion: string = '花粉飛散数[個/m3]';
const windDirection: string = '風向';
const windSpeed: string = '風速[m/s]';
const temperature: string = '気温[℃]';
const precipitation: string = '降水量[mm]';
const radarPrecipitation: string = 'レーダー降水量[mm]';

const compassPoint: { [key: string]: string } = {
    '00': '静穏',
    '01': '北北東',
    '02': '北東',
    '03': '東北東',
    '04': '東',
    '05': '東南東',
    '06': '南東',
    '07': '南南東',
    '08': '南',
    '09': '南南西',
    '10': '南西',
    '11': '西南西',
    '12': '西',
    '13': '西北西',
    '14': '北西',
    '15': '北北西',
    '16': '北',
};

function pollenLevel(pollenDespersion: string): string {
    const few = '少なめ'; // 0 〜  49 個／m3
    const largerPortion = 'やや多め'; // 50 〜 149 個／m3
    const many = '多め'; // 150 〜 249 個／m3
    const veryMany = '非常に多め'; // 250 〜 個／m3

    const pollen = Number(pollenDespersion);

    if (pollen >= 250) {
        return veryMany;
    } else if (pollen >= 150 && pollen <= 249) {
        return many;
    } else if (pollen >= 50 && pollen <= 149) {
        return largerPortion;
    }
    return few;
}

function messageFormatting(json: Array<{ [key: string]: string }>): string {
    const data = json[0];
    const today = data[date];
    const time = data[hour];
    const prefecture = data[prefectureName];
    const town = data[townName];
    const pollen = data[pollenDespersion];
    const directionOfWind = data[windDirection];
    const speedOfWind = data[windSpeed];
    const temp = data[temperature];

    return `${moment(`${today} ${time}`).format('YYYY年MM月DD日')}\n${moment(
        `${today} ${time}`
    ).format('HH時')}台の${prefecture} ${town}の花粉飛散量は${pollenLevel(
        pollen
    )}（ ${pollen} 個/m3 ）でした。\n気温は ${temp} ℃、風向は${
        compassPoint[directionOfWind]
    }、風速は秒速 ${speedOfWind} メートルです。\n\n※ このメッセージは環境省が公開する花粉観測システム（はなこさん）が提供する情報をもとに作成しています\nはなこさん：http://kafun.taiki.go.jp/index.aspx`;
}

function sendToSlack(message: string, icon?: string) {
    const webhook: IncomingWebhook = new IncomingWebhook(
        env.SLACK_WEBHOOK_URL || ''
    );
    webhook.send({
        text: message,
        username: 'はなこさん（環境省花粉観測システム）',
        icon_emoji: icon ?? ':sunflower:',
    });
}

// 渡された csv の Stream にカラム名をつけて Json に変換
function streamToJson(decodedStreamCsv: Stream) {
    const columns: Array<string> = [
        code,
        amedasCode,
        date,
        hour,
        stationName,
        stationType,
        prefectureCode,
        prefectureName,
        townCode,
        townName,
        pollenDespersion,
        windDirection,
        windSpeed,
        temperature,
        precipitation,
        radarPrecipitation,
    ];

    const parser = parse({ columns }, (err, data) => {
        if (typeof err !== 'undefined') {
            console.log(`Parse to JSON was failed.\n${err}`);
            sendToSlack(
                '花粉データの変換に失敗しました。',
                ':woman-gesturing-no:'
            );
            return;
        }
        const json = JSON.stringify(data);
        const object: Array<{ [key: string]: string }> = JSON.parse(json);
        sendToSlack(messageFormatting(object));
    });

    decodedStreamCsv.pipe(parser);
}

/**
 * 直近1時間平均の花粉情報 csv をダウンロードして保存
 */
async function downloadCsv() {
    /**
     * 環境省花粉観測システム（はなこさん）
     * http://kafun.taiki.go.jp/index.aspx
     */
    const url: AxiosRequestConfig['url'] =
        'http://kafun.taiki.go.jp/DownLoad1.aspx';

    const headers: AxiosRequestConfig['headers'] = {
        'Accept':
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Accept-Language': 'ja',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Content-Length': '6240',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Host': 'kafun.taiki.go.jp',
        'Origin': 'http://kafun.taiki.go.jp',
        'Referer': 'http://kafun.taiki.go.jp/DownLoad1.aspx',
        'Upgrade-Insecure-Requests': '1',
    };

    // 花粉データの測定開始日
    const startTime: string = moment('2021-02-01 01').format('YYYYMMDDhh');

    const now = moment();
    const hourNow = now.format('k');
    const minuteNow = now.format('mm');
    const yesterday = now.clone().add('-1', 'day');
    const oneHourAgo = now.clone().add('-1', 'hour');
    // 24 時台と、毎時 0 〜 39 分に実行されるときの調整
    // はなこさんのデータは毎時 30 分頃に更新されるため、40 分より前の場合は 1 時間前のデータを取得
    const dateData =
        hourNow === '24'
            ? yesterday
            : Number(minuteNow) < 40
            ? oneHourAgo
            : now;
    const area: string = '03';
    const checkNumber: string = '16';
    const values: BindValiables = {
        startTime,
        ddlStartYear: dateData.format('YYYY'),
        ddlStartMonth: dateData.format('M'),
        ddlStartDay: dateData.format('D'),
        ddlStartHour: dateData.format('k'),
        ddlEndYear: dateData.format('YYYY'),
        ddlEndMonth: dateData.format('M'),
        ddlEndDay: dateData.format('D'),
        ddlEndHour: dateData.format('k'),
        ddlArea: area,
        // CheckBoxMstList%2416 これだけキーを変数にする
        checkBoxMstList: `CheckBoxMstList${encodeURI(`\$${checkNumber}`)}`,
        download: encodeURI('ダウンロード'),
    };

    const response: ResponseInner = await axios({
        url,
        method: 'POST',
        headers,
        // 'blob' にすると csv をダウンロードできるが、文字化けがうまく変換できないため、今回は 'stream' で取得
        responseType: 'stream',
        data: `__EVENTTARGET=&__EVENTARGUMENT=&__LASTFOCUS=&__VIEWSTATE=%2FwEPDwUKMjA4NDcxNzAyMw9kFgICAQ9kFhgCBQ8QDxYCHgtfIURhdGFCb3VuZGdkEBUBBDIwMjEVAQQyMDIxFCsDAWdkZAIHDxAPFgIfAGdkEBUMATEBMgEzATQBNQE2ATcBOAE5AjEwAjExAjEyFQwBMQEyATMBNAE1ATYBNwE4ATkCMTACMTECMTIUKwMMZ2dnZ2dnZ2dnZ2dnZGQCCQ8QDxYCHwBnZBAVHwExATIBMwE0ATUBNgE3ATgBOQIxMAIxMQIxMgIxMwIxNAIxNQIxNgIxNwIxOAIxOQIyMAIyMQIyMgIyMwIyNAIyNQIyNgIyNwIyOAIyOQIzMAIzMRUfATEBMgEzATQBNQE2ATcBOAE5AjEwAjExAjEyAjEzAjE0AjE1AjE2AjE3AjE4AjE5AjIwAjIxAjIyAjIzAjI0AjI1AjI2AjI3AjI4AjI5AjMwAjMxFCsDH2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dkZAILDxAPFgIfAGdkEBUYATEBMgEzATQBNQE2ATcBOAE5AjEwAjExAjEyAjEzAjE0AjE1AjE2AjE3AjE4AjE5AjIwAjIxAjIyAjIzAjI0FRgBMQEyATMBNAE1ATYBNwE4ATkCMTACMTECMTICMTMCMTQCMTUCMTYCMTcCMTgCMTkCMjACMjECMjICMjMCMjQUKwMYZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZGQCDQ8QDxYCHwBnZBAVAQQyMDIxFQEEMjAyMRQrAwFnZGQCDw8QDxYCHwBnZBAVDAExATIBMwE0ATUBNgE3ATgBOQIxMAIxMQIxMhUMATEBMgEzATQBNQE2ATcBOAE5AjEwAjExAjEyFCsDDGdnZ2dnZ2dnZ2dnZ2RkAhEPEA8WAh8AZ2QQFR8BMQEyATMBNAE1ATYBNwE4ATkCMTACMTECMTICMTMCMTQCMTUCMTYCMTcCMTgCMTkCMjACMjECMjICMjMCMjQCMjUCMjYCMjcCMjgCMjkCMzACMzEVHwExATIBMwE0ATUBNgE3ATgBOQIxMAIxMQIxMgIxMwIxNAIxNQIxNgIxNwIxOAIxOQIyMAIyMQIyMgIyMwIyNAIyNQIyNgIyNwIyOAIyOQIzMAIzMRQrAx9nZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZGQCEw8QDxYCHwBnZBAVGAExATIBMwE0ATUBNgE3ATgBOQIxMAIxMQIxMgIxMwIxNAIxNQIxNgIxNwIxOAIxOQIyMAIyMQIyMgIyMwIyNBUYATEBMgEzATQBNQE2ATcBOAE5AjEwAjExAjEyAjEzAjE0AjE1AjE2AjE3AjE4AjE5AjIwAjIxAjIyAjIzAjI0FCsDGGdnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2RkAhUPEA8WBh4ORGF0YVZhbHVlRmllbGQFBVZhbHVlHg1EYXRhVGV4dEZpZWxkBQRUZXh0HwBnZBAVBQzplqLmnbHlnLDln58M5Lit6YOo5Zyw5Z%2BfDOmWouilv%2BWcsOWfnxXkuK3lm73jg7vlm5vlm73lnLDln58M5Lmd5bee5Zyw5Z%2BfFQUCMDMCMDUCMDYCMDcCMDgUKwMFZ2dnZ2cWAWZkAhsPEA8WBh8BBQVWYWx1ZR8CBQRUZXh0HwBnZBAVFEw8Zm9udCBjb2xvcj0iYmx1ZSI%2BKOiMqOWfjuecjCnmsLTmiLjnn7Plt53kuIDoiKznkrDlooPlpKfmsJfmuKzlrprlsYA8L2ZvbnQ%2BUzxmb250IGNvbG9yPSJibHVlIj4o6Iyo5Z%2BO55yMKeWbveeri%2BeglOeptumWi%2BeZuuazleS6uiDlm73nq4vnkrDlooPnoJTnqbbmiYA8L2ZvbnQ%2BOjxmb250IGNvbG9yPSJibHVlIj4o6Iyo5Z%2BO55yMKeaXpeeri%2BW4gua2iOmYsuacrOmDqDwvZm9udD41KOagg%2BacqOecjCnlrofpg73lrq7luILkuK3lpK7nlJ%2Fmtq%2Flrabnv5Ljgrvjg7Pjgr%2Fjg7wgKOagg%2BacqOecjCnmoIPmnKjnnIzpgqPpoIjluoHoiI4mKOagg%2BacqOecjCnml6XlhYnluILlvbnmiYDnrKzvvJTluoHoiI5DPGZvbnQgY29sb3I9ImJsdWUiPijnvqTppqznnIwp576k6aas55yM6KGb55Sf55Kw5aKD56CU56m25omAPC9mb250PkA8Zm9udCBjb2xvcj0iYmx1ZSI%2BKOe%2BpOmmrOecjCnppKjmnpfkv53lgaXnpo%2FnpYnkuovli5nmiYA8L2ZvbnQ%2BICjln7znjonnnIwp44GV44GE44Gf44G%2B5biC5b255omAJijln7znjonnnIwp54aK6LC35biC5L%2Bd5YGl44K744Oz44K%2F44O8Gijln7znjonnnIwp6aOv6IO95biC5b255omAMTxmb250IGNvbG9yPSJibHVlIj4o5Y2D6JGJ55yMKeadsemCpuWkp%2BWtpjwvZm9udD5GPGZvbnQgY29sb3I9ImJsdWUiPijljYPokYnnnIwp5Y2D6JGJ55yM55Kw5aKD56CU56m244K744Oz44K%2F44O8PC9mb250Pk88Zm9udCBjb2xvcj0iYmx1ZSI%2BKOWNg%2BiRieecjCnljbDml5vlgaXlurfnpo%2FnpYnjgrvjg7Pjgr%2Fjg7zmiJDnlLDmlK%2FmiYA8L2ZvbnQ%2BPTxmb250IGNvbG9yPSJibHVlIj4o5Y2D6JGJ55yMKeWQm%2Ba0peW4guezoOeUsOa4rOWumuWxgDwvZm9udD4pKOadseS6rOmDvSnmnbHkuqzpg73lpJrmkanlsI%2FlubPkv53lgaXmiYApKOadseS6rOmDvSnmlrDlrr%2FljLrlvbnmiYDnrKzkuozliIbluoHoiI5DPGZvbnQgY29sb3I9ImJsdWUiPijnpZ7lpYjlt53nnIwp56We5aWI5bed55yM5bqB5LqM5YiG5bqB6IiOPC9mb250PlU8Zm9udCBjb2xvcj0iYmx1ZSI%2BKOelnuWliOW3neecjCnlt53ltI7nlJ%2Flkb3np5Hlrabjg7vnkrDlooPnoJTnqbbjgrvjg7Pjgr%2Fjg7w8L2ZvbnQ%2BTDxmb250IGNvbG9yPSJibHVlIj4o56We5aWI5bed55yMKeelnuWliOW3neecjOeSsOWig%2BenkeWtpuOCu%2BODs%2BOCv%2BODvDwvZm9udD4VFAg1MDgxMDEwMAg1MDgxMDIwMAg1MDgyMDEwMAg1MDkxMDEwMAg1MDkyMDEwMAg1MDkyMDIwMAg1MTAxMDEwMAg1MTAyMDEwMAg1MTExMDIwMAg1MTEyMDQwMAg1MTEyMDMwMAg1MTIxMDEwMAg1MTIxMDIwMAg1MTIyMDEwMAg1MTIyMDIwMAg1MTMxMDIwMAg1MTMyMDEwMAg1MTQxMDEwMAg1MTQxMDIwMAg1MTQyMDEwMBQrAxRnZ2dnZ2dnZ2dnZ2dnZ2dnZ2dnZ2RkAh0PD2QWAh4Hb25jbGljawUZcmV0dXJuIENoYW5nZVBhZ2UoRm9ybTEpO2QCHw8PZBYCHwMFGXJldHVybiBDaGFuZ2VQYWdlKEZvcm0xKTtkGAEFHl9fQ29udHJvbHNSZXF1aXJlUG9zdEJhY2tLZXlfXxYVBRFDaGVja0JveE1zdExpc3QkMAURQ2hlY2tCb3hNc3RMaXN0JDEFEUNoZWNrQm94TXN0TGlzdCQyBRFDaGVja0JveE1zdExpc3QkMwURQ2hlY2tCb3hNc3RMaXN0JDQFEUNoZWNrQm94TXN0TGlzdCQ1BRFDaGVja0JveE1zdExpc3QkNgURQ2hlY2tCb3hNc3RMaXN0JDcFEUNoZWNrQm94TXN0TGlzdCQ4BRFDaGVja0JveE1zdExpc3QkOQUSQ2hlY2tCb3hNc3RMaXN0JDEwBRJDaGVja0JveE1zdExpc3QkMTEFEkNoZWNrQm94TXN0TGlzdCQxMgUSQ2hlY2tCb3hNc3RMaXN0JDEzBRJDaGVja0JveE1zdExpc3QkMTQFEkNoZWNrQm94TXN0TGlzdCQxNQUSQ2hlY2tCb3hNc3RMaXN0JDE2BRJDaGVja0JveE1zdExpc3QkMTcFEkNoZWNrQm94TXN0TGlzdCQxOAUSQ2hlY2tCb3hNc3RMaXN0JDE5BRJDaGVja0JveE1zdExpc3QkMTklZFjUXJQVSRF1wICkU6ujGTrgJg%3D%3D&__VIEWSTATEGENERATOR=DE1917C9&__EVENTVALIDATION=%2FwEWqAECmtWD3AUC0pnr3g0CvfCk3wYC7rOKoA8C77OKoA8C7LOKoA8C7bOKoA8C6rOKoA8C67OKoA8C6LOKoA8C%2BbOKoA8C9rOKoA8C7rPKow8C7rPGow8C7rPCow8C%2BfykvAwC%2BPykvAwC%2B%2FykvAwC%2BvykvAwC%2FfykvAwC%2FPykvAwC%2F%2FykvAwC7vykvAwC4fykvAwC%2BfzkvwwC%2BfzovwwC%2BfzsvwwC%2BfzQvwwC%2BfzUvwwC%2BfzYvwwC%2BfzcvwwC%2BfzAvwwC%2BfyEvAwC%2BfyIvAwC%2BPzkvwwC%2BPzovwwC%2BPzsvwwC%2BPzQvwwC%2BPzUvwwC%2BPzYvwwC%2BPzcvwwC%2BPzAvwwC%2BPyEvAwC%2BPyIvAwC%2B%2FzkvwwC%2B%2FzovwwC2dfPjg0C2NfPjg0C29fPjg0C2tfPjg0C3dfPjg0C3NfPjg0C39fPjg0CztfPjg0CwdfPjg0C2dePjQ0C2deDjQ0C2deHjQ0C2de7jQ0C2de%2FjQ0C2dezjQ0C2de3jQ0C2derjQ0C2dfvjg0C2dfjjg0C2NePjQ0C2NeDjQ0C2NeHjQ0C2Ne7jQ0C2Ne%2FjQ0Cg76EwgwCq%2F66zwsCqv66zwsCqf66zwsCqP66zwsCr%2F66zwsCrv66zwsCrf66zwsCvP66zwsCs%2F66zwsCq%2F76zAsCq%2F72zAsCq%2F7yzAsC%2BeK61AkC%2BOK61AkC%2B%2BK61AkC%2BuK61AkC%2FeK61AkC%2FOK61AkC%2F%2BK61AkC7uK61AkC4eK61AkC%2BeL61wkC%2BeL21wkC%2BeLy1wkC%2BeLO1wkC%2BeLK1wkC%2BeLG1wkC%2BeLC1wkC%2BeLe1wkC%2BeKa1AkC%2BeKW1AkC%2BOL61wkC%2BOL21wkC%2BOLy1wkC%2BOLO1wkC%2BOLK1wkC%2BOLG1wkC%2BOLC1wkC%2BOLe1wkC%2BOKa1AkC%2BOKW1AkC%2B%2BL61wkC%2B%2BL21wkC8YeS3gcC8IeS3gcC84eS3gcC8oeS3gcC9YeS3gcC9IeS3gcC94eS3gcC5oeS3gcC6YeS3gcC8YfS3QcC8Yfe3QcC8Yfa3QcC8Yfm3QcC8Yfi3QcC8Yfu3QcC8Yfq3QcC8Yf23QcC8Yey3gcC8Ye%2B3gcC8IfS3QcC8Ife3QcC8Ifa3QcC8Ifm3QcC8Ifi3QcCq6WQZAK7ys6JDAK7ysaJDAK7ysKJDAK7yt6JDAK7ypqKDAK2yfrdAQKA6KnRAgKd%2BNSJDAKc%2BNSJDAKb%2BNSJDAKa%2BNSJDAKh%2BNSJDAKg%2BNSJDAKf%2BNSJDAKe%2BNSJDAKl%2BNSJDAKk%2BNSJDAKc%2BJSJDAKc%2BJiJDAKc%2BIyJDAKc%2BJCJDAKc%2BKSJDAKc%2BKiJDAKc%2BJyJDAKc%2BKCJDAKc%2BLSJDAKc%2BLiJDAK0%2F8YSAtjQ4LIPZd7muuw3MPPJ0HnDbrz9aXCRay8%3D&StartTime=${values.startTime}&ddlStartYear=${values.ddlStartYear}&ddlStartMonth=${values.ddlStartMonth}&ddlStartDay=${values.ddlStartDay}&ddlStartHour=${values.ddlStartHour}&ddlEndYear=${values.ddlEndYear}&ddlEndMonth=${values.ddlEndMonth}&ddlEndDay=${values.ddlEndDay}&ddlEndHour=${values.ddlEndHour}&ddlArea=${values.ddlArea}&${values.checkBoxMstList}=on&download=${values.download}`,
    });

    if (response.status !== 200 || typeof response?.data === 'undefined') {
        sendToSlack('花粉データの取得に失敗しました。', ':woman-gesturing-no:');
        console.log('Fetch data was failed.');
        return;
    }

    const cachedFilePath: string = Path.resolve('files', 'csv', 'Cache.csv');

    // Shift_JIS なのでデコードしないと文字化けする
    const decodedStreamCsv: Stream = response.data.pipe(
        iconv.decodeStream('Shift_JIS')
    );

    // UTF-8 でファイルに保存
    decodedStreamCsv.pipe(
        Fs.createWriteStream(cachedFilePath, { encoding: 'utf-8' })
    );

    // 取得したデータを Json に変換
    streamToJson(decodedStreamCsv);
}

downloadCsv().catch((error) =>
    sendToSlack(
        `花粉データの取得に失敗しました。\nError:\n${error}`,
        ':woman-gesturing-no:'
    )
);
