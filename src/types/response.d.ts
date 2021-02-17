import { Stream } from 'node:stream';
import { AxiosResponse } from 'axios';

export interface ResponseInner {
    config: AxiosResponse['config'];
    data?: Stream;
    headers: AxiosResponse['headers'];
    request?: AxiosResponse['request'];
    status: AxiosResponse['status'];
    statusText: AxiosResponse['statusText'];
}
