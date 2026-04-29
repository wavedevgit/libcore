const WEB_JS = /web\.[a-fA-F0-9]{16}\.js/;
const RSPACK_RUNTIME_START =
    /[\w_$]+={};function\s*[\w_$]+\([\s\S]\){var\s*[\w_$]+=[\w_$]+\[[\w_$]+\];if\(void\s*0!==[\s\S]+?\)return[\s\S]+?[\s\S]+?\.exports/gm;

const BASE_URL = 'https://canary.discord.com';
const CANARY_URL_APP = BASE_URL + '/app';

const HEADERS = {
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
    'cache-control': 'no-cache',
    pragma: 'no-cache',

    'sec-ch-ua':
        '"Chromium";v="134", "Google Chrome";v="134", "Not.A/Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',

    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',

    'upgrade-insecure-requests': '1',

    'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
};

export { BASE_URL, WEB_JS, CANARY_URL_APP, RSPACK_RUNTIME_START, HEADERS };
