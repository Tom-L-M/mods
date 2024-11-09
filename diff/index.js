const fs = require('fs');

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
 * @since 1.2.14
 *
 * @param {Object} mapping An object mapping the arguments alias. Always take the form of "alias":"originalProperty"
 * @return {Object} An object containing the arguments parsed, and their values
 *
 * @example <caption>  </caption>
 * // called the script with:
 * // node example.js build --param1 --param2 pvalue -p 0000
 * parseArgv({ "p": "param3" })
 * // creates:
 * {
 *   build: true
 *   param1: true
 *   param2: p2value
 *   param3: 0000
 * }
 */
const parseArgv = (mapping = {}, argv = process.argv.slice(2)) => {
    let params = {};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i].startsWith('--'))
            params[argv[i].slice(2)] =
                argv[i + 1]?.startsWith('-') || !argv[i + 1] ? true : argv[++i];
        else if (argv[i].startsWith('-'))
            params[argv[i].slice(1)] =
                argv[i + 1]?.startsWith('-') || !argv[i + 1] ? true : argv[++i];
        else params[argv[i]] = true;
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
    [diff-js]
        A "diff" command line utility in NodeJS.

    Usage:
        node diff [file-A] [file-B] [options]
      OR
        <stdin> | node diff [file-B] [options]
        
    Options:
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -q | --quiet            Shows only if the files are different or not.
        -c | --no-color         Prints result without color ANSI tokens.`;

const green = string => `\x1b[32m${string}\x1b[0m`;
const red = string => `\x1b[31m${string}\x1b[0m`;

/**
 * Generates a new Modification patch array from two data sources using Myer's Diff Algorithm.
 * @param {string|Array<string>} source The data to compare as 'source'. May be a string, buffer or array.
 * @param {string|Array<string>} destinatin The data to compare as 'destination'. May be a string, buffer or array.
 * @returns {Array<{action:string,data:string}>} A list of "new Modification" objects, representing the steps needed to build the patch.
 */
function diff(source, destination) {
    class Modification {
        constructor(action, data) {
            this.action = action;
            this.data = data;
        }
    }

    let frontier = { 1: { x: 0, history: [] } };
    let aMax = source.length;
    let bMax = destination.length;

    for (let d = 0; d <= aMax + bMax; d++) {
        for (let k = -d; k <= d; k += 2) {
            let goDown =
                k === -d || (k !== d && frontier[k - 1].x < frontier[k + 1].x);

            let oldX, history;
            if (goDown) {
                oldX = frontier[k + 1].x;
                history = frontier[k + 1].history;
            } else {
                oldX = frontier[k - 1].x + 1;
                history = frontier[k - 1].history;
            }

            history = history.slice();
            let y = oldX - k;

            if (1 <= y && y <= bMax && goDown) {
                history.push(new Modification('insert', destination[y - 1]));
            } else if (1 <= oldX && oldX <= aMax) {
                history.push(new Modification('remove', source[oldX - 1]));
            }

            while (oldX < aMax && y < bMax && source[oldX] === destination[y]) {
                oldX++;
                y++;
                history.push(new Modification('keep', source[oldX - 1]));
            }

            if (oldX >= aMax && y >= bMax) {
                return history;
            } else {
                frontier[k] = { x: oldX, history };
            }
        }
    }

    throw new Error('Could not find edit script');
}

function patch(data1, data2, { quiet, nocolor } = {}) {
    const dataSource1 = data1.trim().split('\n');
    const dataSource2 = data2.trim().split('\n');
    const difflist = diff(dataSource1, dataSource2);

    if (quiet) {
        return console.log(difflist.length > 0);
    }

    for (let { action, data } of difflist) {
        if (action === 'insert') {
            console.log('+ ' + (nocolor ? data : green(data)));
        } else if (action === 'remove') {
            console.log('- ' + (nocolor ? data : red(data)));
        } else {
            console.log('  ' + data);
        }
    }
}

(async function () {
    const fromSTDIN = isSTDINActive();
    const file = process.argv[2];
    const fileB = process.argv[3];
    const opts = {
        h: 'help',
        v: 'version',
        q: 'quiet',
        c: 'no-color',
    };
    const args = parseArgv(opts);

    if (args.help || (!fromSTDIN && !file)) return console.log(help);
    if (args.version) return printVersion();

    let input, inputB;
    const quiet = args.quiet || null;
    const nocolor = args['no-color'] || null;

    // If it is called like:    node script.js [somefile] [somefileB] [flags]
    // E.g. there is no input via pipes
    if (!fromSTDIN) {
        try {
            input = fs.readFileSync(file);
        } catch {
            return console.log(`Error: Could not read file ${file}`);
        }
        try {
            inputB = fs.readFileSync(fileB);
        } catch {
            return console.log(`Error: Could not read file ${fileB}`);
        }
    }

    // If it is called like:   cat somefile | node script.js [somefileB] [flags]
    // E.g. there is input via pipes
    else {
        input = await readStdinAsync();
        try {
            inputB = fs.readFileSync(file);
        } catch {
            return console.log(`Error: Could not read file ${file}`);
        }
    }

    return patch(input.toString(), inputB.toString(), {
        quiet,
        nocolor,
    });
})();
