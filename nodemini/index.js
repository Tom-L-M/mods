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
        else if (params[argv[i].slice(1)] !== undefined) {
            if (!Array.isArray(params[argv[i].slice(1)]))
                params[argv[i].slice(1)] = [params[argv[i].slice(1)]];
            params[argv[i].slice(1)].push(
                argv[i + 1]?.startsWith('-') || !argv[i + 1] ? true : argv[++i]
            );
        } else if (params[argv[i].slice(2)] !== undefined) {
            if (!Array.isArray(params[argv[i].slice(1)]))
                params[argv[i].slice(2)] = [params[argv[i].slice(2)]];
            params[argv[i].slice(2)].push(
                argv[i + 1]?.startsWith('-') || !argv[i + 1] ? true : argv[++i]
            );
        } else if (argv[i].startsWith('--'))
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
        console.log(require(exeresolve('nodemini/package.json')).version);
    } catch (err) {
        console.log(
            `Error: could not read package descriptor - ${err.message}`
        );
    }
}

const help = `
    [nodemini]
        A wrapper for NodeJS to be included in executables and run custom scripts.

    Usage:
        nodemini [options] [script]

    Options:        
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -V | --node-version     Prints NodeJS version and quits.
        -e | --eval <CODE>      Execute code and quits.

    Info:
        - This is basically a portable NodeJS executable
        - Not passing any argument will result in accessing the NodeJS REPL
        - Passing multiple '-e' flags concatenate them, joining with a newline '\\n'.`;

(async function () {
    const argv = parseArgv({
        e: 'eval',
    });

    if (
        process.argv.slice(2)[0] === '-h' ||
        process.argv.slice(2)[0] === '--help'
    )
        return console.log(help);
    if (
        process.argv.slice(2)[0] === '-v' ||
        process.argv.slice(2)[0] === '--version'
    )
        return printVersion();
    if (
        process.argv.slice(2)[0] === '-V' ||
        process.argv.slice(2)[0] === '--node-version'
    )
        return console.log(process.version);

    const repl = require('node:repl');

    if (argv.eval && typeof argv.eval === 'string') {
        return eval(argv.eval);
    }

    if (argv.eval && Array.isArray(argv.eval)) {
        return eval(argv.eval.join('\n'));
    }

    if (process.argv.slice(2).length > 0) {
        // Resolve script path to absolute path
        let script = require('node:path').resolve(process.argv[2]);

        // Remove process argv 1, that is the script name
        process.argv = [process.argv[0], script, ...process.argv.slice(3)];

        try {
            return require(script);
        } catch (e) {
            console.log(
                '\nError: Invalid script path provided (' + script + ')\n'
            );
        }
    } else {
        console.log(
            `Entering custom NodeJS ${process.version} REPL, use CTRL+C or ".exit" to quit.\n` +
                'Use .editor to enter interactive editor mode.\n' +
                'Quit and use "--help" flag for help.'
        );
        repl.start('$ ');
    }
})();
