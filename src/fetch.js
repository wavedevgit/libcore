/**
 *
 * @param {string} url
 * @param {*} options
 * @returns {string}
 */
export async function get(url, options) {
    return await (await fetch(url, options)).text();
}
