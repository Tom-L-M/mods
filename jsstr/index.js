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
    [jsstr-js]
        A command line utility in NodeJS for manipulating stdin input strings.

    Usage:
        <stdin> | node jsstr [options] <js-code>

    Options:        
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.

    Info:
        > Use the embed variables to manipulate the input:
            > '$' : contains the stdin input as a string, with start/end spaces removed (trimmed).
            > '$s': contains the stdin input as a raw string.
            > '$b': contains the stdin input as a buffer.

        > Tip: The evaluator expects a single expression as <js-code>,
            but it is possible to execute an entire script, as NodeJS
            allows for IIFEs to be run (Immediately Invoked Function Expression).
            So, by using an IIFE wrapper, you can run multiple commands or assign variables.

    Examples:
        Simple string splitting:
            echo "hello world!" | node jsstr "$.split(' ')[0]"       # Prints "hello"

        Using an IIFE to run a block of code: 
        (List the directories in the current cwd recursively) 
            cd | node jsstr "(() => { let f = require('fs'); return f.readdirSync($, {recursive:true}); })()"`;

function customeval(string, buffer) {
    return eval(`
        (function () {
            const $b = Buffer.from('${buffer.toString('hex')}', 'hex');
            const $s = $b.toString('utf8');
            const $ = $s.trim();
            return console.log(${string});
        })();
    `);
}

(async function () {
    const fromSTDIN = isSTDINActive();
    const data = process.argv[2] || '$';
    const opts = { h: 'help', v: 'version' };
    const args = parseArgv(opts);

    if (args.help || (!fromSTDIN && !data)) return console.log(help);
    if (args.version) return printVersion();

    let input;

    // If it is called like:    node script.js [somefile] [flags]
    // E.g. there is no input via pipes
    if (!fromSTDIN) return 'Error: no data on <STDIN> pipe.';
    // If it is called like:   cat somefile | node script.js [flags]
    // E.g. there is input via pipes
    else input = await readStdinAsync();

    customeval(data, input);
})();
