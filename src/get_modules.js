import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

export const getModules = (code) => {
    const ast = acorn.parse(code, {
        ecmaVersion: 'latest',
        allowAwaitOutsideFunction: true,
        allowReserved: true,
        allowReturnOutsideFunction: true,
    });
    const result = { js: {} };

    walk.simple(ast, {
        BinaryExpression(node) {
            if (node.left.type !== 'BinaryExpression') return;
            const binaryExpr = node.left;
            if (
                typeof binaryExpr.left?.value === 'string' &&
                binaryExpr?.right?.type === 'MemberExpression' &&
                binaryExpr?.right?.object?.type === 'ObjectExpression' &&
                ['.js', '.css'].includes(node?.right?.value)
            ) {
                let type;
                const add = () => {
                    for (const prop of binaryExpr.right.object.properties) {
                        result[type][prop.key.value] = prop.value.value;
                    }
                };
                switch (node?.right?.value) {
                    case '.js': {
                        type = 'js';
                        add();
                        return;
                    }
                }
            }
        },
        ConditionalExpression(node) {
            if (
                node.consequent.type !== 'BinaryExpression' ||
                node.test.type !== 'BinaryExpression' ||
                node.consequent?.right?.type !== 'Literal' ||
                typeof node.consequent?.right?.value !== 'string' ||
                (!node.consequent?.right?.value?.endsWith('.js') &&
                    !node.consequent?.right?.value?.endsWith('.css'))
            )
                return;
            if (
                node.test.left.type !== 'Literal' ||
                !typeof ['string', 'number'].includes(
                    typeof node.test.left.value,
                )
            )
                return;
            const id = String(node.test.left?.value);
            let filePath = node.consequent?.right?.value;
            if (!filePath.startsWith('.') && !filePath.startsWith(id))
                filePath = '.' + filePath;
            if (!filePath.startsWith(id)) filePath = id + filePath;
            if (!filePath.endsWith('.js')) {
                return;
            }
            result[filePath.endsWith('.js') ? 'js' : 'css'][id] = filePath;
        },
    });

    return result;
};
