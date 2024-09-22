const crypto = require('crypto');
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
        console.log(require(exeresolve('shred/package.json')).version);
    } catch (err) {
        console.log(
            `Error: could not read package descriptor - ${err.message}`
        );
    }
}

const help = `
    [shred-js]
        A unix "shred" command line utility in NodeJS.
        Overrides a file with random data in-place and then removes it.
        This allows for complete file exclusion, overriding it.

    Usage:
        node shred [file] [options]

    Options:        
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.
        -r | --remove       Remove the file after overriding.
        -z | --zerofill     Fills with null bytes instead of random data.
                            This makes the process faster, but less secure.`;

function refill(buffer) {
    crypto.randomFillSync(buffer);
    return buffer;
}

const WRITE_CHUNK_SIZE = 4 * 1024; // 4 Kb

(async function () {
    const file = process.argv[2];
    const opts = { h: 'help', v: 'version', z: 'zerofill', r: 'remove' };
    const args = parseArgv(opts);

    if (args.help || !file) return console.log(help);
    if (args.version) return printVersion();

    let remove = args['remove'];
    let zerofill = args.zerofill;

    let stream,
        stats,
        fsize,
        written = 0;
    try {
        stats = fs.statSync(file);
        stream = fs.createWriteStream(file);
        fsize = stats.size;
    } catch (err) {
        return console.log(`Error: could not find file - ${file}`);
    }

    // To optimize memory usage, when there is a zerofill operation,
    // simply create a single buffer and reuse it;
    let sharedbuffer;
    if (zerofill) sharedbuffer = Buffer.alloc(WRITE_CHUNK_SIZE, 0);
    else sharedbuffer = Buffer.allocUnsafe(WRITE_CHUNK_SIZE);

    const writeSync = (s, d) => new Promise(r => s.write(d, r));

    for (; written + WRITE_CHUNK_SIZE < fsize; ) {
        if (zerofill) await writeSync(stream, sharedbuffer);
        else await writeSync(stream, refill(sharedbuffer));
        written += WRITE_CHUNK_SIZE;
    }

    if (zerofill) await writeSync(stream, Buffer.alloc(fsize - written, 0));
    else await writeSync(stream, refill(Buffer.allocUnsafe(fsize - written)));

    await new Promise(resolve => stream.close(resolve));

    if (remove) fs.rmSync(file);
})();
