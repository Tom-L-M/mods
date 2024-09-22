const fs = require('fs');

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
        if (argv[i] === '-') params['-'] = true;
        else if (argv[i] === '--') params['--'] = true;
        else if (argv[i].startsWith('--'))
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
        console.log(require(exeresolve('cat/package.json')).version);
    } catch (err) {
        console.log(
            `Error: could not read package descriptor - ${err.message}`
        );
    }
}

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

const help = `
    [cat-js]
        A "cat" command line utility in NodeJS.

    Usage:
        node cat [options] <file> [...files]
        <stdin> | node cat [options] [-] <file>

    Options:        
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.

    Info:
        When providing data from STDIN, it will be placed at position of '-'.
        Or, if no '-' is provided, and STDIN has data, it will be appended at the beginning.

    Examples:
        cat something.txt                   # Read file and prints to STDOUT.
        cat somefile.txt otherfile.txt      # Concats the 2 files and print.
        cat a.txt | cat b.txt               # Reads the first file and concats with the second.
        ls | cat a.txt - b.txt              # Concats: a.txt + (result of ls) + b.txt.`;

(async function () {
    const files = process.argv.slice(2);
    const opts = { h: 'help', v: 'version' };
    const args = parseArgv(opts);

    if (args.help || !files.length) return console.log(help);
    if (args.version) return printVersion();

    const nline = Buffer.from('\n');
    const stdinActive = isSTDINActive();

    let input = [];

    let current;
    try {
        for (let file of files) {
            current = file;
            if (file === '-') {
                if (!stdinActive) continue;
                else input.push(await readStdinAsync());
            } else input.push(fs.readFileSync(file), nline);
        }
        // If there is no '-' placeholder, append to the end
        if (stdinActive && !args['-']) input.unshift(await readStdinAsync());
    } catch {
        return console.log(`Error: Could not read file ${current}`);
    }

    process.stdout.write(Buffer.concat(input));
})();
