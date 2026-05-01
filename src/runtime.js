import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import MagicString from 'magic-string';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

import * as beautify from "js-beautify";

export function deminify(code) {
  return beautify.js(code, {
    indent_size: 2,
    space_in_empty_paren: true
  });
}

const isNumber = (n) => {
    if (typeof n === 'number') return true;
    const start = '0'.charCodeAt(0);
    const end = '9'.charCodeAt(0);
    for (let char of String(n).split('')) {
        char = char.charCodeAt(0);
        if (char > end || char < start) return false;
    }
    return true;
};

const WEBPACK_FACTORY_PARAMS = ['module', 'exports', 'require'];

// this removes discord chunks, and only keeps 1 chunk in the main chunks object
// so the full code is small
export function getRuntime(code) {
    const ast = acorn.parse(code, {
        ecmaVersion: 'latest',
        allowAwaitOutsideFunction: true,
        allowReserved: true,
        allowReturnOutsideFunction: true,
    });

    let strippedChunks = false;

    let newCode = new MagicString(code);

    walk.simple(ast, {
        ObjectExpression(node) {
            if (strippedChunks) return;
            if (!node.properties?.length) return;

            if (
                !node.properties.every(
                    (prop) =>
                        isNumber(prop.key?.value || prop.key?.name) &&
                        prop.value &&
                        [
                            'FunctionExpression',
                            'ArrowFunctionExpression',
                        ].includes(prop.value.type),
                )
            )
                return;

            const firstProperty = node.properties[0];

            newCode.update(
                firstProperty.key.start,
                firstProperty.key.end,
                'id',
            );
            console.log('updated id');

            // make function args readable
            for (
                let param = 0;
                param < firstProperty.value?.params?.length;
                param++
            ) {
                newCode.update(
                    firstProperty.value.params[param].start,
                    firstProperty.value.params[param].end,
                    WEBPACK_FACTORY_PARAMS[param] || 'unknown',
                );
            }
            // make body empty so its very small
            newCode.update(
                firstProperty.value.body.start,
                firstProperty.value.body.end,
                '{}',
            );
            for (let prop of node.properties.slice(1)) {
                newCode.update(prop.start, prop.end, 'REMOVE_THIS_PROP');
            }
            newCode = newCode.toString();
            // removes invalid js :3
            newCode = newCode.replaceAll(',REMOVE_THIS_PROP', '');
            strippedChunks = true;
        },
    });
    return newCode;
}
