/**
 *
 * @param {string} url
 * @param {*} options
 * @returns {string}
 */
export async function get(url, options) {
    let req = await await fetch(url, options);
    return options?.binary
        ? Buffer.from(await req.arrayBuffer())
        : await req.text();
}
