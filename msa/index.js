const exeresolve = fname => {
    const [m0, m1] = fname.replaceAll('\\', '/').split('/');
    return __dirname.endsWith(m0)
        ? __dirname + '/' + m1
        : __dirname + '/' + fname;
};

const MultiArchive = require(exeresolve('msa/multi-archive.js'));

const fs = require('node:fs');
const path = require('node:path');

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
 * parseargs({ "p": "param3" })
 * // creates:
 * {
 *   build: true
 *   param1: true
 *   param2: p2value
 *   param3: 0000
 * }
 */
const parseargs = (mapping = {}, args = process.argv.slice(2)) => {
    let params = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--'))
            params[args[i].slice(2)] =
                args[i + 1]?.startsWith('-') || !args[i + 1] ? true : args[++i];
        else if (args[i].startsWith('-'))
            params[args[i].slice(1)] =
                args[i + 1]?.startsWith('-') || !args[i + 1] ? true : args[++i];
        else params[args[i]] = true;
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
        console.log(require(exeresolve('msa/package.json')).version);
    } catch (err) {
        console.log(
            `Error: could not read package descriptor - ${err.message}`
        );
    }
}

const help = `
    [msa-js]
        A tool for handling MSA archives.

    Archiving:
        msa c|create <source>

    Extracting:
        msa x|extract <archive>

    Listing:
        msa l|list <archive>

    Appending:
        msa a|append <archive> <source>

    Options:
        -h | --help         Prints the help message and quits.
        -v | --version      Prints the version info and quits.`;

(async function () {
    const opts = { h: 'help', v: 'version' };
    const args = parseargs(opts);
    const command = process.argv[2];
    const archive = process.argv[3];
    const source = process.argv[4];

    if (args.help || !command) return console.log(help);
    if (args.version) return printVersion();

    if (!fs.existsSync(archive))
        return console.log('Error: invalid archive path provided');

    switch (command) {
        case 'c':
        case 'create':
            await MultiArchive.create(archive);
            break;

        case 'x':
        case 'extract':
            await MultiArchive.extract(archive);
            break;

        case 'l':
        case 'list':
            console.log(await MultiArchive.list(archive));
            break;

        case 'a':
        case 'append':
            if (fs.statSync(source).isDirectory())
                for (let file of fs
                    .readdirSync(source)
                    .map(v => path.join(source, v))) {
                    await MultiArchive.append(archive, file);
                }
            else await MultiArchive.append(archive, source);
            break;
    }

    return;
})();
