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
    [fold-js]
        A "fold" command line utility in NodeJS.

    Usage:
        fold <file> [options]
      OR
        <stdin> | fold [options]

    Options:
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -w | --width N          Splits the input into lines of width N.
        -i | --ignore-lf        Ignores newlines when splitting with fixed width.
        -s | --spaces           Break at word boundaries, the last blank before the max length.`;

const chunkify = (string, chunkSize = 1) =>
    string.match(new RegExp(`.{1,${chunkSize >= 1 ? chunkSize : 1}}`, 'gim')) ??
    [];

function foldText(input, width, ignoreLF) {
    if (width < 1) throw new Error('Width must be at least 1');

    const words = input.split(ignoreLF ? / +/ : /\s+/); // Split input by whitespace
    let lines = []; // To hold each line of the final output
    let currentLine = ''; // The current line being built

    for (const word of words) {
        // Check if adding this word would exceed the width
        if ((currentLine + word).length > width) {
            // Push the current line and reset it
            lines.push(currentLine.trim());
            currentLine = word + ' '; // Start a new line with the current word
        } else {
            // Otherwise, add the word to the current line
            currentLine += word + ' ';
        }
    }

    // Push the last line if it has any content
    if (currentLine.trim()) {
        lines.push(currentLine.trim());
    }

    // Join lines with newline characters
    return lines.join('\n');
}

function formatInput(
    input,
    { width = 80, preserveWords = false, ignoreLF = false }
) {
    if (preserveWords) return foldText(input, width, ignoreLF);
    if (ignoreLF) input = input.replaceAll('\n', ' ');
    return chunkify(input, width).join('\n');
}

(async function () {
    const fromSTDIN = isSTDINActive();
    const opts = {
        h: 'help',
        v: 'version',
        w: 'width',
        i: 'ignore-lf',
        s: 'spaces',
    };

    const args = parseArgv(opts, { acceptWithNoDash: false });
    const file = process.argv[2];

    if (args.help || (!fromSTDIN && !file)) return console.log(help);
    if (args.version) return printVersion();

    let input;

    let ignoreLF = args['ignore-lf'];

    let width = parseInt(args.width);
    if (isNaN(width) || !width) width = undefined;
    let preserveWords = Boolean(args['spaces']);

    // If it is called like:    node script.js [somefile] [flags]
    // E.g. there is no input via pipes
    if (!fromSTDIN) {
        try {
            input = fs.readFileSync(file);
        } catch {
            return console.log(`Error: Could not read file ${file}`);
        }
    }

    // If it is called like:   cat somefile | node script.js [flags]
    // E.g. there is input via pipes
    else {
        input = await readStdinAsync();
    }

    process.stdout.write(
        formatInput(input.toString('utf-8'), { width, preserveWords, ignoreLF })
    );
})();