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

function printVersion() {
    try {
        console.log(require('./package.json').version);
    } catch (err) {
        console.log(
            `Error: could not read package descriptor - ${err.message}`
        );
    }
}

function compare(a, b) {
    return a?.toLowerCase() === b?.toLowerCase();
}

const fs = require('fs');

(async function wrapper() {
    const crypto = require('crypto');
    const args = process.argv.slice(2);
    const help = `
    [hasher-js]
        A tool for calculating hash values of files and text.

    Usage:
        node hasher <file|data> [options]
       OR
        <input> | node hasher [options]

    Options:
        -h | --help         Prints this help message and quit.
        -v | --version      Prints version information and quit.
        -t | --text         Inform that the provided string is data, and not a filename.
        -x | --hash         Define the hash type to be used.
        -c | --compare S    Compare the generated hash with the provided hash S.
        -d | --digest S     Digest the generated hash with one of the digest types.
        
    Hash Types:
        sha256 (default), md5, sha1, sha224, sha384, sha512

    Digest Types:
        hex (default), utf8, base64, ascii`;

    const argv = parseArgv({
        h: 'help',
        v: 'version',
        t: 'text',
        c: 'compare',
        d: 'digest',
        x: 'hash',
    });

    const fromSTDIN = isSTDINActive();

    if (argv.help || (args.length < 1 && !fromSTDIN)) return console.log(help);

    if (argv.version) return printVersion();

    const file = args[0];
    const hashType = argv.hash || 'sha256';
    const comparison = argv.compare;
    const digest = argv.digest || 'hex';
    const isText = argv.text;

    let input = file;

    // If it is called like:   cat somefile | node script.js [flags]
    // E.g. there is input via pipes
    if (fromSTDIN) input = await readStdinAsync();

    if (
        !['md5', 'sha1', 'sha224', 'sha256', 'sha384', 'sha512'].includes(
            hashType
        )
    ) {
        return console.log('ERROR: INVALID HASH SELECTED : ' + hashType);
    }

    if (!['hex', 'utf8', 'base64', 'ascii'].includes(digest))
        return console.log('ERROR: INVALID DIGEST TYPE SELECTED : ' + hashType);

    const hash = crypto.createHash(hashType);

    if (isText || fromSTDIN) {
        let end = hash.update(input);
        end = hash.digest(digest);
        let res =
            end +
            (comparison
                ? ` :: ` + (compare(end, comparison) ? 'EQUAL' : 'NOT EQUAL')
                : '');
        console.log(res);
        return;
    }

    const stream = fs.createReadStream(input);
    stream.on('readable', () => {
        const data = stream.read();
        if (data) hash.update(data);
        else {
            let end = hash.digest(digest);
            let res =
                end +
                (comparison
                    ? ` :: ` +
                      (compare(end, comparison) ? 'EQUAL' : 'NOT EQUAL')
                    : '');
            console.log(res);
        }
    });
    stream.on('error', () => console.log('ERROR: IMPOSSIBLE TO REACH FILE'));
    // NO CODE CAN GO AFTER THIS. The code automatically quits when there is a 'file unreacheable' error above.
})();
