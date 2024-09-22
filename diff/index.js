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

const isSTDINActive = () => !Boolean(process.stdin.isTTY);

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

const exeresolve = fname => {
    const [m0, m1] = fname.replaceAll('\\', '/').split('/');
    return __dirname.endsWith(m0)
        ? __dirname + '/' + m1
        : __dirname + '/' + fname;
};

function printVersion() {
    try {
        console.log(require(exeresolve('diff/package.json')).version);
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
        -i | --insensitive      Ignores case in diff analysis.
        -b | --blank            Ignores blank spaces in diff analysis.
        -c | --no-color         Prints result without color ANSI tokens.
`;

const COLOR_RED = '\x1b[31m';
const COLOR_GREEN = '\x1b[32m';
const COLOR_OFF = '\x1b[0m';

function diff(data1, data2, { quiet, insensitive, blank, nocolor } = {}) {
    if (quiet)
        return data1.toString('hex') === data2.toString('hex')
            ? 'EQUAL'
            : 'DIFFERENT';
    const lines1 = data1.toString('utf-8').split('\n');
    const lines2 = data2.toString('utf-8').split('\n');
    const longer = Math.max(lines1.length, lines2.length);
    let diffIn = [];
    let diffOut = [];

    let lines1ConsumedIndices = [];
    let lines2ConsumedIndices = [];

    let modlines1 = insensitive ? lines1.map(v => v.toLowerCase()) : lines1;
    modlines1 = blank
        ? modlines1.map(v => v.replaceAll(/\s+/gim, ''))
        : modlines1;
    let modlines2 = insensitive ? lines2.map(v => v.toLowerCase()) : lines2;
    modlines2 = blank
        ? modlines2.map(v => v.replaceAll(/\s+/gim, ''))
        : modlines2;

    for (let i = 0; i < lines1.length; i++) {
        let line = lines1[i];
        if (insensitive) line = line.toLowerCase();
        if (blank) line = line.replaceAll(/\s+/gim, '');

        if (!modlines2.includes(line) && !lines2ConsumedIndices.includes(i)) {
            diffIn.push([i + 1, lines1[i]]);
        } else lines2ConsumedIndices.push(i);
    }

    for (let i = 0; i < lines2.length; i++) {
        let line = lines2[i];
        if (insensitive) line = line.toLowerCase();
        if (blank) line = line.replaceAll(/\s+/gim, '');

        // if (!modlines1.includes(line))
        //     diffOut.push([i, lines2[i]]);

        if (!modlines1.includes(line) && !lines1ConsumedIndices.includes(i)) {
            diffOut.push([i + 1, lines2[i]]);
        } else lines1ConsumedIndices.push(i);
    }

    // for (let i = 0; i < longer; i++) {
    //     let line1 = (lines1[i] || '');
    //     let line2 = (lines2[i] || '');

    //     if (insensitive) {
    //         line1 = line1.toLowerCase();
    //         line2 = line2.toLowerCase();
    //     }
    //     if (blank) {
    //         line1 = line1.replaceAll(/\s+/gi, '').replaceAll(/\r{0,}\n{0,}/gi, '');
    //         line2 = line2.replaceAll(/\s+/gi, '').replaceAll(/\r{0,}\n{0,}/gi, '');
    //     }
    //     if (line1 !== line2) {
    //         if (line1) diffIn.push([i, lines1[i]]);
    //         if (line2) diffOut.push([i, lines2[i]]);
    //     }
    // }

    return (
        (diffIn.length > 0 || diffOut.length > 0 ? '\n' : '') +
        (nocolor || diffIn.length <= 0 ? '' : COLOR_RED) +
        (diffIn.length > 0
            ? diffIn.map(v => `<${v[0]}\t${v[1]}`).join('\n')
            : '') +
        (diffIn.length > 0 ? '\n\n' : '') +
        (nocolor || diffOut.length <= 0 ? '' : COLOR_GREEN) +
        (diffOut.length > 0
            ? diffOut.map(v => `>${v[0]}\t${v[1]}`).join('\n')
            : '') +
        (nocolor || (diffIn.length <= 0 && diffOut.length <= 0)
            ? ''
            : COLOR_OFF) +
        (diffIn.length > 0 || diffOut.length > 0 ? '\n' : '')
    );
}

(async function () {
    const fromSTDIN = isSTDINActive();
    const file = process.argv[2];
    const fileB = process.argv[3];
    const opts = {
        h: 'help',
        v: 'version',
        q: 'quiet',
        i: 'insensitive',
        b: 'blank',
        c: 'no-color',
    };
    const args = parseArgv(opts);

    if (args.help || (!fromSTDIN && !file)) return console.log(help);
    if (args.version) return printVersion();

    let input, inputB;
    const quiet = args.quiet || null;
    const insensitive = args.insensitive || null;
    const blank = args.blank || null;
    const nocolor = args['no-color'] || null;

    // If it is called like:    node script.js [somefile] [somefileB] [flags]
    // E.g. there is no input via pipes
    if (!fromSTDIN) {
        try {
            input = fs.readFileSync(file);
        } catch (err) {
            return console.log(`Error: Could not read file ${file}`);
        }
        try {
            inputB = fs.readFileSync(fileB);
        } catch (err) {
            return console.log(`Error: Could not read file ${fileB}`);
        }
    }

    // If it is called like:   cat somefile | node script.js [somefileB] [flags]
    // E.g. there is input via pipes
    else {
        input = await readStdinAsync();
        try {
            inputB = fs.readFileSync(file);
        } catch (err) {
            return console.log(`Error: Could not read file ${file}`);
        }
    }

    return console.log(
        diff(input, inputB, { quiet, insensitive, blank, nocolor })
    );
})();
