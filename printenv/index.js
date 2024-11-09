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
    [printenv-js]
        A "printenv" command line utility in NodeJS.

    Usage:
        node printenv [varname] [options]

    Options:
        -h | --help             Prints the help message and quits.
        -v | --version          Prints the version info and quits.
        -0 | --null             Terminates each ENV variable with a NULL byte.`;

(async function () {
    const opts = {
        h: 'help',
        v: 'version',
        0: 'null',
    };

    const args = parseArgv(opts, { acceptWithNoDash: false });

    if (args.help) return console.log(help);
    if (args.version) return printVersion();

    const env = process.env;
    const nvar = (process.argv[2] || '').toUpperCase();
    const terminator = args.null ? '\0' : '\n';

    if (!nvar || nvar.startsWith('-')) {
        for (let key in env) {
            process.stdout.write(key + '=' + env[key] + terminator);
        }
        return;
    }
    return process.stdout.write((env[nvar] || '') + terminator);
})();
