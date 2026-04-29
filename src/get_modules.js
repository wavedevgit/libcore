import * as cheerio from 'cheerio';

export const getModules = (html) => {
    const $ = cheerio.load(html);
    return $('script')
        .get()
        .map((el) => el.attribs?.src)
        .filter((el) => !el?.startsWith?.('/assets/web.') && el);
};
