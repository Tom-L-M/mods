const fs = require('node:fs');

function readStdinAsync() {
    return new Promise((resolve, reject) => {
        const stream = process.stdin;
        const chunks = [];

        const onData = chunk => chunks.push(chunk);
        const onEnd = () => quit() && resolve(Buffer.concat(chunks));
        const onError = err => quit() && reject(err);

        const quit = () => {
            stream.removeListener('data', onData);
            stream.removeListener('end', onEnd);
            stream.removeListener('error', onError);
            return true;
        };

        stream.on('data', onData);
        stream.on('end', onEnd);
        stream.on('error', onError);
    });
}

const isSTDINActive = () => !process.stdin.isTTY;

/**
 * Parses the CLI arguments (process.argv), dividing the flags into properties of an object.
 * Multi-word params are divided as "param":"value", while sinle-word params becomes: "param":true.
 * Lost values will be ignored*. So 'node example.js 000 --param1' will turn into: { param1:true } and '000' will be ignored.
 *   * Unless they are defined as aliases for other parameters. So, if mapping is defined as { '000':'param0' },
 *     the result will be { param1:true, param0: true } instead of { param1:true }
 * Aliases in 'mapping' do not take priority over regular double-word parameters
 *
 * @since 1.5.0
 *
 * @param {Object} mapping An object mapping the arguments alias. Always take the form of "alias":"originalProperty"
 * @param {{ acceptWithNoDash, args }} options The "acceptWithNoDash" allows for parameters without '--' or '-' to be considered.
 * And the "args" parameter allows for specifiying a custom array instead of process.argv.
 * @return {Object} An object containing the arguments parsed, and their values
 *
 * @example <caption> With acceptWithNoDash = true (default) </caption>
 * // called the script with:
 * // node example.js build --param1 pvalue -p 0000
 * parseArgv({ "p": "param3" })
 * // returns:  { build: true, param1: p2value, param3: 0000 }
 *
 * @example <caption> With acceptWithNoDash = false </caption>
 * // called the script with:
 * // node example.js build --param1 pvalue -p 0000
 * parseArgv({ "p": "param3" }, { acceptWithNoDash: false })
 * // returns:  { param1: p2value, param3: 0000 }
 * // The 'build' param is not considered, as it does not start with a dash
 */
const parseArgv = (mapping = {}, { acceptWithNoDash = true, args } = {}) => {
    const argv = args || process.argv.slice(2);
    let params = {};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith('--'))
            params[argv[i].slice(2)] =
                argv[i + 1]?.startsWith('-') || !argv[i + 1] ? true : argv[++i];
        else if (argv[i].startsWith('-'))
            params[argv[i].slice(1)] =
                argv[i + 1]?.startsWith('-') || !argv[i + 1] ? true : argv[++i];
        else acceptWithNoDash ? (params[argv[i]] = true) : null;
    }
    for (let key in mapping) {
        if (params[key]) {
            params[mapping[key]] = params[key];
            delete params[key];
        }
    }
    return params;
};

const _require = file => {
    const fname = process.env.MODULE_NAME + '/' + file;
    const fdirname = __dirname.replaceAll('\\', '/');
    const [m0, m1] = fname.replaceAll('\\', '/').split('/');
    const final = fdirname.endsWith(m0)
        ? fdirname + '/' + m1
        : fdirname + '/' + fname;
    return require(final);
};

function printVersion() {
    try {
        console.log(_require('package.json').version);
    } catch (err) {
        console.log(
            `Error: could not read package descriptor - ${err.message}`
        );
    }
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
    const args = parseArgv(opts, { acceptWithNoDash: false });
    const rxstring = process.argv[2];
    const file = process.argv[3];

    if (args.help || (!fromSTDIN && !rxstring) || (!fromSTDIN && !file))
        return console.log(help);
    if (args.version) return printVersion();

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
