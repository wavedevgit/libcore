import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import MagicString from 'magic-string';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

import * as beautify from "js-beautify";

export function deminify(code) {
  return beautify.default.js(code, {
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

    const newCode = new MagicString(code);

    let stripped = false;

    walk.simple(ast, {
        ObjectExpression(node) {
            if (stripped) return;
            if (!node.properties?.length) return;

            // detect numeric-key object full of functions (webpack chunk map)
            const isChunkObject = node.properties.every(prop => {
                const key = prop.key?.value || prop.key?.name;
                return (
                    isNumber(key) &&
                    prop.value &&
                    (prop.value.type === 'FunctionExpression' ||
                     prop.value.type === 'ArrowFunctionExpression')
                );
            });

            if (!isChunkObject) return;

            newCode.overwrite(node.start, node.end, '{}');

            stripped = true;
        },
    });

    return newCode.toString();
}
