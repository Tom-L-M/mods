const fs = require('node:fs');
const { isStdinActive, readStdin, ArgvParser } = require('../shared');

function escapeRegExp(string) {
    return string.replaceAll(/[^a-z0-9]/gi, '\\$&');
}
function wrapRegExpInGroup(string) {
    return `(${string})`;
}

const help = `
    [grep-js]
        A "grep" command line utility in NodeJS.

    Usage:
        node grep <string> <file> [options]
      OR
        <stdin> | node grep <string> [options]

    Options:
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -r | --regex            Treat the string as a regexp.
        -i | --insensitive      Ignores case sensitivity.
        -C | --no-color         Removes colorization of matches.
        -w | --word             Searches for an exact word.
        -B | --before N         Displays N lines before each match.
        -A | --after N          Displays N lines after each match.
        -V | --invert           Inverts match: print all lines NOT matching.
        -n | --numbers          Prints line numbers along with matching lines.
        -c | --count            Prints only the number of matching lines.
        -x | --capture          Prints only the matching text, not the surrounding
                                chars or lines. This option disables the output
                                control flags: (-A, -B, -C, -V, -n).
        -t | --terminal-safe    Use terminal-safe chars, replacing:
                                %C -> ^       %G -> >       %L -> <
                                %B -> /       %R ->\\       %A -> &
                                %S -> '       %D -> "       %P -> | `;

function replaceUnsafeChars(rxstring) {
    rxstring = rxstring.replaceAll('%C', '^');
    rxstring = rxstring.replaceAll('%G', '>');
    rxstring = rxstring.replaceAll('%L', '<');
    rxstring = rxstring.replaceAll('%B', '/');
    rxstring = rxstring.replaceAll('%R', '\\');
    rxstring = rxstring.replaceAll('%A', '&');
    rxstring = rxstring.replaceAll('%S', "'");
    rxstring = rxstring.replaceAll('%D', '"');
    rxstring = rxstring.replaceAll('%P', '|');
    return rxstring;
}

/**
 * @param {string} input
 * @param {string} rxstring
 * @param {object} options
 */
function getMatchingTokens(
    input,
    rxstring,
    { insensitive = false, word = false, regex = false, safeChars = false }
) {
    if (safeChars) rxstring = replaceUnsafeChars(rxstring);

    const rxmain = word ? `\\b${rxstring}\\b` : rxstring;
    const rxflags = insensitive ? 'gi' : 'g';
    const rxwrapped = wrapRegExpInGroup(
        regex ? rxmain : escapeRegExp(rxstring)
    );
    const regexp = new RegExp(rxwrapped, rxflags);
    const captures = input.matchAll(regexp);
    const unwrapped = [...captures].map(v => v[0]);
    return unwrapped.join('\n');
}

/**
 * @param {string} input
 * @param {string} rxstring
 * @param {object} options
 */
function getMatchingLines(
    input,
    rxstring,
    {
        insensitive = false,
        nocolor = false,
        word = false,
        before = 0,
        after = 0,
        invert = false,
        numbers = false,
        count = false,
        regex = false,
        safeChars = false,
    }
) {
    if (safeChars) rxstring = replaceUnsafeChars(rxstring);

    const rxmain = word ? `\\b${rxstring}\\b` : rxstring;
    const rxflags = insensitive ? 'i' : '';

    const regexp = regex
        ? new RegExp(rxmain, rxflags)
        : new RegExp(escapeRegExp(rxstring), rxflags);

    const lines = input.split('\n');

    let acc = [];
    let addedlines = [];
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let subacc = [];

        if (regexp.test(line)) {
            // if inverted selection, ignore matched lines
            if (invert) continue;
            else addedlines.push(i);

            if (!nocolor)
                line = line.replaceAll(
                    new RegExp(regexp, 'g' + regexp.flags.replace('g', '')),
                    '\x1b[31m$&\x1b[0m'
                );

            line = i + 1 + ':$' + line;

            if (before > 0) {
                let linesbefore = [];
                if (i - before < 0) {
                    linesbefore = lines.slice(0, i);
                    linesbefore = linesbefore.map(
                        (v, j) => i - linesbefore.length + j + 1 + '-$' + v
                    );
                } else {
                    linesbefore = lines.slice(i - before, i);
                    linesbefore = linesbefore.map(
                        (v, j) => i - linesbefore.length + j + 1 + '-$' + v
                    );
                }
                subacc.push(...linesbefore);
            }

            subacc.push(line);

            if (after > 0) {
                if (i + 1 + after >= lines.length) after = lines.length;
                let linesafter = lines.slice(i + 1, i + 1 + after);
                linesafter = linesafter.map((v, j) => i + 2 + j + '-$' + v);
                subacc.push(...linesafter);
            }

            acc.push(subacc.join('\n'));
        } else if (invert) {
            line = i + 1 + ':$' + line;
            subacc.push(line);
            acc.push(subacc.join('\n'));
        }
    }

    acc = acc.join('\n').split('\n');
    for (let i = 0; i < acc.length; i++) {
        let line = acc[i];
        if (line === null) continue;
        let numb = line.slice(0, line.indexOf('$'));
        numb = numb.slice(0, -1);
        acc = acc.map((v, j) =>
            j === i
                ? v
                : v === null
                ? null
                : v.startsWith(numb + '-$')
                ? null
                : v
        );
    }

    acc = acc.filter(v => !!v);

    if (!numbers) acc = acc.map(v => v.slice(v.indexOf('$') + 1));
    if (numbers) acc = acc.map(v => v.replace('$', ''));
    if (count) return '' + acc.length;
    else return acc.join('\n');
}

(async function () {
    const parser = new ArgvParser();
    parser.option('help', { alias: 'h', allowValue: false });
    parser.option('version', { alias: 'v', allowValue: false });
    parser.option('regex', { alias: 'r', allowValue: false });
    parser.option('insensitive', { alias: 'i', allowValue: false });
    parser.option('no-color', { alias: 'C', allowValue: false });
    parser.option('word', { alias: 'w', allowValue: false });
    parser.option('before', { alias: 'B' });
    parser.option('after', { alias: 'A' });
    parser.option('invert', { alias: 'V', allowValue: false });
    parser.option('numbers', { alias: 'n', allowValue: false });
    parser.option('count', { alias: 'c', allowValue: false });
    parser.option('capture', { alias: 'x', allowValue: false });
    parser.option('terminal-safe', { alias: 't', allowValue: false });
    parser.argument('string');
    parser.argument('file');
    const args = parser.parseArgv();
    const fromSTDIN = isStdinActive();

    if (args.version) return console.log(require('./package.json')?.version);
    if (args.help || !args.string || (!fromSTDIN && !args.file))
        return console.log(help);

    let input;
    try {
        input = fromSTDIN ? await readStdin() : fs.readFileSync(args.file);
        input = input.toString('utf-8');
    } catch {
        return console.log(`Error: Could not read input "${args.file}"`);
    }

    if (args.capture)
        return process.stdout.write(
            getMatchingTokens(input, args.string, {
                regex: Boolean(args.regex),
                insensitive: Boolean(args.insensitive),
                word: Boolean(args.word),
                safeChars: Boolean(args['terminal-safe']),
            })
        );

    let before = parseInt(args.before);
    if (isNaN(before) || !before) before = 0;

    let after = parseInt(args.after);
    if (isNaN(after) || !after) after = 0;

    process.stdout.write(
        getMatchingLines(input, args.string, {
            regex: Boolean(args.regex),
            insensitive: Boolean(args.insensitive),
            nocolor: Boolean(args['no-color']),
            word: Boolean(args.word),
            invert: Boolean(args.invert),
            numbers: Boolean(args.numbers),
            count: Boolean(args.count),
            safeChars: Boolean(args['terminal-safe']),
            before,
            after,
        })
    );
})();
