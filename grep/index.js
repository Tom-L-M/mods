const fs = require('node:fs');
const { parseArgv, isSTDINActive, readStdinAsync } = require('../shared');

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
        -i | --insensitive      Ignores case sensitivity.
        -C | --no-color         Removes colorization of matches.
        -w | --word             Searches for an exact word.
        -B | --before N         Displays N lines before each match.
        -A | --after N          Displays N lines after each match.
        -V | --invert           Inverts match: print all lines NOT matching.
        -n | --numbers          Prints line numbers along with matching lines.
        -c | --count            Prints only the number of matching lines.`;

/**
 * @param {string} input
 * @param {string} rxstring
 * @param {object} options
 */
function parseRegexString(
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
    }
) {
    const rxmain = word ? `\\b${rxstring}\\b` : rxstring;
    const rxflags = insensitive ? 'i' : '';
    const regex = new RegExp(rxmain, rxflags);
    const lines = input.split('\n');

    let acc = [];
    let addedlines = [];
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let subacc = [];

        if (regex.test(line)) {
            // if inverted selection, ignore matched lines
            if (invert) continue;
            else addedlines.push(i);

            if (!nocolor)
                line = line.replaceAll(
                    new RegExp(regex, 'g' + regex.flags.replace('g', '')),
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
    const fromSTDIN = isSTDINActive();
    const opts = {
        h: 'help',
        v: 'version',
        i: 'insensitive',
        C: 'no-color',
        w: 'word',
        B: 'before',
        A: 'after',
        V: 'invert',
        n: 'numbers',
        c: 'count',
    };
    const args = parseArgv(opts, { allowWithNoDash: false });
    const rxstring = process.argv[2];
    const file = process.argv[3];

    if (args.help || (!fromSTDIN && !rxstring) || (!fromSTDIN && !file))
        return console.log(help);
    if (args.version) return console.log(require('./package.json')?.version);

    let input;

    let before = parseInt(args.before);
    if (isNaN(before) || !before) before = 0;

    let after = parseInt(args.after);
    if (isNaN(after) || !after) after = 0;

    // If it is called like:    node script.js [somefile] [flags]
    // E.g. there is no input via pipes
    if (!fromSTDIN) {
        try {
            if (!rxstring)
                return console.log(`Error: Invalid test string provided`);
            input = fs.readFileSync(file);
        } catch {
            return console.log(`Error: Could not read file ${file}`);
        }
    }

    // If it is called like:   cat somefile | node script.js [flags]
    // E.g. there is input via pipes
    else {
        if (!rxstring)
            return console.log(`Error: Invalid test string provided`);
        input = await readStdinAsync();
    }

    process.stdout.write(
        parseRegexString(input.toString('utf-8'), rxstring, {
            insensitive: Boolean(args.insensitive),
            nocolor: Boolean(args['no-color']),
            word: Boolean(args.word),
            invert: Boolean(args.invert),
            numbers: Boolean(args.numbers),
            count: Boolean(args.count),
            before,
            after,
        })
    );
})();
