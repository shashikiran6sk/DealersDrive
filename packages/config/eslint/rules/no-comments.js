/**
 * Source carries no prose. What a file does is the code; why it does it is a
 * page under `docs/code`, addressed by the source path it came from.
 *
 * Directives are not prose — `eslint-disable`, `@ts-expect-error`,
 * `prettier-ignore` and the coverage pragmas are read by the toolchain, and
 * deleting one changes what the build does. They are the only comments allowed.
 */
const DIRECTIVE =
  /^\s*(?:eslint-|@ts-|prettier-ignore|c8 |v8 |istanbul |#__PURE__|@jsx|@license|@preserve|global\s|globals\s|exported\s)/;

export const noComments = {
  meta: {
    type: 'suggestion',
    docs: { description: 'Keep prose out of source; it belongs in docs/code.' },
    schema: [],
    messages: {
      prose:
        'No comments in src. Move this to the matching page under docs/code, and let the ' +
        'name say what the comment was saying. Only toolchain directives may stay.',
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (DIRECTIVE.test(comment.value)) continue;
          context.report({ node: comment, messageId: 'prose' });
        }
      },
    };
  },
};

export default { rules: { 'no-comments': noComments } };
